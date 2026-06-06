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
- `GET/POST /api/settings`
- `POST /api/investigations/scam-response`

Provider keys are fingerprinted and masked before storage responses are returned; plaintext keys are never returned by the API.

## Wireframe Source

The product/UI requirements are captured in [docs/OpenSkillTrace_UXUI_PRD.md](docs/OpenSkillTrace_UXUI_PRD.md).
