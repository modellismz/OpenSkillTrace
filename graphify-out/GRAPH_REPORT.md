# Graph Report - /Users/modellismz/OpenSkillTrace  (2026-06-06)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 372 nodes · 582 edges · 32 communities (25 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `26bfa03e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Studio Canvas Engine|Studio Canvas Engine]]
- [[_COMMUNITY_App Shell Controller|App Shell Controller]]
- [[_COMMUNITY_Static Product Data|Static Product Data]]
- [[_COMMUNITY_Harness And Fallback Controls|Harness And Fallback Controls]]
- [[_COMMUNITY_FastAPI Repository API|FastAPI Repository API]]
- [[_COMMUNITY_Reliability View Rendering|Reliability View Rendering]]
- [[_COMMUNITY_Readme And Local Ops|Readme And Local Ops]]
- [[_COMMUNITY_Graphify Detection Metadata|Graphify Detection Metadata]]
- [[_COMMUNITY_Overview Dashboard UX|Overview Dashboard UX]]
- [[_COMMUNITY_Product Strategy PRD|Product Strategy PRD]]
- [[_COMMUNITY_Block Catalog Requirements|Block Catalog Requirements]]
- [[_COMMUNITY_Harness Inspector UX|Harness Inspector UX]]
- [[_COMMUNITY_Fraud Workflow Canvas|Fraud Workflow Canvas]]
- [[_COMMUNITY_Interaction States|Interaction States]]
- [[_COMMUNITY_Monee Fraud Use Case|Monee Fraud Use Case]]
- [[_COMMUNITY_Workflow Studio Layout|Workflow Studio Layout]]
- [[_COMMUNITY_RAG Builder Requirements|RAG Builder Requirements]]
- [[_COMMUNITY_Eval Replay Requirements|Eval Replay Requirements]]
- [[_COMMUNITY_Backend API Tests|Backend API Tests]]
- [[_COMMUNITY_Design System Direction|Design System Direction]]
- [[_COMMUNITY_Catalog Screen UX|Catalog Screen UX]]
- [[_COMMUNITY_Nonfunctional Requirements|Nonfunctional Requirements]]
- [[_COMMUNITY_Graphify Extraction Schema|Graphify Extraction Schema]]
- [[_COMMUNITY_UX Deliverables Links|UX Deliverables Links]]
- [[_COMMUNITY_Git Push Graph Automation|Git Push Graph Automation]]
- [[_COMMUNITY_Backend Package Metadata|Backend Package Metadata]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]

## God Nodes (most connected - your core abstractions)
1. `OpenSkillTrace UX/UI PRD` - 22 edges
2. `handleAct()` - 15 edges
3. `$()` - 13 edges
4. `JsonRepository` - 11 edges
5. `drawEdges()` - 11 edges
6. `Purpose` - 11 edges
7. `9.2 Harness Controls` - 11 edges
8. `workflow_run_event_stream()` - 11 edges
9. `updateNode()` - 10 edges
10. `Required Features` - 10 edges

## Surprising Connections (you probably didn't know these)
- `make_client()` --calls--> `create_app()`  [INFERRED]
  tests/test_health.py → backend/main.py
- `OpenSkillTrace README` --references--> `OpenSkillTrace UX/UI PRD`  [EXTRACTED]
  README.md → docs/OpenSkillTrace_UXUI_PRD.md
- `previewEls()` --calls--> `$()`  [EXTRACTED]
  app.js → assets/app.js
- `handlePreviewEvent()` --calls--> `$()`  [EXTRACTED]
  app.js → assets/app.js
- `openPreviewPanel()` --calls--> `go()`  [EXTRACTED]
  app.js → assets/app.js

## Communities (32 total, 7 thin omitted)

### Community 0 - "Studio Canvas Engine"
Cohesion: 0.07
Nodes (54): updateNode(), $(), addCatalogItem(), addExistingNode(), addNode(), applyNodeRunState(), applyTransform(), bbox() (+46 more)

### Community 1 - "App Shell Controller"
Cohesion: 0.12
Nodes (47): $(), act, appendChatMessage(), appendPreviewFile(), appendPreviewLog(), catalogFromButton(), closeModal(), createWorkflowNode() (+39 more)

### Community 2 - "Static Product Data"
Cohesion: 0.15
Nodes (25): approve_workflow_run(), create_app(), create_harness_artifact(), encrypt_secret(), encryption_key(), file_record(), get_repo(), install_collection_routes() (+17 more)

### Community 3 - "Harness And Fallback Controls"
Cohesion: 0.07
Nodes (31): 13. Screen 5: Fallback Center, 8. Workflow Studio: Center Panel — Workflow Canvas, 9.1 Visual Requirements, 9.2 Harness Controls, 9. Harness Layer Requirements, Audit, Capability Capture, code:text (Customer: “I was tricked to transfer ฿50,000.”) (+23 more)

### Community 4 - "FastAPI Repository API"
Cohesion: 0.07
Nodes (22): blocks, catalog, catTabs, edges, evalMetrics, evalScenarios, fbRoutes, flow (+14 more)

### Community 5 - "Reliability View Rendering"
Cohesion: 0.13
Nodes (13): cards, cfg, chips, legend, legendTypes, mcards, metrics, nodes (+5 more)

### Community 6 - "Readme And Local Ops"
Cohesion: 0.13
Nodes (15): Agent / LLM Block, Approval Block, Block Library, Harness Block, Harness Inspector, Harness Layer, Input Block, MCP Block (+7 more)

