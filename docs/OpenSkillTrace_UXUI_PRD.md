# OpenSkillTrace UX/UI PRD

**Product:** OpenSkillTrace  
**Module:** Low-code AgentOps Workflow Platform  
**Primary demo use case:** Monee Real-time Scam/Fraud Transaction Response Agent  
**Audience:** UX/UI design team, product design, frontend engineering, product strategy  
**Version:** Draft v2  
**Date:** 2026-06-06

---

## 1. Product Positioning

OpenSkillTrace is a **low-code AgentOps workflow platform for high-risk enterprise operations**.

It allows business/ops teams to build agent workflows visually, while every workflow step is wrapped by a production-grade **Harness Layer**:

- trace
- model fallback
- tool fallback
- skill/capability fallback
- workflow fallback
- evaluation/replay
- policy enforcement
- human approval
- audit packet
- capability capture

### One-line product message

> OpenSkillTrace lets enterprises build operational agents that act fast but cannot act unsafely, because every step is wrapped by trace, fallback, eval, policy, approval, audit, and capability capture.

### Differentiation

**Compared with Dify:**
- Dify helps teams build AI workflows.
- OpenSkillTrace helps teams build **high-risk operational agent workflows** with harness controls built into every step.

**Compared with Portkey:**
- Portkey makes LLM/API calls resilient.
- OpenSkillTrace makes the **entire agent workflow** resilient.

**Compared with LangSmith / Deep Agents:**
- LangSmith helps teams trace, debug, and evaluate agents.
- OpenSkillTrace helps teams design operational workflows where fallback, approval, policy, eval, audit, and capability reuse are part of the product UI.

---

## 2. Primary UX Goal

The first screen of the product must answer these questions immediately:

1. **Can users build an agent?**  
   Yes. They can drag Input, Agent/LLM, Tool, RAG, MCP, Approval, Output, and Harness blocks into a workflow.

2. **Where is the LLM configured?**  
   In the right-side **Harness Inspector** under LLM Runtime.

3. **Where is the Harness Layer?**  
   It is visually shown as an orange harness layer wrapping the workflow and as per-node harness badges.

4. **Why is this different from a generic workflow builder?**  
   Every node has trace, fallback, eval, policy, approval, audit, and capability capture settings.

5. **What is the concrete use case?**  
   Real-time scam/fraud transaction response for Monee-style financial operations.

6. **Can users run and trust the workflow before publishing?**  
   Yes. `/#studio` includes a live Preview mode that streams a workflow-driven run, animates every node and edge, and shows how the harness recovers or escalates when a node fails.

---

## 3. Hero Use Case: Monee Real-time Scam/Fraud Transaction Response Agent

### 3.1 Business Problem

A customer reports:

> “I was tricked into transferring ฿50,000.”

Or a fraud/risk engine detects:

> suspicious transfer velocity into mule-like accounts within a short time window.

The business needs to respond quickly, but any wrong action can create harm:

- freeze the wrong account
- refund incorrectly
- miss a real scam
- violate PDPA/privacy rules
- fail AML/compliance audit
- create poor customer experience

### 3.2 Why this is a strong demo

This use case is easy for non-technical stakeholders to understand:

- money is at risk
- time matters
- evidence matters
- decisions are high-risk
- automation cannot be fully trusted without guardrails
- auditability is mandatory

### 3.3 Current Manual Workflow

Assumed current workflow:

1. Customer reports scam/fraud case.
2. Fraud analyst opens several systems manually:
   - transaction ledger
   - account profile/KYC
   - device and IP history
   - counterparty account risk
   - previous fraud case history
   - refund/freeze policy documents
3. Analyst builds a timeline manually.
4. Analyst checks whether freeze/refund/escalation is allowed.
5. Analyst requests approval if needed.
6. Analyst updates case notes and customer response.

Pain points:

- slow evidence gathering
- inconsistent investigation quality
- tool/API failures block workflow
- unclear confidence level
- poor reuse of new scam patterns
- audit packet assembled manually

### 3.4 Proposed OpenSkillTrace Workflow

```text
1. Input
   Scam claim / fraud alert

2. Agent / LLM
   Fraud Investigator Agent

3. Evidence
   Transaction timeline
   Device/IP mismatch
   Mule graph
   KYC/account risk
   Fraud SOP / policy RAG

4. Decision
   Risk classification
   Safe action check

5. Output
   Fraud analyst approval packet
   Capture new scam pattern
```

---

## 4. Information Architecture

The current prototype contains these primary sections:

1. **Overview Dashboard**
2. **Workflow Studio**
3. **Catalogs**
4. **RAG Builder**
5. **Fallback Center**
6. **Eval & Replay**
7. **Governance**

Recommended navigation label style:

```text
Overview
Workflow Studio
Catalogs
RAG Builder
Fallback Center
Eval & Replay
Governance
```

---

