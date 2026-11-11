export type OptionId = "workflow" | "events" | "private";
export type Criterion =
  "speed" | "operations" | "flexibility" | "reliability" | "cost";
export type SectionId =
  "summary" | "scope" | "assumptions" | "risks" | "delivery";
export const CRITERIA: Record<Criterion, string> = {
  speed: "Time to value",
  operations: "Ease of operation",
  flexibility: "Change flexibility",
  reliability: "Failure recovery",
  cost: "Recurring cost",
};
export const SECTIONS: Record<SectionId, string> = {
  summary: "Executive summary",
  scope: "Scope and boundaries",
  assumptions: "Assumptions to validate",
  risks: "Risks and mitigations",
  delivery: "Implementation outline",
};
export interface Brief {
  project: string;
  goal: string;
  systems: string;
  integrations: string;
  stakeholders: string;
  decisionOwner: string;
  dataPolicy: "flexible" | "approved-cloud" | "private-only";
  requireRegion: boolean;
  region: string;
  connectivity: "stable" | "intermittent";
  maxLatencySeconds: number;
  outageMinutes: number;
  recoveryMinutes: number;
  team: "managed-only" | "application" | "platform";
  deadlineWeeks: number;
  monthlyEvents: number;
  peakEventsPerMinute: number;
  growthPercent: number;
  headroomPercent: number;
  monthlyBudget: number | null;
}
export interface CostInput {
  fixedMonthly: number;
  perThousand: number;
  opsHours: number;
  setupHours: number;
}
export interface CostModel {
  currency: "GBP" | "USD" | "ILS" | "EUR";
  hourlyRate: number;
  migrationCost: number;
  confirmed: boolean;
  options: Record<OptionId, CostInput>;
}
export interface Edit {
  text: string;
  basedOnRevision: number;
}
export interface Draft {
  schemaVersion: 1;
  kind: "presales-workbench";
  scenarioId: string;
  revision: number;
  brief: Brief;
  costs: CostModel;
  weights: Record<Criterion, number>;
  edits: Partial<Record<SectionId, Edit>>;
  baseline: Baseline | null;
}
export interface Baseline {
  brief: Brief;
  costs: CostModel;
  weights: Record<Criterion, number>;
  revision: number;
}
export interface Blueprint {
  id: OptionId;
  name: string;
  shortName: string;
  tag: string;
  description: string;
  minLatencySeconds: number;
  baseWeeks: number;
  ratings: Record<Exclude<Criterion, "cost">, number>;
  assumptions: string[];
  tradeoff: string;
}
export const BLUEPRINTS: Blueprint[] = [
  {
    id: "workflow",
    name: "Managed integration workflows",
    shortName: "Managed workflows",
    tag: "CONFIGURE & CONNECT",
    description:
      "Prebuilt connectors, scheduled flows and a hosted operations console.",
    minLatencySeconds: 60,
    baseWeeks: 4,
    ratings: { speed: 5, operations: 5, flexibility: 2, reliability: 3 },
    assumptions: [
      "The baseline uses scheduled triggers with a 60-second minimum interval.",
      "Required connectors and retry controls exist in a shortlisted platform.",
      "This baseline has no local store-and-forward agent or customer-pinned region.",
    ],
    tradeoff:
      "Quick configuration and less platform ownership, in exchange for connector limits and less control over execution.",
  },
  {
    id: "events",
    name: "Cloud event integration",
    shortName: "Cloud event integration",
    tag: "DECOUPLE & RECOVER",
    description:
      "A source adapter, durable message broker and independently deployed consumers.",
    minLatencySeconds: 1,
    baseWeeks: 7,
    ratings: { speed: 3, operations: 3, flexibility: 5, reliability: 5 },
    assumptions: [
      "A regional cloud deployment is permitted and its location will be verified.",
      "The application team owns contracts, idempotent consumers and support.",
      "A local outbox bridge buffers source events during connection loss.",
    ],
    tradeoff:
      "Strong recovery controls and independent changes require application engineering and asynchronous troubleshooting.",
  },
  {
    id: "private",
    name: "Private integration service",
    shortName: "Private integration service",
    tag: "CONTROL THE BOUNDARY",
    description:
      "Customer-operated adapters, broker and services inside a private boundary.",
    minLatencySeconds: 2,
    baseWeeks: 11,
    ratings: { speed: 2, operations: 1, flexibility: 4, reliability: 4 },
    assumptions: [
      "A platform team can patch, monitor, back up and restore the runtime.",
      "A local durable outbox and redundant broker are in the scoped design.",
      "Infrastructure location and failover capacity are customer-controlled.",
    ],
    tradeoff:
      "Direct boundary control adds infrastructure ownership, upgrade work and a longer implementation lead time.",
  },
];
export interface Estimate {
  fixedCents: number;
  trafficCents: number;
  operationsCents: number;
  monthlyCents: number;
  setupCents: number;
  yearOneCents: number;
  plannedEvents: number;
  plannedPeak: number;
}
export interface Candidate {
  blueprint: Blueprint;
  estimate: Estimate;
  weeks: number;
  blockers: string[];
  conditions: string[];
  status: "fit" | "conditional" | "blocked";
  score: number;
  ratings: Record<Criterion, number>;
  contributions: Record<Criterion, number>;
}
export interface Analysis {
  candidates: Candidate[];
  recommended: Candidate | null;
  weightTotal: number;
  warnings: string[];
}
export class ValidationError extends Error {
  issues: string[];
  constructor(issues: string[]) {
    super(issues.join(" "));
    this.issues = issues;
  }
}
const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const only = (
  v: unknown,
  keys: string[],
  label: string,
): Record<string, unknown> => {
  if (!isObject(v) || Object.keys(v).some((k) => !keys.includes(k)))
    throw new ValidationError([`${label} has an unsupported shape or field.`]);
  return v;
};
export function validateDraft(value: unknown): Draft {
  const v = only(
    value,
    [
      "schemaVersion",
      "kind",
      "scenarioId",
      "revision",
      "brief",
      "costs",
      "weights",
      "edits",
      "baseline",
    ],
    "Draft",
  );
  const issues: string[] = [];
  const text = (x: unknown, max: number, label: string, required = false) => {
    if (typeof x !== "string" || x.length > max || (required && !x.trim()))
      issues.push(
        `${label}: enter ${required ? "non-empty " : ""}text, up to ${max} characters.`,
      );
  };
  const number = (
    x: unknown,
    min: number,
    max: number,
    label: string,
    integer = false,
  ) => {
    if (
      typeof x !== "number" ||
      !Number.isFinite(x) ||
      x < min ||
      x > max ||
      (integer && !Number.isInteger(x)) ||
      (!integer && Math.abs(x * 100 - Math.round(x * 100)) > 0.000001)
    )
      issues.push(
        `${label}: enter ${integer ? "a whole number" : "a number with at most two decimal places"} from ${min} to ${max}.`,
      );
  };
  const choice = (x: unknown, choices: readonly unknown[], label: string) => {
    if (!choices.includes(x))
      issues.push(`${label}: choose a supported value.`);
  };
  if (v.schemaVersion !== 1 || v.kind !== "presales-workbench")
    issues.push("Use a version 1 Solution Workbench brief.");
  text(v.scenarioId, 40, "Scenario", true);
  number(v.revision, 1, 1000000, "Revision", true);
  function brief(input: unknown) {
    const b = only(
      input,
      [
        "project",
        "goal",
        "systems",
        "integrations",
        "stakeholders",
        "decisionOwner",
        "dataPolicy",
        "requireRegion",
        "region",
        "connectivity",
        "maxLatencySeconds",
        "outageMinutes",
        "recoveryMinutes",
        "team",
        "deadlineWeeks",
        "monthlyEvents",
        "peakEventsPerMinute",
        "growthPercent",
        "headroomPercent",
        "monthlyBudget",
      ],
      "Discovery",
    );
    text(b.project, 80, "Project name", true);
    text(b.goal, 2000, "Business goal", true);
    text(b.systems, 700, "Current systems", true);
    text(b.integrations, 2000, "Integration scope", true);
    text(b.stakeholders, 1500, "Stakeholders", true);
    text(b.decisionOwner, 100, "Decision owner", true);
    text(b.region, 100, "Approved location");
    if (typeof b.systems === "string") {
      const systems = systemNames(b.systems);
      if (
        systems.length > 12 ||
        systems.some((s) => s.length > 60) ||
        new Set(systems.map((s) => s.toLowerCase())).size !== systems.length
      )
        issues.push(
          "List at most 12 distinct systems, each up to 60 characters, one per line.",
        );
    }
    choice(
      b.dataPolicy,
      ["flexible", "approved-cloud", "private-only"],
      "Data boundary",
    );
    choice(b.connectivity, ["stable", "intermittent"], "Connectivity");
    choice(
      b.team,
      ["managed-only", "application", "platform"],
      "Operating team",
    );
    choice(b.requireRegion, [true, false], "Region requirement");
    number(b.maxLatencySeconds, 1, 86400, "Freshness target", true);
    number(b.outageMinutes, 1, 240, "Outage duration", true);
    number(b.recoveryMinutes, 1, 1440, "Recovery target", true);
    number(b.deadlineWeeks, 1, 52, "Delivery window", true);
    number(b.monthlyEvents, 0, 1000000000, "Monthly events", true);
    number(b.peakEventsPerMinute, 1, 1000000, "Peak events", true);
    number(b.growthPercent, 0, 200, "Growth allowance");
    number(b.headroomPercent, 0, 100, "Headroom");
    if (b.monthlyBudget !== null)
      number(b.monthlyBudget, 0, 1000000000, "Monthly cost cap");
  }
  function costs(input: unknown) {
    const c = only(
      input,
      ["currency", "hourlyRate", "migrationCost", "confirmed", "options"],
      "Cost model",
    );
    choice(c.currency, ["GBP", "USD", "ILS", "EUR"], "Currency");
    number(c.hourlyRate, 0, 10000, "Hourly rate");
    number(c.migrationCost, 0, 10000000, "One-off migration cost");
    choice(c.confirmed, [true, false], "Cost review");
    const options = only(
      c.options,
      ["workflow", "events", "private"],
      "Option costs",
    );
    for (const id of ["workflow", "events", "private"]) {
      const o = only(
        options[id],
        ["fixedMonthly", "perThousand", "opsHours", "setupHours"],
        `${id} costs`,
      );
      number(o.fixedMonthly, 0, 10000000, "Fixed monthly cost");
      number(o.perThousand, 0, 10000, "Cost per 1,000 events");
      number(o.opsHours, 0, 100000, "Monthly operations hours");
      number(o.setupHours, 0, 100000, "Implementation hours");
    }
  }
  function weights(input: unknown) {
    const w = only(input, Object.keys(CRITERIA), "Weights");
    for (const k of Object.keys(CRITERIA))
      number(w[k], 0, 5, `${CRITERIA[k as Criterion]} weight`, true);
    if (Object.values(w).every((n) => n === 0))
      issues.push("Give at least one decision criterion a non-zero weight.");
  }
  brief(v.brief);
  costs(v.costs);
  weights(v.weights);
  const edits = only(v.edits, Object.keys(SECTIONS), "Proposal edits");
  for (const [key, edit] of Object.entries(edits)) {
    const e = only(edit, ["text", "basedOnRevision"], `${key} edit`);
    text(e.text, 6000, `${key} section`);
    number(
      e.basedOnRevision,
      1,
      Number(v.revision),
      "Section review revision",
      true,
    );
  }
  if (v.baseline !== null) {
    const b = only(
      v.baseline,
      ["brief", "costs", "weights", "revision"],
      "Baseline",
    );
    brief(b.brief);
    costs(b.costs);
    weights(b.weights);
    number(b.revision, 1, Number(v.revision), "Baseline revision", true);
  }
  if (issues.length) throw new ValidationError(issues);
  if (
    new TextEncoder().encode(JSON.stringify(value, null, 2)).length >
    128 * 1024
  )
    throw new ValidationError([
      "The complete brief, including its pinned baseline and edits, must fit within 128 KiB.",
    ]);
  return structuredClone(value) as Draft;
}
export function importDraft(raw: string): Draft {
  if (new TextEncoder().encode(raw).length > 128 * 1024)
    throw new ValidationError(["Brief files are limited to 128 KiB."]);
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ValidationError(["The brief file is not valid JSON."]);
  }
  return validateDraft(value);
}
export const systemNames = (input: string) =>
  input
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
const cents = (value: number) => Math.round((value + Number.EPSILON) * 100);
export function estimate(
  brief: Brief,
  costs: CostModel,
  id: OptionId,
): Estimate {
  const rate = costs.options[id];
  const plan = (value: number) => {
    const numerator =
      BigInt(value) *
      BigInt(10000 + Math.round(brief.growthPercent * 100)) *
      BigInt(10000 + Math.round(brief.headroomPercent * 100));
    return Number((numerator + 99999999n) / 100000000n);
  };
  const plannedEvents = plan(brief.monthlyEvents),
    plannedPeak = plan(brief.peakEventsPerMinute);
  const fixedCents = cents(rate.fixedMonthly),
    trafficCents = Math.round((plannedEvents * cents(rate.perThousand)) / 1000),
    operationsCents = Math.round(
      (cents(rate.opsHours) * cents(costs.hourlyRate)) / 100,
    );
  const monthlyCents = fixedCents + trafficCents + operationsCents,
    setupCents =
      Math.round((cents(rate.setupHours) * cents(costs.hourlyRate)) / 100) +
      cents(costs.migrationCost);
  return {
    fixedCents,
    trafficCents,
    operationsCents,
    monthlyCents,
    setupCents,
    yearOneCents: monthlyCents * 12 + setupCents,
    plannedEvents,
    plannedPeak,
  };
}
export function analyse(draft: Draft): Analysis {
  validateDraft(draft);
  const { brief, costs, weights } = draft;
  const estimates = BLUEPRINTS.map((b) => estimate(brief, costs, b.id)),
    cheapest = Math.min(...estimates.map((e) => e.monthlyCents));
  const weightTotal = Object.values(weights).reduce((a, b) => a + b, 0);
  const candidates = BLUEPRINTS.map((blueprint, index): Candidate => {
    const estimate = estimates[index],
      blockers: string[] = [],
      conditions: string[] = [];
    const weeks =
      blueprint.baseWeeks +
      Math.ceil(Math.max(0, systemNames(brief.systems).length - 3) / 2);
    if (brief.dataPolicy === "private-only" && blueprint.id !== "private")
      blockers.push(
        "This baseline runs outside the required private boundary.",
      );
    if (brief.requireRegion && blueprint.id === "workflow")
      blockers.push(
        "This workflow baseline does not include customer-pinned residency.",
      );
    if (
      brief.requireRegion &&
      blueprint.id !== "workflow" &&
      !brief.region.trim()
    )
      conditions.push(
        "Name and approve the deployment location before proceeding.",
      );
    if (brief.connectivity === "intermittent" && blueprint.id === "workflow")
      blockers.push(
        "This baseline has no local outbox for an intermittent source connection.",
      );
    if (brief.maxLatencySeconds < blueprint.minLatencySeconds)
      blockers.push(
        `The ${blueprint.minLatencySeconds}s baseline cannot meet the ${brief.maxLatencySeconds}s freshness target.`,
      );
    if (blueprint.id === "events" && brief.team === "managed-only")
      blockers.push("The design requires an application engineering owner.");
    if (blueprint.id === "private" && brief.team !== "platform")
      blockers.push(
        "A platform team is required to operate this private runtime.",
      );
    if (weeks > brief.deadlineWeeks)
      blockers.push(
        `The ${weeks}-week planning lead time exceeds the ${brief.deadlineWeeks}-week window.`,
      );
    if (
      brief.monthlyBudget !== null &&
      estimate.monthlyCents > cents(brief.monthlyBudget)
    )
      blockers.push(
        "The modelled recurring cost exceeds the entered monthly cap.",
      );
    if (!costs.confirmed)
      conditions.push(
        "Rates are illustrative or unreviewed planning inputs, not vendor prices.",
      );
    if (brief.dataPolicy === "approved-cloud" && blueprint.id === "workflow")
      conditions.push(
        "Confirm that the shortlisted SaaS platform is an approved processor.",
      );
    const ratings: Record<Criterion, number> = {
      ...blueprint.ratings,
      cost:
        estimate.monthlyCents === 0
          ? 5
          : (5 * cheapest) / estimate.monthlyCents,
    };
    const contributions = Object.fromEntries(
      (Object.keys(CRITERIA) as Criterion[]).map((k) => [
        k,
        (((ratings[k] / 5) * weights[k]) / weightTotal) * 100,
      ]),
    ) as Record<Criterion, number>;
    const score =
      Math.round(Object.values(contributions).reduce((a, b) => a + b, 0) * 10) /
      10;
    return {
      blueprint,
      estimate,
      weeks,
      blockers,
      conditions,
      status: blockers.length
        ? "blocked"
        : conditions.length
          ? "conditional"
          : "fit",
      score,
      ratings,
      contributions,
    };
  });
  const eligible = candidates
    .filter((c) => !c.blockers.length)
    .sort(
      (a, b) =>
        Number(a.status === "conditional") -
          Number(b.status === "conditional") ||
        b.score - a.score ||
        a.estimate.monthlyCents - b.estimate.monthlyCents ||
        BLUEPRINTS.findIndex((x) => x.id === a.blueprint.id) -
          BLUEPRINTS.findIndex((x) => x.id === b.blueprint.id),
    );
  const warnings = [
    "Capability ratings, minimum latency and lead times describe these three planning blueprints. They are assumptions to prove in a PoC, not vendor guarantees.",
  ];
  if (!costs.confirmed)
    warnings.push(
      "The cost comparison is illustrative until its assumptions are reviewed.",
    );
  if (draft.brief.monthlyBudget !== null && !costs.confirmed)
    warnings.push("The budget gate currently uses unreviewed rates.");
  return {
    candidates,
    recommended: eligible[0] ?? null,
    weightTotal,
    warnings,
  };
}
export function staleEdits(draft: Draft) {
  return (Object.entries(draft.edits) as [SectionId, Edit][])
    .filter(([, edit]) => edit.basedOnRevision < draft.revision)
    .map(([id]) => id);
}
export function revise(draft: Draft, change: (next: Draft) => void): Draft {
  const next = structuredClone(draft);
  next.revision++;
  change(next);
  next.costs.confirmed = false;
  return next;
}
export function pinBaseline(draft: Draft): Draft {
  const next = structuredClone(draft);
  next.baseline = {
    brief: structuredClone(draft.brief),
    costs: structuredClone(draft.costs),
    weights: structuredClone(draft.weights),
    revision: draft.revision,
  };
  return next;
}
export function baselineAnalysis(draft: Draft): Analysis | null {
  return draft.baseline
    ? analyse({ ...draft, ...draft.baseline, baseline: null, edits: {} })
    : null;
}
export function differences(draft: Draft): string[] {
  if (!draft.baseline) return [];
  const before = draft.baseline.brief;
  return (Object.keys(draft.brief) as (keyof Brief)[])
    .filter((k) => draft.brief[k] !== before[k])
    .map((k) => k);
}
export const money = (amountCents: number, currency: string) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