### Community 7 - "Graphify Detection Metadata"
Cohesion: 0.14
Nodes (13): code:bash (python3 -m venv .venv), code:bash (python3 -m pytest tests -q), code:bash (scripts/install-graphify-pre-push-hook.sh), code:bash (GRAPHIFY_PRE_PUSH_FULL=1 git push), Environment, Graphify Automation, OpenSkillTrace, Run Locally (+5 more)

### Community 8 - "Overview Dashboard UX"
Cohesion: 0.15
Nodes (12): files, code, document, image, paper, video, graphifyignore_patterns, needs_graph (+4 more)

### Community 9 - "Product Strategy PRD"
Cohesion: 0.17
Nodes (12): 5.1 Workspace Header, 5.2 Top Search / Command Bar, 5.3 Top Actions, 5.4 Metrics Cards, 5.5 Workflow Templates, 5.6 No-code Configuration Summary, 5. Screen 1: Overview Dashboard, code:text (Shopee Ops Workspace / Monee FraudOps Workspace) (+4 more)

### Community 10 - "Block Catalog Requirements"
Cohesion: 0.17
Nodes (12): OpenSkillTrace UX/UI PRD, 1. Product Positioning, 20. Open Questions for You, 21. Deliverables for UX/UI Team, 2. Primary UX Goal, 4. Information Architecture, code:text (Overview), code:text (/mnt/c/Users/Model/OpenSkillTrace_Product_Wireframes.html) (+4 more)

### Community 11 - "Harness Inspector UX"
Cohesion: 0.18
Nodes (11): 7.1 Search, 7.2 Tabs / Filters, 7.3 Block Card Anatomy, 7.4 Required Block Types, Access Control, Approval Policy, Audit Export, code:text (Search: scam alert, mule, graph, freeze, KYC...) (+3 more)

### Community 12 - "Fraud Workflow Canvas"
Cohesion: 0.22
Nodes (9): 10.1 Selected Node, 10.2 LLM Runtime, 10.3 Harness Controls, 10.4 System Prompt, 10.5 Allowed Capabilities, 10.6 Evaluation Before Publish, 10. Workflow Studio: Right Panel — Harness Inspector, code:text (Fraud Investigator Agent — Step 2) (+1 more)

### Community 13 - "Interaction States"
Cohesion: 0.33
Nodes (6): 12. Screen 4: RAG Builder, code:text (Vector DB → keyword index → cached SOP → ask senior analyst), Knowledge Sources, RAG Fallback, RAG Node Settings, Required RAG Features

### Community 14 - "Monee Fraud Use Case"
Cohesion: 0.33
Nodes (6): 16. Interaction Requirements, Drag and Drop, Empty States, Error / Failure States, Node Selection, Publish Flow

### Community 15 - "Workflow Studio Layout"
Cohesion: 0.33
Nodes (6): 3.1 Business Problem, 3.2 Why this is a strong demo, 3.3 Current Manual Workflow, 3.4 Proposed OpenSkillTrace Workflow, 3. Hero Use Case: Monee Real-time Scam/Fraud Transaction Response Agent, code:text (1. Input)

### Community 16 - "RAG Builder Requirements"
Cohesion: 0.33
Nodes (6): 14. Screen 6: Eval & Replay, code:text (confirmed scam), Key Concepts, Metrics, Replay Suite Example, UI Requirements

### Community 17 - "Eval Replay Requirements"
Cohesion: 0.33
Nodes (6): 15. Screen 7: Governance, 6. Screen 2: Workflow Studio, 7. Workflow Studio: Left Panel — Block Library, code:text (Left Panel: Block Library), Core Layout, Purpose

### Community 18 - "Backend API Tests"
Cohesion: 0.6
Nodes (5): make_client(), test_agentops_workflow_crud_persists_graph(), test_health_endpoint_reports_service_status(), test_provider_key_is_never_returned_as_plaintext(), test_settings_and_investigation_flow()

### Community 19 - "Design System Direction"
Cohesion: 0.4
Nodes (5): 17. Design System Direction, Color Semantics, Density, Harness Visual Identity, Visual Tone

### Community 20 - "Catalog Screen UX"
Cohesion: 0.4
Nodes (5): 18. Non-functional Requirements, Accessibility, Auditability, Performance, Security

### Community 21 - "Nonfunctional Requirements"
Cohesion: 0.4
Nodes (5): 11. Screen 3: Catalogs, Catalog Card Anatomy, code:text (Mule Graph Checker), Filters, Key Actions

### Community 22 - "Graphify Extraction Schema"
Cohesion: 0.4
Nodes (4): edges, input_tokens, nodes, output_tokens

### Community 23 - "UX Deliverables Links"
Cohesion: 0.67
Nodes (3): 19. MVP Scope, MVP Must Have, MVP Nice to Have

## Knowledge Gaps
- **172 isolated node(s):** `code`, `document`, `paper`, `image`, `video` (+167 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `OpenSkillTrace UX/UI PRD` connect `Block Catalog Requirements` to `Harness And Fallback Controls`, `Graphify Detection Metadata`, `Product Strategy PRD`, `Fraud Workflow Canvas`, `Interaction States`, `Monee Fraud Use Case`, `Workflow Studio Layout`, `RAG Builder Requirements`, `Eval Replay Requirements`, `Design System Direction`, `Catalog Screen UX`, `Nonfunctional Requirements`, `UX Deliverables Links`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **Why does `OpenSkillTrace` connect `FastAPI Repository API` to `Studio Canvas Engine`, `App Shell Controller`, `Reliability View Rendering`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `updateNode()` connect `Studio Canvas Engine` to `App Shell Controller`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **What connects `code`, `document`, `paper` to the rest of the system?**
  _173 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Studio Canvas Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `App Shell Controller` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
- **Should `Harness And Fallback Controls` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._