## 5. Screen 1: Overview Dashboard

### Purpose

Give stakeholders a high-level view of active workflows, business impact, and configuration areas.

### Key UI Sections

#### 5.1 Workspace Header

Shows current workspace context.

Example:

```text
Shopee Ops Workspace / Monee FraudOps Workspace
Resilient agent workflows
```

For the Monee demo, recommend changing workspace label to:

```text
Monee FraudOps Workspace
Scam & transaction-risk response
```

#### 5.2 Top Search / Command Bar

Purpose:

- global search
- command palette entry point
- search workflows, tools, skills, MCP servers, policies

Example placeholder:

```text
⌘K Search workflows, tools, skills, MCP servers, policies...
```

#### 5.3 Top Actions

Current prototype actions:

- Import from Dify
- Connect MCP
- New workflow

Recommended actions:

- **New workflow** — create from blank or template
- **Connect MCP** — connect enterprise systems
- **Import workflow** — optional; could import from Dify/LangGraph later

#### 5.4 Metrics Cards

Current prototype shows:

- Active workflows
- Eval pass rate
- PII leakage incidents
- Manual evidence time saved

For Monee demo, recommended metrics:

- **Active Fraud Workflows**
- **Replay Eval Pass Rate**
- **Unsafe Action Blocked**
- **Evidence Time Saved**

Example UX copy:

```text
Evidence time saved: 68%
Unsafe action blocked: 12 this month
PII leakage incidents: 0
Replay eval pass rate: 91%
```

Important: if real metrics are unavailable, mark values as demo/sample.

#### 5.5 Workflow Templates

Purpose:

Show high-value starting points.

Recommended templates:

1. **Monee Scam Transaction Response**
   - Claim/alert → evidence → policy check → analyst approval → audit

2. **Monee Mule Account Investigation**
   - Transaction graph → KYC/device risk → AML escalation → case packet

3. **Shopee Campaign Checkout Incident**
   - Alert → logs/metrics → safe mitigation → SRE approval

4. **Garena Match Integrity Anomaly**
   - Telemetry → suspicious behavior → analyst review → false-positive guardrail

#### 5.6 No-code Configuration Summary

Cards should explain what customers configure without code:

- Agent behavior
- Harness routes
- Knowledge/RAG
- Governance

---

## 6. Screen 2: Workflow Studio

This is the most important screen.

### Purpose

Allow non-coders to build and publish production-safe agent workflows.

### Core Layout

```text
Left Panel: Block Library
Center Panel: Workflow Canvas + Harness Layer
Right Panel: Harness Inspector / Preview
```

### Studio Modes

The right panel has two modes:

1. **Harness Inspector**
   - default idle mode
   - shown when no run is active or when a node is selected
   - configures selected-node runtime, tools, RAG, fallback, eval, policy, approval, and audit behavior

2. **Preview**
   - shown while the user is running the workflow
   - behaves like a production workflow runner, not a standalone chatbot
   - sends the user message through the workflow's configured model route
   - streams node lifecycle events, assistant deltas, trace updates, and repair proposals

The left block library and center workflow canvas remain visible in both modes so the user can see how a user message moves through the real workflow.

---

## 7. Workflow Studio: Left Panel — Block Library

### Purpose

The left panel is where users search and drag components into the workflow.

It should make clear that OpenSkillTrace supports:

- input blocks
- agent/LLM blocks
- tool blocks
- MCP server blocks
- RAG blocks
- approval blocks
- output blocks
- harness policy blocks

### Required Features

#### 7.1 Search

Search placeholder:

```text
Search: scam alert, mule, graph, freeze, KYC...
```

Search should support:

- block name
- type
- domain
- permission level
- owner
- eval score
- connector type

#### 7.2 Tabs / Filters

Recommended tabs:

- All
- Input
- Agent
- Tools
- Harness
- RAG
- Approval

Current prototype only shows All/Input/Agent/Harness. UX team may expand this depending on density.

#### 7.3 Block Card Anatomy

Each block card should show:

- icon or type dot
- block name
- block type pill
- short description
- permission / risk badge if relevant

Example:

```text
Input: Scam alert
Type: Input
Description: Customer claim, fraud score spike, suspicious transfer webhook, manual case.
```

#### 7.4 Required Block Types

**Input block**

Purpose:

Starts the agent workflow.

Examples:

- Customer scam claim
- Fraud engine alert
- Suspicious transfer webhook
- Scheduled review
- Manual analyst case
- CSV upload

**Agent / LLM block**

Purpose:

Defines the agent reasoning step.

Config includes:

- model
- prompt
- memory
- reasoning budget
- allowed tools
- allowed RAG sources
- fallback model route
- guardrails

**Tool block**

Purpose:

Connects to operational systems.

Examples:

- ledger timeline
- transaction API
- device risk API
- KYC lookup
- case management
- support ticket system

**MCP block**

