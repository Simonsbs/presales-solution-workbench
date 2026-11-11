# Technical Presales Solution Workbench

A standalone discovery, architecture comparison and proposal workbench. Three fictional customer workshops make the connection between requirements, constraints, costs and a proposed PoC inspectable.

**[Public demo](https://presales.bestdev.co.il/)** · **[Source](https://github.com/Simonsbs/presales-solution-workbench)** · [Architecture and decisions](BUILD_NOTES.md) · [Validation](VALIDATION.md)

## Five-minute walkthrough

1. Open **Northstar Retail**. Review its business goal, three current systems, stakeholders, integration scope and operating constraints.
2. Open **Compare options**. The managed-workflow baseline leads under the initial priorities. Inspect its constraints, ratings and cost line items.
3. Return to discovery and select **Introduce this constraint**. A five-second delivery requirement is added and the previous brief is pinned. The 60-second workflow baseline is blocked and the cloud event blueprint becomes the proposed direction.
4. Open **Proposal & PoC**, edit a section, then change a structured input. Your wording remains and is flagged for review against the changed brief.
5. Download the proposal pack. Re-import `brief.json` to continue the same workshop.

Try **Harbour Services** for a private-boundary scenario that becomes infeasible when platform ownership is removed. **Lumen Manufacturing** moves from cloud events to a private service when public cloud processing is disallowed. These names, requirements, rates and delivery allowances are invented examples, not customer work.

## What is implemented

- Guided business goals, systems, stakeholders, integration scope and decision ownership.
- Explicit boundary, region, connectivity, freshness, recovery, staffing, timing and budget constraints.
- Three provider-neutral blueprints, hard gates, five weighted criteria and score contributions.
- Editable planning rates, monthly traffic, independent peak load, growth and headroom. Cost lines reconcile in integer cents. Currency is a label; changing it does not convert amounts.
- A pinned before/after brief and explanations of every blocked option.
- A conceptual architecture diagram, proposed decision record, editable proposal sections and six measurable PoC acceptance checks.
- Authored wording preserved across input changes, with stale-review flags in the UI and exports.
- Browser-local saving, recovery of invalid saved data, validated JSON import and a seven-file ZIP export.

The pack contains `brief.json`, `proposal.md`, `architecture.svg`, `poc-plan.csv`, `decision-record.md`, `analysis.json` and `README.txt`. The proposal and ADR remain proposed drafts. PoC criteria describe future tests, not completed test results.

## Run locally

Requirements: Node 22.18 or newer and npm. No API key, cloud account, database or AI service is required.

```sh
npm ci
npm run check
npm test
npm run validate
npm run build
npm run dev
```

Open `http://127.0.0.1:5176/`. `validate` records scenario decisions, calculations, actual ZIP round trips and local evaluation timings under `docs/validation/domain.json`. Use `-- --output artifacts/domain.json` to keep an additional run outside tracked evidence.

```sh
npm run smoke -- --url https://presales.bestdev.co.il --output artifacts/public-smoke.json
```

The build compiles React, then embeds the application, local fonts, documentation and validation JSON in a Worker ES module. The build artifact check exercises that actual compiled Worker. CI runs on Windows and Linux. No browser-control test harness is hidden inside the app.

## Data and scope

The public Worker serves files and a source-fingerprinted health response. Drafts, imports, calculations and exports remain in the visitor's browser. There is no account system, AI inference, server-side draft store or application analytics. Export before switching scenarios or clearing browser storage. Only one active draft is saved per origin; a pinned baseline belongs to that draft. A separate deployment hostname has separate browser storage.

All rate inputs are illustrative until reviewed by the user and remain planning assumptions after review. Capability ratings, latency baselines and lead times are declared workshop assumptions. They do not establish current product capabilities, vendor prices, a delivery commitment, production performance, regulatory approval or a customer win. The tool does not calculate ROI or produce a binding quotation.
