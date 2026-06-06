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

## Wireframe Source

The product/UI requirements are captured in [docs/OpenSkillTrace_UXUI_PRD.md](docs/OpenSkillTrace_UXUI_PRD.md).