Purpose:

Connects MCP servers exposing enterprise capabilities.

Examples:

- device risk MCP
- transaction graph MCP
- observability MCP
- customer support MCP

**RAG block**

Purpose:

Retrieves governed operational knowledge.

Examples:

- fraud SOP
- AML policy
- PDPA policy
- refund/freeze policy
- customer notification scripts
- previous postmortems/cases

**Approval block**

Purpose:

Creates human decision gates.

Examples:

- fraud analyst approval
- senior analyst approval
- compliance approval
- SRE approval

**Output block**

Purpose:

Generates final workflow output.

Examples:

- approval packet
- case note
- customer response draft
- audit packet
- Jira/Slack/Teams update

**Harness block**

Purpose:

Defines safety and reliability controls.

Examples:

- fallback policy
- confidence gate
- PII masking
- replay eval suite
- audit packet generator
- capability capture rule

---

## 8. Workflow Studio: Center Panel — Workflow Canvas

### Purpose

Show the actual agent workflow journey.

Recommended structure:

```text
1. Input
2. Agent / LLM
3. Evidence
4. Decision
5. Output
```

The canvas should not look like a random node graph. For enterprise review, use **numbered swimlanes/cards** so stakeholders can understand the business story quickly.

### Live Run Visualization

When Preview mode is running, each canvas node and connecting edge must expose state:

- **idle** - configured but not reached
- **running** - current workflow step is executing
- **passed** - step completed successfully
- **failed** - step failed and emitted an auditable error
- **healing** - harness is creating sandbox repair artifacts, running replay/eval, or proposing a capability/policy update
- **blocked** - unsafe action was stopped and requires human review

Required visual treatments:

- running nodes pulse subtly with a blue active border
- passed nodes show green completion chips
- failed nodes show red risk state and short failure reason
- healing nodes show orange harness state, repair progress, and artifact count
- active edges animate in the direction of execution
- failed edges turn red until the harness chooses a fallback or repair path
- blocked actions remain visible; do not hide them behind success states

The run visualization must stay tied to the same node IDs used by the saved workflow graph so traces, replay, approval packets, and repair artifacts can link back to the visual canvas.

### Current Monee Workflow

#### Step 1: Input — Scam Claim / Fraud Alert

User story:

> As a fraud analyst, I want scam claims and fraud alerts to start an investigation workflow automatically.

Input example:

```text
Customer: “I was tricked to transfer ฿50,000.”
Risk engine: mule-account pattern detected.
```

Fields:

- customer_id
- transaction_id
- amount
- counterparty account
- timestamp
- claim notes
- source channel
- severity

Harness controls:

- trace input source
- validate schema
- mask PII
- dedupe repeated alerts

#### Step 2: Agent / LLM — Fraud Investigator Agent

User story:

> As a fraud analyst, I want the agent to plan the investigation and collect evidence from approved tools.

Agent responsibilities:

- understand claim context
- decide which tools to call
- ask for policy/RAG context
- classify possible scam/fraud/false positive
- generate evidence summary
- avoid unsafe actions

LLM configuration:

- primary model
- fallback model route
- timeout/circuit breaker
- system prompt
- memory scope
- allowed tools
- allowed RAG sources
- confidence thresholds

Harness controls:

- model fallback
- tool permission check
- prompt/version trace
- confidence gate
- policy gate
- hallucination prevention via evidence/citation requirement

#### Step 3: Evidence — Tools + RAG

User story:

> As a fraud analyst, I want the agent to assemble a complete evidence packet across systems.

Evidence tools:

- transaction ledger
- account/KYC profile
- device/IP history
- login history
- counterparty risk score
- mule graph checker
- case notes
- support ticket history

RAG sources:

- fraud SOP
- AML escalation policy
- refund/freeze policy
- PDPA policy
- customer notification scripts

Harness controls:

- tool fallback route
- RAG grounding eval
- citation required
- data freshness check
- read-only default permission

Fallback examples:

```text
ledger API → warehouse snapshot → Kafka event stream → analyst note
vector search → keyword search → cached SOP → ask senior analyst
```

#### Step 4: Decision — Risk Classification + Safe Action Check

User story:

> As a fraud analyst, I want the agent to recommend the safest next step, but not execute risky actions without approval.

Possible classifications:

- likely scam
- likely account takeover
- mule-account pattern
- false positive
- insufficient evidence

Possible recommended actions:

- create evidence-only packet
- contact customer
- temporary hold
- freeze counterparty account
- refund review
- AML/compliance escalation
- law-enforcement escalation

Harness controls:

- confidence threshold
- policy check
- approval requirement
- unsafe-action block
- missing-evidence detection

Example rule:

```text
If confidence < 80%, block freeze/refund and switch to evidence-only mode.
```

#### Step 5: Output — Approval Packet + Capability Capture

User story:

