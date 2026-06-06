#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
hook_path="$repo_root/.git/hooks/pre-push"
script_path="$repo_root/scripts/graphify-pre-push.sh"
relative_script="../../scripts/graphify-pre-push.sh"

if [ ! -f "$script_path" ]; then
  printf 'missing %s\n' "$script_path" >&2
  exit 1
fi

chmod +x "$script_path"
mkdir -p "$(dirname "$hook_path")"

if [ -e "$hook_path" ] && [ ! -L "$hook_path" ] && ! grep -q 'graphify-pre-push.sh' "$hook_path"; then
  backup_path="$hook_path.backup.$(date +%Y%m%d%H%M%S)"
  mv "$hook_path" "$backup_path"
  cat > "$hook_path" <<EOF
#!/usr/bin/env bash
set -e
"$script_path" "\$@"
"$backup_path" "\$@"
EOF
  chmod +x "$hook_path"
  printf 'Installed graphify pre-push hook and preserved existing hook at %s\n' "$backup_path"
else
  ln -sf "$relative_script" "$hook_path"
  chmod +x "$hook_path"
  printf 'Installed graphify pre-push hook at %s\n' "$hook_path"
fi
