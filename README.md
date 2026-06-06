# OpenSkillTrace

OpenSkillTrace is a low-code AgentOps workflow platform prototype for high-risk operational agents. This workspace follows the supplied Monee FraudOps wireframe and PRD.

## Run Locally

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload
```

Open the app at [http://localhost:8000](http://localhost:8000).

## Run With Docker Compose

```bash
docker compose up --build
```

Open the app at [http://localhost:8000](http://localhost:8000).

Notes:

- The app stores its JSON data in `./data`, which is bind-mounted into the container for persistence.
- `./.env.local` is mounted read-only into the container if present, so local secrets stay on the backend side.
- Stop the stack with `docker compose down`.

Direct routes:

- `/#overview`
- `/#studio`
- `/#catalog`
- `/#rag`
- `/#providers`
- `/#fallback`
- `/#eval`
- `/#governance`

## Environment

Copy `.env.example` to `.env.local` for local development. API keys belong only in backend environment files and must never be exposed to the frontend.

## Verify

```bash
python3 -m pytest tests -q
node --check assets/app.js
node --check assets/studio.js
node --check assets/views-build.js
node --check assets/views-reliability.js
```

## Graphify Automation

This repo can refresh its Graphify knowledge graph before every `git push`.

```bash
scripts/install-graphify-pre-push-hook.sh
```

The installed hook runs `graphify update .` for code changes. If docs, HTML, images, or media changed, it sources `.env.local` when present and runs a full semantic `graphify extract` when an LLM API key is available. If no key is available, it marks `graphify-out/.needs_update` so a semantic refresh can be run intentionally.

To force full semantic extraction during push, set:

```bash
GRAPHIFY_PRE_PUSH_FULL=1 git push
```

Use `GRAPHIFY_PRE_PUSH=0 git push` to skip the hook for one push.
Use `GRAPHIFY_PRE_PUSH_FULL=0 git push` to force the fast code-only path for one push.

## AgentOps API

The backend exposes durable JSON-backed collections for the product loops used by the UI:

- `GET/POST/PATCH/DELETE /api/workflows`
- `GET/POST/PATCH/DELETE /api/mcp/servers`
- `GET/POST/PATCH/DELETE /api/providers`
- `GET/POST/PATCH/DELETE /api/provider-keys`
- `GET/POST/PATCH/DELETE /api/fallback-policies`
- `GET/POST/PATCH/DELETE /api/rag/sources`
- `GET/POST/PATCH/DELETE /api/replay/scenarios`
- `GET/POST/PATCH/DELETE /api/approvals`
- `GET/POST/PATCH/DELETE /api/audit-events`
- `GET/POST/PATCH/DELETE /api/workflow-runs`
- `GET/POST/PATCH/DELETE /api/run-events`
- `GET/POST/PATCH/DELETE /api/harness-artifacts`
- `GET/POST/PATCH/DELETE /api/capabilities`
- `GET/POST /api/settings`
- `POST /api/investigations/scam-response`
- `POST /api/workflow-runs/stream`
- `POST /api/workflow-runs/{run_id}/approval`

Provider keys are fingerprinted and masked before storage responses are returned; plaintext keys are never returned by the API.
Workflow Preview streams server-sent events from the configured provider route: OpenAI `OST_DEFAULT_MODEL`, then OpenAI-compatible local GPT-OSS, then Fireworks GPT-OSS when configured.

## Wireframe Source

The product/UI requirements are captured in [docs/OpenSkillTrace_UXUI_PRD.md](docs/OpenSkillTrace_UXUI_PRD.md).