> As a fraud analyst, I want an approval packet with evidence, confidence, risk, policy citations, and suggested next action.

Output packet includes:

- timeline of events
- transaction graph summary
- evidence table
- risk classification
- confidence score
- recommended next action
- policy citations
- PII masking status
- approve/reject/escalate buttons
- audit trail

Capability capture:

If analyst confirms a new scam pattern, OpenSkillTrace should create a reusable capability after eval/replay validation.

Example:

```text
new_scam_pattern_qr_mule_split_transfer_v1
```

Harness controls:

- human approval
- audit packet
- replay required before capability publish
- versioning
- owner assignment

---

## 9. Harness Layer Requirements

This is the product differentiator.

### 9.1 Visual Requirements

Harness must be visible, not hidden in settings.

Required UI treatments:

1. **Harness rail/frame above workflow**

Shows:

```text
Trace | Fallback | Eval | Policy | Approval | Capture
```

2. **Per-node harness badges**

Examples:

- trace + PII mask
- model + policy
- tool fallback
- grounding eval
- confidence gate
- policy gate
- audit packet
- capability capture

3. **Right panel named Harness Inspector**

Right panel should emphasize harness controls first, not just LLM configuration.

### 9.2 Harness Controls

#### Trace

Captures:

- workflow run ID
- node input/output
- model used
- prompt version
- tool calls
- latency
- confidence
- user/analyst actions
- approval result

#### Model Fallback

Examples:

```text
Claude Sonnet → GPT-4.1 → GLM-4.7 → evidence-template fallback
```

Controls:

- fallback order
- timeout threshold
- circuit breaker
- cost/latency policy
- evidence-only fallback

#### Tool Fallback

Example:

```text
ledger API → warehouse snapshot → Kafka events → analyst note
```

Controls:

- primary tool
- fallback tools
- freshness requirement
- read-only/write permission
- timeout
- failure behavior

#### Skill / Capability Fallback

Example:

```text
specific scam pattern diagnoser → generic fraud checker → evidence template → human analyst
```

Controls:

- preferred capability
- generic fallback capability
- human fallback
- capability capture rule

#### Workflow Fallback

Examples:

- continue in evidence-only mode
- block risky action
- escalate to human
- pause workflow
- generate missing-evidence request

#### Evaluation / Replay

Required before publishing high-risk workflows.

Example replay scenarios:

- confirmed scam case
- false positive VIP transfer
- ledger API down
- mule graph timeout
- refund not allowed
- PII masking
- low-confidence escalation

Metrics:

- pass/fail
- false positive rate
- false negative rate
- unsafe action blocked
- evidence completeness
- citation coverage

#### Policy

Policy controls:

- PDPA masking
- AML escalation
- refund allowed/not allowed
- freeze allowed/not allowed
- data retention
- role-based access

#### Human Approval

Approval gates should support:

- approve
- reject
- request more evidence
- escalate
- add comment

Approval packet should include:

- evidence summary
- confidence score
- policy citations
- model/tool trace
- risk assessment
- expected impact

#### Audit

Audit packet should include:

- who approved
- when approved
- what evidence was used
- what model/tool produced output
- what policy was checked
- what action was executed or blocked

#### Capability Capture

When a new pattern is identified, the product should support:

- capture as draft skill/capability
- attach evidence examples
- generate eval cases
- require owner/reviewer
- publish to catalog only after replay passes

#### Self-Healing Harness

When a node fails during Preview or production run, the harness should:

1. stop unsafe downstream actions
2. classify the failure as model, tool, RAG, policy, schema, permission, or capability gap
3. create sandbox artifacts under `data/harness-runs/{run_id}/`
4. run replay/eval against the proposed repair
5. propose a capability, plugin, policy, fallback route, or prompt/schema update
6. open a human approval modal with full trace, artifacts, eval results, and Approve/Reject actions
7. promote approved artifacts into durable catalog/capability records
8. keep rejected artifacts auditable but inactive

This turns failure into a governed improvement loop: the system can draft repairs, but humans decide whether those repairs become reusable operational capability.

---

## 10. Workflow Studio: Right Panel — Harness Inspector

### Purpose

Configure the selected node when the workflow is idle, and switch to Preview when the workflow is running.

The right panel must never make Preview look like a generic chatbot. Preview is a workflow execution surface: every assistant token, node status, fallback, repair proposal, and approval action must be traceable to the current workflow run.

For the selected **Fraud Investigator Agent** node, the inspector should show:

### 10.1 Selected Node

Fields:

- node name
- node type
- owner
- status
- version

Example:

```text
Fraud Investigator Agent — Step 2
```

### 10.2 LLM Runtime

Fields:

- primary model
- fallback route
- timeout
- circuit breaker
- reasoning mode
- max cost per run
- temperature / deterministic setting

### 10.3 Harness Controls

Fields:

- trace capture
- model fallback
- tool fallback
- workflow fallback
- confidence gate
- approval rule
- audit packet

