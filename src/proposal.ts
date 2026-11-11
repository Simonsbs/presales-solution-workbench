import {
  analyse,
  BLUEPRINTS,
  CRITERIA,
  money,
  SECTIONS,
  staleEdits,
  systemNames,
  validateDraft,
} from "./model.ts";
import type {
  Analysis,
  Candidate,
  Draft,
  OptionId,
  SectionId,
} from "./model.ts";

export interface PocCriterion {
  id: string;
  name: string;
  method: string;
  target: string;
  owner: string;
  evidence: string;
}
export function pocCriteria(draft: Draft): PocCriterion[] {
  const b = draft.brief;
  const e = analyse(draft).candidates[0].estimate;
  return [
    {
      id: "POC-01",
      name: "End-to-end freshness",
      method:
        "Send 1,000 uniquely identified synthetic events and timestamp source acceptance and receiver commit.",
      target: `p95 end-to-end delivery <= ${b.maxLatencySeconds} seconds; report max, p50, p95 and all failures.`,
      owner: "Application lead",
      evidence: "Timestamped source/receiver log and percentile calculation",
    },
    {
      id: "POC-02",
      name: "Duplicate and ordering safety",
      method:
        "Repeat the same event ID ten times and deliver a newer version before an older one.",
      target:
        "One business effect for the repeated event; the older version never rolls back current state.",
      owner: "Integration lead",
      evidence: "Idempotency receipts and before/after state",
    },
    {
      id: "POC-03",
      name: "Outage recovery",
      method: `Make the downstream unavailable for ${b.outageMinutes} minutes, then restore it.`,
      target: `Reconcile 100% of accepted synthetic events within ${b.recoveryMinutes} minutes after restoration; report loss, duplicates and dead letters.`,
      owner: "Operations lead",
      evidence: "Accepted-event reconciliation, backlog chart and replay audit",
    },
    {
      id: "POC-04",
      name: "Peak and growth allowance",
      method: `Run a five-minute burst at ${e.plannedPeak.toLocaleString("en-GB")} events/minute, including the entered growth and headroom.`,
      target: `No accepted-event loss; meet the ${b.maxLatencySeconds}s p95 target during the test or record the constraint as unmet.`,
      owner: "Performance test owner",
      evidence:
        "Load configuration, resource metrics, latency distribution and reconciliation",
    },
    {
      id: "POC-05",
      name: "Data boundary and access",
      method:
        b.dataPolicy === "private-only"
          ? "Inspect network flows while exercising success, failure, logging and replay. Test unauthorised requests."
          : "Verify approved processors, deployment locations, least-privilege access and minimal event fields. Test unauthorised requests.",
      target:
        b.dataPolicy === "private-only"
          ? "No event data leaves the private boundary; unauthorised requests are rejected and auditable."
          : `Processing follows the approved boundary${b.requireRegion ? ` and verified location (${b.region || "location still to be approved"})` : ""}; unauthorised requests are rejected.`,
      owner: "Security reviewer",
      evidence: "Configuration export, access-denial logs and boundary review",
    },
    {
      id: "POC-06",
      name: "Operational handover",
      method:
        "Ask the named operating team to diagnose a failed event, replay it and restore from the documented recovery path.",
      target:
        "The owner completes the exercise using the runbook; open actions have owners and dates before acceptance.",
      owner: b.decisionOwner,
      evidence: "Observed walkthrough, runbook and signed acceptance checklist",
    },
  ];
}
export function generatedSections(
  draft: Draft,
  analysis = analyse(draft),
): Record<SectionId, string> {
  const b = draft.brief,
    r = analysis.recommended;
  return {
    summary: `${b.project} is a fictional discovery scenario. ${b.goal}\n\n${r ? `Proposed direction to validate: ${r.blueprint.name}. It clears the modelled hard constraints and has a weighted score of ${r.score}/100. ${r.blueprint.tradeoff}` : "No modelled option satisfies the current hard constraints. Resolve the conflicts before selecting an implementation."}`,
    scope: `In scope: ${b.integrations}\n\nCurrent systems: ${systemNames(b.systems).join(", ")}.\n\nOut of scope: a production rollout, a vendor commitment, legal or regulatory certification, and any unconfirmed customer outcome. Confirm mappings, ownership and access during discovery.`,
    assumptions: `These are planning blueprints, not verified product configurations.\n${(r?.blueprint.assumptions ?? ["Resolve the blocked requirements before committing to a blueprint."]).map((x) => `- ${x}`).join("\n")}\n- Named decision owner: ${b.decisionOwner}.\n- Workload, growth, headroom, rate inputs and recovery targets require stakeholder review.\n- ${draft.costs.confirmed ? "Rates were marked reviewed by the user for this brief revision; they remain planning assumptions." : "Cost inputs are illustrative or unreviewed."}`,
    risks: r
      ? `- ${r.blueprint.tradeoff}\n- Connector behaviour, delivery guarantees and operational lead times remain unproven: use the PoC criteria before acceptance.\n- Data location, access, retention and logging need a security review.\n- Scope or workload changes invalidate the current estimate: revisit discovery and rerun the comparison.\n${r.conditions.map((c) => `- Open condition: ${c}`).join("\n")}`
      : "Every modelled option is blocked.\n" +
        analysis.candidates
          .map((c) => `- ${c.blueprint.shortName}: ${c.blockers.join(" ")}`)
          .join("\n"),
    delivery: r
      ? `Planning allowance: ${r.weeks} weeks, subject to scope and staffing validation.\n1. Discovery and contract design: confirm field ownership, access, boundary and success measures.\n2. Thin-slice PoC: one flow, synthetic data, recovery instrumentation and the six acceptance checks.\n3. Incremental implementation: adapters, mappings, idempotency, failure handling and reconciliation.\n4. Acceptance and handover: run the agreed tests, record exceptions, assign owners and decide whether to proceed.\nNo production delivery date is committed by this model.`
      : "Discovery only: identify which boundary, staffing, deadline or budget constraints can be changed. Re-evaluate the options, then define a scoped PoC. No implementation schedule is proposed while all options are blocked.",
  };
}
export function sectionText(
  draft: Draft,
  id: SectionId,
  analysis = analyse(draft),
) {
  return draft.edits[id]?.text ?? generatedSections(draft, analysis)[id];
}
export function decisionRecord(
  draft: Draft,
  analysis = analyse(draft),
): string {
  const r = analysis.recommended;
  return [
    "# ADR-001: Integration direction",
    "",
    "Status: Proposed. Fictional discovery exercise; no customer sign-off.",
    "",
    `Brief revision: ${draft.revision}`,
    "",
    "## Context",
    draft.brief.goal,
    `Data boundary: ${draft.brief.dataPolicy}. Freshness: ${draft.brief.maxLatencySeconds}s. Delivery window: ${draft.brief.deadlineWeeks} weeks. Team: ${draft.brief.team}.`,
    "",
    "## Proposed decision",
    r
      ? `${r.blueprint.name}, subject to PoC and open conditions. Score: ${r.score}/100.`
      : "No feasible option. Resolve the hard-constraint conflicts first.",
    "",
    "## Considered and rejected alternatives",
    ...analysis.candidates.map(
      (c) =>
        `- ${c.blueprint.name}: ${c === r ? "proposed" : "not selected"}; ${c.status}; score ${c.score}/100. ${c.blockers.length ? c.blockers.join(" ") : c === r ? "Highest ranked eligible blueprint after the fit/conditional tier, score and cost tie-breaks." : "Lower rank under the stated criteria; changing weights or assumptions can change this result."} ${c.conditions.join(" ")}`,
    ),
    "",
    "## Consequences",
    r?.blueprint.tradeoff ??
      "A delivery commitment would be unsupported until constraints are reconciled.",
    "",
    "## Review triggers",
    "A change in boundary, staffing, deadline, workload, costs or priorities requires a new comparison. An accepted ADR would be superseded by a new decision rather than silently rewritten.",
    "",
    "## Method",
    "Hard constraints take precedence. Eligible options rank by fit before conditional status, weighted score, recurring cost and fixed catalogue order. Ratings are declared planning judgements, not measured vendor benchmarks.",
  ]
    .join("\n")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
export function proposalMarkdown(
  draft: Draft,
  at = new Date().toISOString(),
): string {
  validateDraft(draft);
  const a = analyse(draft),
    r = a.recommended,
    stale = staleEdits(draft),
    currency = draft.costs.currency;
  const esc = (s: string) =>
    s.replace(/[<>]/g, (c) => (c === "<" ? "&lt;" : "&gt;"));
  return [
    `# ${esc(draft.brief.project)}: proposed solution`,
    "",
    "> DRAFT FOR REVIEW. Fictional or user-entered scenario. Not a binding quotation, verified architecture, customer win or regulatory approval.",
    `Generated: ${at}. Brief revision ${draft.revision}. Model version 1.`,
    stale.length
      ? `REVIEW REQUIRED: edited sections are based on an earlier brief revision: ${stale.join(", ")}.`
      : "",
    ...(Object.keys(SECTIONS) as SectionId[]).flatMap((id) => [
      "",
      `## ${SECTIONS[id]}`,
      draft.edits[id]
        ? `Author-edited section, based on revision ${draft.edits[id]!.basedOnRevision}${stale.includes(id) ? "; STALE, review required" : "; user review required"}.`
        : "Generated from the current structured brief.",
      esc(sectionText(draft, id, a)),
    ]),
    "",
    "## Modelled decision and estimates",
    r
      ? `Proposed option: ${r.blueprint.name}; weighted score ${r.score}/100.`
      : "No option clears the hard constraints.",
    `Cost status: ${draft.costs.confirmed ? "user-marked reviewed planning assumptions" : "ILLUSTRATIVE / UNREVIEWED"}. Currency: ${currency}. Rates are not a vendor quotation. Currency changes relabel amounts; there is no exchange-rate conversion.`,
    "",
    ...a.candidates.map(
      (c) =>
        `- ${c.blueprint.name}: ${c.status}; ${money(c.estimate.monthlyCents, currency)}/month; ${money(c.estimate.setupCents, currency)} one-off; ${money(c.estimate.yearOneCents, currency)} year one; ${c.weeks} modelled weeks. ${c.blockers.join(" ")}`,
    ),
    "",
    "### Calculation",
    `Planned monthly events = ceil(${draft.brief.monthlyEvents} × (1 + ${draft.brief.growthPercent}/100) × (1 + ${draft.brief.headroomPercent}/100)) = ${a.candidates[0].estimate.plannedEvents}.`,
    `Monthly cost = fixed monthly + round(planned events / 1,000 × rate per 1,000) + round(operations hours × hourly rate). Each cost line rounds to cents before summing.`,
    `One-off cost = round(implementation hours × hourly rate) + migration cost. Year one = 12 × monthly + one-off.`,
    `Traffic is modelled pro-rata; actual product billing may differ. Taxes, discounts, financing, inflation and exchange-rate conversion are excluded. No ROI is calculated.`,
    "",
    "## Decision criteria",
    ...(Object.keys(CRITERIA) as (keyof typeof CRITERIA)[]).map(
      (k) => `- ${CRITERIA[k]}: weight ${draft.weights[k]}/5.`,
    ),
    "",
    "## PoC acceptance plan",
    ...pocCriteria(draft).flatMap((c) => [
      "",
      `### ${c.id}: ${c.name}`,
      `Method: ${c.method}`,
      `Target: ${c.target}`,
      `Proposed owner: ${c.owner}`,
      `Evidence: ${c.evidence}`,
    ]),
    "",
    "## Stakeholders",
    esc(draft.brief.stakeholders),
    `Decision owner: ${esc(draft.brief.decisionOwner)}.`,
    "",
    "## Approval boundary",
    "All acceptance criteria are proposed tests, not completed test results. Verify owners, product capabilities, inputs and estimates before making a customer commitment. Free-text requirements must also be reflected in the structured fields to affect the model.",
  ]
    .filter((x) => x !== undefined)
    .join("\n")
    .replaceAll("<", "&lt;");
}
export function architectureNodes(id: OptionId) {
  return id === "workflow"
    ? [
        { title: "Business systems", sub: "Sources and targets" },
        { title: "Managed workflows", sub: "Connectors + scheduled flows" },
        { title: "Operations console", sub: "Retries + reconciliation" },
      ]
    : id === "events"
      ? [
          {
            title: "Source + local outbox",
            sub: "Contract + store and forward",
          },
          {
            title: "Regional message broker",
            sub: "Durable queue + dead letters",
          },
          { title: "Idempotent consumers", sub: "Mappings + receipt store" },
        ]
      : [
          { title: "Private source adapters", sub: "Contract + local outbox" },
          {
            title: "Private broker + services",
            sub: "Customer-operated runtime",
          },
          {
            title: "Private business systems",
            sub: "Receipts + reconciliation",
          },
        ];
}
const xml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
export function architectureSvg(
  draft: Draft,
  candidate: Candidate | null = analyse(draft).recommended,
): string {
  const title =
    candidate?.blueprint.name ?? "No feasible architecture selected";
  const nodes = candidate
    ? architectureNodes(candidate.blueprint.id)
    : [
        {
          title: "Conflicting constraints",
          sub: "Resolve boundary, team, timeline or cost",
        },
      ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="380" viewBox="0 0 1120 380" role="img" aria-labelledby="title desc"><title id="title">${xml(draft.brief.project)}: ${xml(title)}</title><desc id="desc">Conceptual planning diagram. Fictional scenario. Assumptions require a PoC.</desc><rect width="1120" height="380" rx="18" fill="#f6f7f2"/><text x="40" y="50" font-family="sans-serif" font-size="13" fill="#52685c">SOLUTION WORKBENCH / CONCEPTUAL DRAFT</text><text x="40" y="88" font-family="sans-serif" font-size="24" font-weight="bold" fill="#173a31">${xml(title)}</text><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="#456c5d"/></marker></defs>${nodes.map((node, i) => `<rect x="${40 + i * 355}" y="145" width="330" height="110" rx="12" fill="#fff" stroke="#cad7cc"/><text x="${62 + i * 355}" y="187" font-family="sans-serif" font-size="18" fill="#173a31">${xml(node.title)}</text><text x="${62 + i * 355}" y="218" font-family="sans-serif" font-size="13" fill="#52685c">${xml(node.sub)}</text>${i < nodes.length - 1 ? `<path d="M${373 + i * 355} 200h18" stroke="#456c5d" stroke-width="2" marker-end="url(#arrow)"/>` : ""}`).join("")}<text x="40" y="310" font-family="sans-serif" font-size="13" fill="#52685c">Data boundary: ${xml(draft.brief.dataPolicy)}. Target freshness: ${draft.brief.maxLatencySeconds}s. Revision ${draft.revision}.</text><text x="40" y="340" font-family="sans-serif" font-size="13" fill="#52685c">Conceptual topology only. No deployment, vendor guarantee or completed PoC is implied.</text></svg>`;
}
export function pocCsv(draft: Draft): string {
  const cell = (v: string) =>
    `"${(/^[\s]*[=+@\-]/.test(v) ? "'" : "") + v.replaceAll('"', '""')}"`;
  return (
    [
      ["ID", "Criterion", "Method", "Target", "Proposed owner", "Evidence"],
      ...pocCriteria(draft).map((c) => [
        c.id,
        c.name,
        c.method,
        c.target,
        c.owner,
        c.evidence,
      ]),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n") + "\r\n"
  );
}
export function proposalFiles(
  draft: Draft,
  at = new Date().toISOString(),
): Record<string, string> {
  return {
    "README.txt":
      "Solution Workbench proposal pack.\nDRAFT FOR REVIEW. Fictional or user-entered scenario.\nNo vendor quote, completed PoC, customer win or compliance certification is implied.\nImport brief.json into the app to continue editing. Generated analysis remains separate from authored proposal wording.\nCurrency is a label, not an exchange-rate conversion. Review stale sections and all assumptions before sharing.\n",
    "brief.json": JSON.stringify(validateDraft(draft), null, 2) + "\n",
    "proposal.md": proposalMarkdown(draft, at),
    "architecture.svg": architectureSvg(draft),
    "poc-plan.csv": pocCsv(draft),
    "decision-record.md": decisionRecord(draft),
    "analysis.json":
      JSON.stringify(
        {
          modelVersion: 1,
          generatedAt: at,
          scope:
            "Planning model only; not verified provider capability or current vendor pricing",
          analysis: analyse(draft),
        },
        null,
        2,
      ) + "\n",
  };
}
