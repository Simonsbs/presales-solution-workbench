import type { Draft } from "./model.ts";
export interface Scenario {
  id: string;
  name: string;
  sector: string;
  description: string;
  constraint: string;
  reveal: (draft: Draft) => void;
  draft: Draft;
}
const common: Draft = {
  schemaVersion: 1,
  kind: "presales-workbench",
  scenarioId: "northstar",
  revision: 1,
  brief: {
    project: "Northstar Retail",
    goal: "Keep sales, stock and fulfilment teams aligned without rekeying orders. Start with one auditable order-to-fulfilment flow.",
    systems: "Commerce platform\nLegacy ERP\nWarehouse service",
    integrations:
      "Publish accepted orders to the ERP and warehouse. Reconcile order status back to commerce. Confirm the source of truth and mapping for each field.",
    stakeholders:
      "Business sponsor: operations director\nTechnical owner: application lead\nReviewers: warehouse manager and security lead",
    decisionOwner: "Operations director",
    dataPolicy: "flexible",
    requireRegion: false,
    region: "",
    connectivity: "stable",
    maxLatencySeconds: 900,
    outageMinutes: 30,
    recoveryMinutes: 60,
    team: "application",
    deadlineWeeks: 9,
    monthlyEvents: 180000,
    peakEventsPerMinute: 300,
    growthPercent: 40,
    headroomPercent: 20,
    monthlyBudget: null,
  },
  costs: {
    currency: "GBP",
    hourlyRate: 60,
    migrationCost: 1200,
    confirmed: false,
    options: {
      workflow: {
        fixedMonthly: 280,
        perThousand: 0.6,
        opsHours: 8,
        setupHours: 80,
      },
      events: {
        fixedMonthly: 180,
        perThousand: 0.12,
        opsHours: 24,
        setupHours: 180,
      },
      private: {
        fixedMonthly: 650,
        perThousand: 0.02,
        opsHours: 48,
        setupHours: 280,
      },
    },
  },
  weights: { speed: 5, operations: 5, flexibility: 2, reliability: 3, cost: 3 },
  edits: {},
  baseline: null,
};
const harbour = structuredClone(common);
harbour.scenarioId = "harbour";
Object.assign(harbour.brief, {
  project: "Harbour Services",
  goal: "Synchronise case status between internal systems while retaining control of the processing boundary and an inspectable recovery trail.",
  systems:
    "Case management\nDocument store\nInternal directory\nReporting service",
  integrations:
    "Exchange minimal case references and status updates. Keep document contents inside the private environment. Establish access and retention rules during discovery.",
  stakeholders:
    "Business sponsor: service director\nTechnical owner: platform manager\nReviewers: information security and service desk",
  decisionOwner: "Service director",
  dataPolicy: "private-only",
  requireRegion: true,
  region: "Customer-controlled UK private environment",
  maxLatencySeconds: 60,
  team: "platform",
  deadlineWeeks: 16,
  monthlyEvents: 45000,
  peakEventsPerMinute: 100,
  growthPercent: 20,
  headroomPercent: 30,
});
harbour.weights = {
  speed: 2,
  operations: 3,
  flexibility: 3,
  reliability: 5,
  cost: 2,
};
const lumen = structuredClone(common);
lumen.scenarioId = "lumen";
Object.assign(lumen.brief, {
  project: "Lumen Manufacturing",
  goal: "Move production status from three fictional sites into operational planning without losing events when a site link drops.",
  systems:
    "Site event collector\nProduction planning\nInventory system\nOperations dashboard",
  integrations:
    "Buffer source events locally, validate versioned event contracts and reconcile delivery after connection loss. No validated or regulated production system is implied.",
  stakeholders:
    "Business sponsor: plant operations lead\nTechnical owner: integration lead\nReviewers: site engineers, platform team and security",
  decisionOwner: "Plant operations lead",
  dataPolicy: "approved-cloud",
  requireRegion: true,
  region: "Customer-approved regional cloud location",
  connectivity: "intermittent",
  maxLatencySeconds: 5,
  team: "platform",
  deadlineWeeks: 16,
  monthlyEvents: 900000,
  peakEventsPerMinute: 1200,
  growthPercent: 50,
  headroomPercent: 30,
});
lumen.weights = {
  speed: 2,
  operations: 2,
  flexibility: 4,
  reliability: 5,
  cost: 2,
};
export const SCENARIOS: Scenario[] = [
  {
    id: "northstar",
    name: "Northstar Retail",
    sector: "COMMERCE & OPERATIONS",
    description:
      "Connect order and fulfilment systems. Balance speed, cost and day-to-day ownership.",
    constraint: "Order updates must arrive within 5 seconds.",
    reveal: (d) => {
      d.brief.maxLatencySeconds = 5;
    },
    draft: common,
  },
  {
    id: "harbour",
    name: "Harbour Services",
    sector: "PRIVATE DATA BOUNDARY",
    description:
      "Keep processing private. Establish who can own the runtime and its recovery.",
    constraint: "The operating team can configure SaaS only.",
    reveal: (d) => {
      d.brief.team = "managed-only";
    },
    draft: harbour,
  },
  {
    id: "lumen",
    name: "Lumen Manufacturing",
    sector: "INTERMITTENT SITE LINKS",
    description:
      "Buffer events at the edge and make recovery measurable across fictional sites.",
    constraint: "Public cloud processing is no longer permitted.",
    reveal: (d) => {
      d.brief.dataPolicy = "private-only";
    },
    draft: lumen,
  },
];
export function loadScenario(id: string): Draft {
  const scenario = SCENARIOS.find((s) => s.id === id);
  if (!scenario) throw new Error("Choose a known fictional scenario.");
  return structuredClone(scenario.draft);
}