### 10.4 System Prompt

Prompt editor should include:

- system prompt
- variable placeholders
- policy snippets
- citation requirement
- output schema

Example prompt:

```text
You are a fraud investigation assistant.
Collect evidence first.
Never approve freeze, refund, reversal, or law-enforcement escalation.
Cite policy and show uncertainty.
Escalate if evidence is incomplete.
```

### 10.5 Allowed Capabilities

Show chips/cards for allowed tools and sources:

- ledger_timeline
- device_risk_mcp
- mule_graph
- fraud_sop_rag
- case_notes

Each capability should have:

- permission level
- owner
- eval score
- status
- fallback compatibility

### 10.6 Evaluation Before Publish

Fields:

- replay suite name
- test pass rate
- required scenarios
- last run timestamp
- failure list

### 10.7 Preview Mode

Preview mode replaces the inspector body during a run while preserving the selected workflow context.

Required UI:

- chat input and user bubble
- assistant streaming response area
- workflow process card showing current node, elapsed time, provider route, and run status
- stop button that cancels the client stream and marks the run as stopped
- run log with timestamped lifecycle events
- expandable trace showing node input/output, model, provider, fallback route, tool/RAG calls, policy checks, and eval results
- repair detail modal when the harness proposes a fix

Preview message example:

```text
hi i got scam for 5000 SGD
```

The expected experience is:

1. user submits the message in Preview
2. input node enters running state
3. agent node streams assistant response via configured provider route
4. evidence/tool/RAG nodes animate as they are invoked
5. decision node either completes safely or fails closed
6. output node produces an approval packet, blocked action, or repair proposal

---

## 10A. Workflow Studio Live Preview + Self-Healing Harness

### Summary

Turn `/#studio` into a Dify-style production workflow runner while preserving OpenSkillTrace's core differentiation: every run is governed by trace, fallback, replay/eval, policy, approval, audit, and capability capture.

The Preview chat must use the workflow's configured provider route. It must not fabricate assistant output when provider configuration is missing or rejected.

### End-to-End Run Workflow

```text
1. Analyst opens Workflow Studio
2. Analyst selects or edits the Monee FraudOps workflow
3. Analyst clicks Preview
4. Analyst sends "hi i got scam for 5000 SGD"
5. Backend creates workflow_run and emits run.started
6. Input node validates schema, masks PII, and emits node.completed
7. Agent node calls the configured provider route and streams assistant.delta
8. Evidence nodes call approved tool/RAG capabilities
9. Decision node applies policy, confidence, and unsafe-action gates
10. Output node creates approval packet or safe customer response draft
11. If a node fails, harness enters healing state
12. Harness writes sandbox artifacts under data/harness-runs/{run_id}/
13. Replay/eval runs against the proposed repair
14. Human approval modal opens with trace, artifacts, eval, and proposed promotion
15. Approve promotes the artifact into durable catalog/capability records
16. Reject leaves the run auditable but inactive
```

### Frontend Requirements

Files expected to change during implementation:

- `assets/views-build.js` - add Preview mode to the existing right panel
- `assets/studio.css` - add run state classes and edge animation
- `assets/studio.js` - expose node/edge state updates by stable node ID
- `assets/app.js` - orchestrate stream lifecycle, chat UI state, repair modal, approval actions, and cancellation

Required node and edge classes:

```text
running
passed
failed
healing
blocked
```

Required Preview components:

- chat transcript
- assistant streaming bubble
- workflow process card
- stop responding button
- event log
- expandable trace
- repair detail modal
- approve/reject actions

### Backend Requirements

Add durable JSON-backed collections:

- `workflow_runs`
- `run_events`
- `harness_artifacts`
- `capabilities`

New API surface:

```text
POST /api/workflow-runs/stream
GET  /api/workflow-runs/{run_id}
POST /api/workflow-runs/{run_id}/approval
```

The stream endpoint returns server-sent events. Minimum event contract:

```text
run.started
node.started
assistant.delta
node.completed
node.failed
harness.started
harness.file_created
eval.completed
repair.proposed
run.completed
run.failed
run.stopped
```

Event payloads should include:

- run_id
- workflow_id
- node_id when applicable
- event_type
- status
- timestamp
- provider route step when applicable
- trace reference
- human-readable summary
- artifact path only when inside `data/harness-runs/{run_id}/`

### Provider Route

The run must use the workflow's configured model route:

```text
openai -> local_gpt_oss -> fireworks_gpt_oss
```

Default configuration:

```text
OST_DEFAULT_MODEL=gpt-5.5
OST_MODEL_ROUTE=openai,local_gpt_oss,fireworks_gpt_oss
OST_LOCAL_OPENAI_BASE_URL=http://localhost:11434/v1
OST_FIREWORKS_BASE_URL=https://api.fireworks.ai/inference/v1
FIREWORKS_API_KEY=
OST_SECRET_ENCRYPTION_KEY=
```

