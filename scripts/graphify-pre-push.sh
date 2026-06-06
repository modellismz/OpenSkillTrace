#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[graphify pre-push] %s\n' "$*" >&2
}

NULL_SHA="0000000000000000000000000000000000000000"

if [ "${GRAPHIFY_PRE_PUSH:-1}" = "0" ]; then
  log "disabled by GRAPHIFY_PRE_PUSH=0"
  exit 0
fi

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$repo_root"

if [ -f ".env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  source ".env.local"
  set +a
fi

graphify_cmd=()
if command -v graphify >/dev/null 2>&1; then
  graphify_cmd=(graphify)
else
  for marker in .graphify_python graphify-out/.graphify_python; do
    if [ -f "$marker" ]; then
      python_bin="$(cat "$marker")"
      if [ -x "$python_bin" ] && "$python_bin" -m graphify --help >/dev/null 2>&1; then
        graphify_cmd=("$python_bin" -m graphify)
        break
      fi
    fi
  done
fi

if [ "${#graphify_cmd[@]}" -eq 0 ]; then
  log "graphify CLI not found; skipping graph refresh"
  exit 0
fi

changed_files="$(mktemp)"
refs_seen=0
trap 'rm -f "$changed_files"' EXIT

while read -r local_ref local_sha remote_ref remote_sha; do
  refs_seen=1
  if [ -z "${local_ref:-}" ] || [ "$local_sha" = "$NULL_SHA" ]; then
    continue
  fi

  if [ "$remote_sha" = "$NULL_SHA" ]; then
    base_sha="$(git rev-list --max-parents=0 "$local_sha" | tail -n 1)"
  else
    base_sha="$remote_sha"
  fi

  git diff --name-only "$base_sha" "$local_sha" >> "$changed_files" || true
done

if [ "$refs_seen" -eq 0 ]; then
  log "no push refs on stdin; skipping graph refresh"
  exit 0
fi

if [ ! -s "$changed_files" ]; then
  log "no changed files detected for pushed refs"
  exit 0
fi

sort -u "$changed_files" -o "$changed_files"

supported_pattern='\.(py|js|ts|tsx|jsx|go|rs|java|cpp|c|h|hpp|swift|kt|cs|rb|php|scala|md|txt|html|pdf|png|jpg|jpeg|webp|mp4|mp3|wav)$'
semantic_pattern='\.(md|txt|html|pdf|png|jpg|jpeg|webp|mp4|mp3|wav)$'

if [ -s "$changed_files" ] && ! grep -Eiq "$supported_pattern" "$changed_files"; then
  log "no graphify-supported files changed"
  exit 0
fi

semantic_changed=0
if [ -s "$changed_files" ] && grep -Eiq "$semantic_pattern" "$changed_files"; then
  semantic_changed=1
fi

mkdir -p graphify-out

has_semantic_key=0
if [ -n "${OPENAI_API_KEY:-}" ] || [ -n "${GEMINI_API_KEY:-}" ] || [ -n "${GOOGLE_API_KEY:-}" ] || [ -n "${ANTHROPIC_API_KEY:-}" ] || [ -n "${DEEPSEEK_API_KEY:-}" ]; then
  has_semantic_key=1
fi

if [ "$semantic_changed" -eq 1 ] && [ "${GRAPHIFY_PRE_PUSH_FULL:-auto}" != "0" ] && { [ "${GRAPHIFY_PRE_PUSH_FULL:-auto}" = "1" ] || [ "$has_semantic_key" -eq 1 ]; }; then
  log "docs/media changed; running full semantic graph extraction"
  "${graphify_cmd[@]}" extract "$repo_root" --out "$repo_root" --max-concurrency "${GRAPHIFY_PRE_PUSH_CONCURRENCY:-1}"
else
  log "refreshing code graph"
  "${graphify_cmd[@]}" update "$repo_root"

  if [ "$semantic_changed" -eq 1 ]; then
    touch graphify-out/.needs_update
    log "docs/media changed; marked graphify-out/.needs_update for a semantic refresh"
    log "set GRAPHIFY_PRE_PUSH_FULL=1 to run full semantic extraction during push"
  fi
fi

if ! git diff --quiet -- graphify-out; then
  log "graph files changed locally; commit graphify-out/ if the remote should receive them"
fi
