# OpenSkillTrace UX/UI PRD

**Product:** OpenSkillTrace  
**Module:** Low-code AgentOps Workflow Platform  
**Primary demo use case:** Monee Real-time Scam/Fraud Transaction Response Agent  
**Audience:** UX/UI design team, product design, frontend engineering, product strategy  
**Version:** Draft v1  
**Date:** 2026-06-04

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
Right Panel: Harness Inspector
```

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

---

## 10. Workflow Studio: Right Panel — Harness Inspector

### Purpose

Configure the selected node.

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
Claude → GPT-4.1 → GLM-4.7 → evidence-template fallback
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

### Error / Failure States

Required states:

- model unavailable
- tool unavailable
- RAG source stale
- eval failed
- approval missing
- unsafe action blocked
- PII policy violation

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

### Security

- No Git write access required by default.
- Tools should default to read-only.
- Write actions require explicit permission and approval.
- PII should be masked in traces and previews.

### Auditability

Every production run should produce:

- trace ID
- model/tool versions
- input/output snapshot
- approval record
- policy result
- fallback path used
- final action or blocked action

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

### MVP Nice to Have

1. Import from Dify
2. Advanced MCP marketplace
3. Visual trace replay animation
4. Auto-generated capability spec
5. Capability version diff
6. Multi-workspace analytics
7. In-product AI assistant for building workflows

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