Rules:

- OpenAI runs through the server-side `OPENAI_API_KEY`.
- OpenAI-compatible fallbacks use configurable `base_url`, API key, and model ID.
- `gpt-5.5` is a configurable model ID, not a hardcoded guarantee.
- If a provider rejects the model or credentials, the route tries the next configured provider.
- If no provider is configured, the stream must emit a clear failure event and no fake assistant output.
- The frontend never receives plaintext provider keys.

### Provider Key Storage

Upgrade provider-key persistence from masked-only to encrypted-at-rest:

- accept plaintext only on create/update
- encrypt before writing to disk
- return only masked key, fingerprint, provider, status, and metadata
- discard plaintext immediately after encryption
- require `OST_SECRET_ENCRYPTION_KEY` for production encrypted storage
- fail closed in production if encryption is required but unavailable

### Self-Healing Sandbox Artifacts

Failed nodes create artifacts only under:

```text
data/harness-runs/{run_id}/
```

Required files:

```text
manifest.json
summary.md
replay_cases.json
eval_report.json
proposed_capability.json
proposed_policy.json
proposed_plugin.json
```

Not every run creates every proposed artifact. `manifest.json` must list which artifacts were created, which node caused them, and whether approval is allowed.

### Repair Approval Modal

The modal must answer:

- what happened
- what the harness did
- which sandbox files were created
- which replay/eval checks passed or failed
- what capability, plugin, fallback route, prompt/schema, or policy is proposed
- what will change if approved
- what remains inactive if rejected

Approval rules:

- Approve is disabled when required eval checks fail.
- Approve promotes artifact metadata into durable catalog/capability records.
- Reject records reviewer, timestamp, reason, and leaves artifacts inactive.
- Both paths append auditable run events.

### Test Plan

Backend:

- streaming run emits node lifecycle events in order
- missing provider config fails closed with a clear event and no fake assistant output
- provider key plaintext is encrypted or discarded and never returned
- failed node creates sandbox artifacts only under `data/harness-runs/{run_id}/`
- approval promotes artifact metadata
- rejection does not promote artifacts
- replay/eval status blocks approval when required checks fail

Frontend:

- `node --check assets/app.js assets/studio.js assets/views-build.js assets/views-reliability.js`
- run Preview with `hi i got scam for 5000 SGD`
- verify active node animation
- verify failed node red state
- verify harness healing state
- verify repair modal and approval buttons
- verify Stop responding cancels stream UI cleanly

### Assumptions

- Repair artifacts may be written during a run, but only inside `data/harness-runs/{run_id}/` before approval.
- The preview chat is workflow-driven and uses configured provider fallback routes.
- The app stays vanilla JS + FastAPI for this feature.
- Live Preview is a product runner, not a marketing demo and not a fake chatbot.

### External References Checked

- OpenAI Responses streaming over SSE with `stream=True`: https://developers.openai.com/api/docs/guides/streaming-responses
- OpenAI server-side API key guidance: https://developers.openai.com/api/reference/overview#authentication
- OpenAI SDK environment key pattern: https://developers.openai.com/api/docs/libraries
- OpenAI model catalog for `gpt-5.5`: https://developers.openai.com/api/docs/models
- Fireworks OpenAI-compatible `base_url` pattern: https://docs.fireworks.ai/tools-sdks/openai-compatibility

---

## 11. Screen 3: Catalogs

### Purpose

Central marketplace/library of approved capabilities.

Catalog types:

- Skills
- Tools
- MCP servers
- Plugins
- RAG sources
- Harness policies
- Templates

### Catalog Card Anatomy

Each card should show:

- name
- type
- domain
- description
- approval status
- eval score
- permission level
- owner
- version
- action button

Example:

```text
Mule Graph Checker
Type: MCP / Tool
Domain: FraudOps
Status: Approved
Permission: read-only
Eval: 94%
Action: Drag to canvas
```

### Key Actions

- Drag to canvas
- Install
- Connect
- Review
- Publish internal catalog

### Filters

- type
- domain
- governance status
- permission level
- owner
- eval score
- risk level

---

## 12. Screen 4: RAG Builder

### Purpose

Configure governed operational knowledge for agent workflows.

RAG should not be positioned as a generic knowledge base. It is **governed operational knowledge**.

### Knowledge Sources

For Monee FraudOps:

- Fraud SOP
- AML escalation policy
- PDPA policy
- refund/freeze policy
- customer notification scripts
- prior confirmed fraud cases
- dispute resolution guidelines

### Required RAG Features

- add source
- sync source
- indexing status
- PII redaction
- metadata filters
- hybrid search
- reranking
- citation required
- grounding eval
- allowed workflow nodes
- fallback path

### RAG Fallback

Example:

```text
Vector DB → keyword index → cached SOP → ask senior analyst
```

### RAG Node Settings

Fields:

- retrieval mode
- allowed workflow nodes
- grounding policy
- citation requirement
- freshness window
- fallback route

---

## 13. Screen 5: Fallback Center

### Purpose

Configure system-wide and workflow-specific fallback routes.

Fallback layers:

1. Model fallback
2. Tool fallback
3. Skill/capability fallback
4. Workflow fallback

### Feature Requirements

#### Model Fallback

Example:

```text
openai:gpt-5.5 -> local_gpt_oss -> fireworks_gpt_oss -> evidence-template fallback
```

Fields:

- model order
- timeout
- cost guardrail
- latency guardrail
- circuit breaker
- retry count

#### Tool Fallback

Example:

```text
ledger API → warehouse snapshot → Kafka events → analyst note
```

Fields:

- primary tool
- fallback tool
- freshness requirement
- permission
- timeout
- failure message

#### Skill Fallback

Example:

```text
specific scam pattern → generic fraud checker → evidence template → human analyst
```

Fields:

- primary skill
- backup skill
- generic fallback
- human fallback
- confidence threshold

#### Workflow Fallback

Examples:

- evidence-only mode
- human escalation
- stop risky action
- generate missing-evidence task

---

## 14. Screen 6: Eval & Replay

### Purpose

Allow teams to test workflows before production and after changes.

### Key Concepts

- replay historical cases
- test model/tool failures
- test false positives
- test policy violations
- test PII leakage
- test low-confidence behavior

### Replay Suite Example

For Monee:

```text
confirmed scam
false positive VIP transfer
ledger API down
mule graph timeout
refund not allowed
PII masking
low-confidence escalation
AML escalation required
```

### Metrics

- replay pass rate
- evidence completeness
- confidence calibration
- false positive rate
- false negative rate
- unsafe action blocked rate
- grounding/citation score
- PII leakage rate
- approval compliance

### UI Requirements

Replay dashboard should show:

- test scenario list
- pass/fail status
- failure reason
- trace link
- suggested fix
- compare before/after

---

## 15. Screen 7: Governance

### Purpose

Control permissions, policies, approvals, privacy, and audit.

### Required Features

#### Access Control

- role-based access
- workspace permissions
- connector permissions
- read-only vs write action

#### Approval Policy

Define what actions require human approval:

- freeze account
- refund
- reverse transaction
- report to AML/compliance
- contact customer
- disable provider/account

#### Privacy / PII

- mask customer ID
- mask phone/email
- mask account number
- redact transaction references where needed
- define retention policy

#### Audit Export

Export audit packet for:

- internal review
- compliance
- dispute handling
- regulator request

---

## 16. Interaction Requirements

### Drag and Drop

Required behavior:

- drag block from left panel
- drop into canvas lane
- create node
- auto-open right inspector
- show validation status

### Node Selection

When user clicks a node:

- node becomes selected
- right inspector updates
- harness badges remain visible

### Publish Flow

Before publishing:

1. validate schema
2. validate tool permissions
3. run replay eval
4. check approval policies
5. check PII masking
6. generate publish summary

### Run Preview Flow

When the user clicks Preview:

1. create a workflow run
2. switch right panel from Harness Inspector to Preview
3. send the chat message to `POST /api/workflow-runs/stream`
4. apply incoming SSE events to chat, trace, node state, and edge state
5. disable publish while run is active
6. allow Stop responding to cancel the stream and mark the run stopped
7. keep the final trace available after completion

If a failure occurs:

1. failed node enters red failed state
2. harness starts orange healing state
3. repair artifacts are written only under `data/harness-runs/{run_id}/`
4. replay/eval result determines whether approval is allowed
5. approval modal opens with Approve/Reject actions
6. canvas remains linked to the failure and repair trace

### Error / Failure States

Required states:

- model unavailable
- tool unavailable
- RAG source stale
- eval failed
- approval missing
- unsafe action blocked
- PII policy violation
- provider route unavailable
- stream disconnected
- repair artifact invalid
- replay/eval failed during self-healing
- approval blocked by failed eval

### Empty States

Examples:

- no workflows yet
- no catalog item connected
- no RAG source indexed
- no replay suite created

---

## 17. Design System Direction

### Visual Tone

Recommended tone:

- enterprise-grade
- clear and friendly
- high trust
- not too playful
- operational, not marketing-heavy

### Color Semantics

Suggested usage:

- Blue: primary actions / input
- Purple: agent / LLM
- Green: safe / approved / output
- Orange: harness / risk control / fallback
- Red: danger / blocked / violation
- Slate: neutral system surfaces

Run state mapping:

- running: blue active border and subtle pulse
- passed: green completion chip
- failed: red failure border and reason chip
- healing: orange harness pulse and repair artifact chip
- blocked: red/orange blocked action state with approval requirement

### Harness Visual Identity

Harness should have a distinct orange treatment:

- orange frame
- orange badges
- orange inspector section
- orange policy/fallback controls

The goal is for reviewers to immediately say:

> “The orange layer is the harness.”

### Density

The UI can be dense, but must remain scannable.

Use:

- numbered lanes
- short card titles
- visible badges
- compact but readable inspector sections

Avoid:

- messy free-form node graphs in the first review
- too many crossing lines
- generic dashboard cards without meaning

---

## 18. Non-functional Requirements

### Performance

- Canvas should remain usable with 50+ nodes.
- Search should feel instant for catalog items.
- Inspector updates should be immediate.
- Preview stream updates should not re-render the full canvas for every token.
- Node and edge state updates should target stable IDs only.
- Stop responding should cancel the client stream without leaving the UI in running state.

### Security

- No Git write access required by default.
- Tools should default to read-only.
- Write actions require explicit permission and approval.
- PII should be masked in traces and previews.
- Provider keys must be stored server-side only.
- Provider keys must be encrypted at rest or discarded after fingerprinting.
- Plaintext provider keys must never be returned to the frontend.
- Sandbox repair writes are restricted to `data/harness-runs/{run_id}/`.
- Approval must fail closed when required replay/eval checks fail.

### Auditability

Every production run should produce:

- trace ID
- model/tool versions
- input/output snapshot
- approval record
- policy result
- fallback path used
- final action or blocked action
- run event log
- sandbox artifact manifest when repair is attempted
- approval or rejection record for proposed repairs

### Accessibility

- keyboard navigable sidebar
- visible focus states
- readable contrast
- minimum 44px hit targets on interactive controls
- no information conveyed by color alone

---

## 19. MVP Scope

### MVP Must Have

1. Workflow Studio with left/center/right layout
2. Drag/drop block concept
3. Input block
4. Agent/LLM block
5. Tool block
6. RAG block
7. Approval block
8. Harness layer rail/frame
9. Harness Inspector
10. Model fallback configuration
11. Tool fallback configuration
12. Confidence gate
13. Human approval rule
14. Replay eval status
15. Catalog screen
16. RAG Builder screen
17. Fallback Center screen
18. Governance screen
19. Workflow Studio Preview mode
20. Streaming run API
21. Node and edge run states
22. Stop responding behavior
23. Self-healing sandbox artifacts
24. Repair approval modal
25. Provider route fallback
26. Encrypted provider-key persistence

### MVP Nice to Have

1. Import from Dify
2. Advanced MCP marketplace
3. Visual trace replay animation after run completion
4. Capability version diff
5. Multi-workspace analytics
6. In-product AI assistant for building workflows
7. Full background repair jobs for long-running sandbox generation

---

## 20. Open Questions for You

These are the areas where I need your direction before the UX/UI team finalizes screens:

1. **Primary customer/workspace name**  
   Should the prototype be branded around **Monee FraudOps Workspace**, or keep it generic as **OpenSkillTrace Workspace**?

2. **Hero use case**  
   Should Monee scam/fraud response become the main flagship demo, replacing Shopee checkout entirely?

3. **Action scope**  
   Should the agent only create an approval packet, or should the UI show post-approval execution buttons like freeze/refund/escalate?

4. **RAG scope**  
   Should RAG include actual policy document categories like AML, PDPA, refund, freeze SOP, or keep it generic for now?

5. **MCP catalog**  
   Should MCP servers be shown as a major first-class product area, or as one type inside the broader Catalog?

6. **Skill/capability capture**  
   Should capability capture be shown as automatic draft generation, or only as analyst-confirmed/manual capture?

7. **Brand style**  
   Do you want the UI to feel more like Linear/Vercel premium SaaS, or more enterprise dashboard like Datadog/ServiceNow?

8. **Language**  
   Should the UX copy be English-only for team handoff, or bilingual Thai/English like the current prototype context?

9. **Preview default route**  
   Should local development prefer `openai` first, or should it prefer `local_gpt_oss` when a local OpenAI-compatible server is reachable?

10. **Repair approval scope**  
   Should Approve promote only metadata in MVP, or should it also copy sandbox files into durable catalog directories?

11. **Streaming transport**  
   Is SSE enough for MVP, or should the product reserve WebSocket support for multi-turn stateful runs later?

12. **Eval strictness**  
   Which replay/eval failures should block repair approval, and which should be warnings?

---

## 21. Deliverables for UX/UI Team

Current HTML prototype:

```text
/mnt/c/Users/Model/OpenSkillTrace_Product_Wireframes.html
```

Current PRD file:

```text
/mnt/c/Users/Model/OpenSkillTrace_UXUI_PRD.md
```

Public temporary review URL:

```text
https://equipped-psp-courage-estimates.trycloudflare.com
```

Note: public URL is a temporary trycloudflare tunnel. The HTML and PRD files should be used for team handoff.
