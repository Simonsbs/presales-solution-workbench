import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileCheck2,
  FileCode2,
  FileText,
  GitCompareArrows,
  Info,
  Layers3,
  LockKeyhole,
  MapPin,
  Network,
  NotebookPen,
  PanelLeftClose,
  Pin,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import {
  analyse,
  baselineAnalysis,
  BLUEPRINTS,
  CRITERIA,
  differences,
  importDraft,
  money,
  pinBaseline,
  revise,
  SECTIONS,
  staleEdits,
  systemNames,
  ValidationError,
} from "./model.ts";
import type {
  Analysis,
  Brief,
  CostInput,
  Criterion,
  Draft,
  OptionId,
  SectionId,
} from "./model.ts";
import { SCENARIOS, loadScenario } from "./fixtures.ts";
import {
  architectureNodes,
  architectureSvg,
  decisionRecord,
  generatedSections,
  pocCriteria,
  proposalMarkdown,
  sectionText,
} from "./proposal.ts";
import { download, packBytes, projectSlug } from "./files.ts";
import { persist, restore } from "./storage.ts";

type View = "discovery" | "compare" | "proposal" | "method";
const views = [
  {
    id: "discovery",
    label: "Discovery brief",
    detail: "Understand the problem",
    icon: NotebookPen,
  },
  {
    id: "compare",
    label: "Compare options",
    detail: "Make the trade-offs",
    icon: GitCompareArrows,
  },
  {
    id: "proposal",
    label: "Proposal & PoC",
    detail: "Leave with a plan",
    icon: FileCheck2,
  },
  {
    id: "method",
    label: "Method & evidence",
    detail: "Inspect the model",
    icon: ShieldCheck,
  },
] as const;
const int = (n: number) => n.toLocaleString("en-GB");
function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 10000000,
  step = "1",
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: string;
  hint?: string;
}) {
  return (
    <label className="field">
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <small>{hint}</small>}
    </label>
  );
}
function TextField({
  label,
  value,
  onChange,
  max = 2000,
  rows = 3,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max?: number;
  rows?: number;
  hint?: string;
}) {
  return (
    <label className="field">
      {label}
      <textarea
        value={value}
        rows={rows}
        maxLength={max}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Status({ status }: { status: "fit" | "conditional" | "blocked" }) {
  return (
    <span className={`status ${status}`}>
      <span />
      {status === "fit"
        ? "Fits the model"
        : status === "conditional"
          ? "Conditional fit"
          : "Blocked"}
    </span>
  );
}
function PanelTitle({
  number,
  title,
  note,
}: {
  number: string;
  title: string;
  note?: string;
}) {
  return (
    <div className="panel-title">
      <span>{number}</span>
      <div>
        <h2>{title}</h2>
        {note && <p>{note}</p>}
      </div>
    </div>
  );
}

export default function App() {
  const [initial] = useState(() => {
    try {
      return restore(localStorage);
    } catch {
      return {
        draft: loadScenario("northstar"),
        message: "Browser storage is unavailable. This draft stays in memory.",
        recovery: null,
      };
    }
  });
  const [draft, setDraft] = useState(initial.draft),
    [view, setView] = useState<View>("discovery"),
    [notice, setNotice] = useState(initial.message),
    [failure, setFailure] = useState("");
  const [saved, setSaved] = useState(true),
    [scenarioOpen, setScenarioOpen] = useState(false),
    [mobileNav, setMobileNav] = useState(false),
    [inspect, setInspect] = useState<OptionId | null>(null),
    [editing, setEditing] = useState<SectionId | null>(null);
  const scenarioDialog = useRef<HTMLDialogElement>(null),
    importInput = useRef<HTMLInputElement>(null),
    fileBusy = useRef(false),
    exportBusy = useRef(false);
  const evaluation = useMemo(() => {
    try {
      return { analysis: analyse(draft), issues: [] as string[] };
    } catch (error) {
      return {
        analysis: null,
        issues:
          error instanceof ValidationError
            ? error.issues
            : ["Review the discovery and cost inputs."],
      };
    }
  }, [draft]);
  const a = evaluation.analysis,
    r = a?.recommended,
    scenario = SCENARIOS.find((s) => s.id === draft.scenarioId),
    stale = staleEdits(draft);
  const baseline = useMemo(() => {
    try {
      return baselineAnalysis(draft);
    } catch {
      return null;
    }
  }, [draft]);
  useEffect(() => {
    if (!evaluation.issues.length) {
      try {
        setSaved(persist(localStorage, draft));
      } catch {
        setSaved(false);
      }
    }
  }, [draft, evaluation.issues.length]);
  useEffect(() => {
    if (scenarioOpen) scenarioDialog.current?.showModal();
    else scenarioDialog.current?.close();
  }, [scenarioOpen]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNav(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  function update(change: (next: Draft) => void) {
    setDraft((current) => revise(current, change));
    setFailure("");
  }
  function brief<K extends keyof Brief>(key: K, value: Brief[K]) {
    update((next) => {
      next.brief[key] = value;
    });
  }
  function go(next: View) {
    setView(next);
    setMobileNav(false);
    setFailure("");
    window.scrollTo(0, 0);
  }
  function reveal() {
    if (!scenario || !a) return;
    const next = pinBaseline(draft);
    setDraft(revise(next, scenario.reveal));
    setNotice(
      `New constraint: ${scenario.constraint} The previous brief is pinned for comparison.`,
    );
    go("compare");
  }
  function exportPack() {
    if (exportBusy.current || !a) return;
    exportBusy.current = true;
    try {
      const bytes = packBytes(draft);
      download(
        `${projectSlug(draft.brief.project)}-proposal-pack.zip`,
        bytes as Uint8Array<ArrayBuffer>,
        "application/zip",
      );
      setNotice(
        "Proposal pack downloaded: editable brief, proposal, diagram, decision record, PoC plan and analysis. Draft for review.",
      );
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Export failed.");
    } finally {
      exportBusy.current = false;
    }
  }
  async function importFile(file?: File) {
    if (!file || fileBusy.current) return;
    fileBusy.current = true;
    try {
      if (file.size > 128 * 1024)
        throw new Error("Brief files are limited to 128 KiB.");
      const next = importDraft(await file.text());
      setDraft(next);
      setInspect(null);
      setEditing(null);
      setNotice(
        "Brief imported. Its structured inputs, baseline and authored sections were preserved.",
      );
      setFailure("");
      go("discovery");
    } catch (e) {
      setFailure(
        e instanceof Error ? e.message : "The brief could not be imported.",
      );
    } finally {
      fileBusy.current = false;
      if (importInput.current) importInput.current.value = "";
    }
  }
  const sections = a ? generatedSections(draft, a) : null;
  return (
    <div className="app-frame">
      <a className="skip-link" href="#main">
        Skip to the workbench
      </a>
      <aside
        className={`sidebar${mobileNav ? " open" : ""}`}
        aria-label="Workbench navigation"
      >
        <button
          className="mobile-close icon-button"
          aria-label="Close workbench navigation"
          onClick={() => setMobileNav(false)}
        >
          <X size={19} />
        </button>
        <a className="brand" href="/">
          <span>
            <Layers3 size={24} />
          </span>
          <div>
            Solution
            <br />
            <strong>
              Workbench<span>.</span>
            </strong>
          </div>
        </a>
        <p className="sidebar-kicker">A TECHNICAL PRESALES LAB</p>
        <button
          className="scenario-switch"
          onClick={() => setScenarioOpen(true)}
        >
          <span className="scenario-monogram">
            {draft.brief.project.slice(0, 1) || "S"}
          </span>
          <span>
            <small>FICTIONAL SCENARIO</small>
            <strong>{draft.brief.project || "Untitled brief"}</strong>
          </span>
          <ChevronDown size={15} />
        </button>
        <nav aria-label="Workbench steps">
          {views.map(({ id, label, detail, icon: Icon }, index) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              aria-current={view === id ? "page" : undefined}
              onClick={() => go(id)}
            >
              <span className="nav-number">
                {index < 3 ? `0${index + 1}` : <Info size={14} />}
              </span>
              <span>
                <strong>{label}</strong>
                <small>{detail}</small>
              </span>
              {view === id && <ChevronRight size={15} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-status">
            <span className={saved ? "saved-dot" : "unsaved-dot"} />
            <div>
              <strong>
                {evaluation.issues.length
                  ? "Review invalid inputs"
                  : saved
                    ? "Saved in this browser"
                    : "Memory-only draft"}
              </strong>
              <small>Brief revision {draft.revision}</small>
            </div>
          </div>
          <p>
            <LockKeyhole size={13} />
            Drafts stay on this device.
            <br />
            Use fictional or anonymised data.
          </p>
          <a
            href="https://github.com/Simonsbs/presales-solution-workbench"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FileCode2 size={15} />
            Inspect the source
            <ArrowUpRight size={13} />
          </a>
          <a
            className="creator"
            href="https://bestdev.co.il/#/projects"
            target="_blank"
            rel="noopener noreferrer"
          >
            An independent project by
            <br />
            <strong>
              Simon Stirling <ArrowUpRight size={12} />
            </strong>
          </a>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="Toggle workbench navigation"
            aria-expanded={mobileNav}
            onClick={() => setMobileNav(!mobileNav)}
          >
            <PanelLeftClose size={20} />
          </button>
          <div className="breadcrumb">
            PROJECT 03 <span>/</span> {views.find((v) => v.id === view)?.label}
          </div>
          <div className="top-actions">
            <span className="draft-pill">
              <span />
              DRAFT FOR REVIEW
            </span>
            <button
              aria-label="Import brief"
              className="button quiet import-button"
              onClick={() => importInput.current?.click()}
            >
              <Upload size={15} />
              <span>Import brief</span>
            </button>
            <button
              aria-label="Export proposal pack"
              className="button primary"
              disabled={!a}
              onClick={exportPack}
            >
              <Download size={15} />
              <span>Export proposal pack</span>
            </button>
            <input
              hidden
              className="sr-only"
              type="file"
              accept=".json,application/json"
              aria-label="Import a workbench brief"
              ref={importInput}
              onChange={(e) => void importFile(e.target.files?.[0])}
            />
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <span className="eyebrow">DISCOVERY → DECISIONS → DELIVERY</span>
              <h1>
                {view === "discovery" ? (
                  <>
                    A better brief.
                    <br />
                    <em>A defensible plan.</em>
                  </>
                ) : view === "compare" ? (
                  <>
                    Make the
                    <br />
                    <em>trade-offs visible.</em>
                  </>
                ) : view === "proposal" ? (
                  <>
                    A proposal with
                    <br />
                    <em>the reasoning attached.</em>
                  </>
                ) : (
                  <>
                    Open the model.
                    <br />
                    <em>Inspect the assumptions.</em>
                  </>
                )}
              </h1>
              <p>
                {view === "discovery"
                  ? "Start with the customer problem. Turn constraints into an architecture you can explain and a PoC you can measure."
                  : view === "compare"
                    ? "Check the hard constraints first. Compare the eligible options, then challenge the assumptions behind the score."
                    : view === "proposal"
                      ? "Edit the wording, retain the decision evidence and leave with a practical acceptance plan."
                      : "A deterministic planning exercise. No hidden model, live vendor pricing or completed customer engagement."}
              </p>
            </div>
            <div className="heading-aside">
              <span className="fictional-tag">FICTIONAL CUSTOMER SCENARIO</span>
              <strong>{draft.brief.project || "Untitled brief"}</strong>
              <span>{scenario?.sector ?? "IMPORTED WORKSHOP BRIEF"}</span>
              <button onClick={() => setScenarioOpen(true)}>
                Try another scenario <ArrowRight size={14} />
              </button>
            </div>
          </div>
          <div className="notifications" aria-live="polite">
            {notice && (
              <div className="notice">
                <CheckCircle2 size={16} />
                <span>{notice}</span>
                <button
                  aria-label="Dismiss notification"
                  onClick={() => setNotice("")}
                >
                  <X size={14} />
                </button>
              </div>
            )}
            {failure && (
              <div className="notice failure" role="alert">
                <Info size={16} />
                <span>{failure}</span>
              </div>
            )}
            {initial.recovery && (
              <button
                className="text-button"
                onClick={() =>
                  download(
                    "workbench-recovered-draft.json",
                    initial.recovery!,
                    "application/json",
                  )
                }
              >
                Download previous saved data <Download size={13} />
              </button>
            )}
            {evaluation.issues.length > 0 && (
              <div className="validation-errors" role="alert">
                <strong>Review the brief before comparing or exporting.</strong>
                <ul>
                  {evaluation.issues.slice(0, 5).map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {view === "discovery" && (
            <div className="discovery-layout">
              <div className="discovery-form">
                <section className="panel">
                  <PanelTitle
                    number="01"
                    title="Understand the customer."
                    note="Separate the desired outcome from the technology choice."
                  />
                  <div className="panel-fields">
                    <label className="field">
                      Workshop / project name
                      <input
                        maxLength={80}
                        value={draft.brief.project}
                        onChange={(e) => brief("project", e.target.value)}
                      />
                    </label>
                    <TextField
                      label="Business goal"
                      value={draft.brief.goal}
                      onChange={(v) => brief("goal", v)}
                      rows={3}
                    />
                    <div className="field-grid">
                      <TextField
                        label="Current systems"
                        value={draft.brief.systems}
                        onChange={(v) => brief("systems", v)}
                        max={700}
                        rows={4}
                        hint="One system per line. Up to 12 distinct systems."
                      />
                      <TextField
                        label="Stakeholders and ownership"
                        value={draft.brief.stakeholders}
                        onChange={(v) => brief("stakeholders", v)}
                        max={1500}
                        rows={4}
                      />
                    </div>
                    <TextField
                      label="Integration scope"
                      value={draft.brief.integrations}
                      onChange={(v) => brief("integrations", v)}
                      rows={3}
                      hint="Carry free-text requirements into the structured constraints below to affect the comparison."
                    />
                    <label className="field">
                      Decision owner
                      <input
                        value={draft.brief.decisionOwner}
                        maxLength={100}
                        onChange={(e) => brief("decisionOwner", e.target.value)}
                      />
                    </label>
                  </div>
                </section>
                <section className="panel">
                  <PanelTitle
                    number="02"
                    title="Set the boundaries."
                    note="These inputs can rule out an option, regardless of its score."
                  />
                  <div className="panel-fields">
                    <div className="field-grid">
                      <label className="field">
                        Permitted processing boundary
                        <select
                          value={draft.brief.dataPolicy}
                          onChange={(e) =>
                            brief(
                              "dataPolicy",
                              e.target.value as Brief["dataPolicy"],
                            )
                          }
                        >
                          <option value="flexible">
                            SaaS or cloud permitted
                          </option>
                          <option value="approved-cloud">
                            Approved cloud only
                          </option>
                          <option value="private-only">
                            Private environment only
                          </option>
                        </select>
                      </label>
                      <label className="field">
                        Operating team
                        <select
                          value={draft.brief.team}
                          onChange={(e) =>
                            brief("team", e.target.value as Brief["team"])
                          }
                        >
                          <option value="managed-only">
                            SaaS configuration only
                          </option>
                          <option value="application">
                            Application engineering team
                          </option>
                          <option value="platform">
                            Application + platform team
                          </option>
                        </select>
                      </label>
                      <label className="field">
                        Source connectivity
                        <select
                          value={draft.brief.connectivity}
                          onChange={(e) =>
                            brief(
                              "connectivity",
                              e.target.value as Brief["connectivity"],
                            )
                          }
                        >
                          <option value="stable">Stable connection</option>
                          <option value="intermittent">
                            Intermittent: buffering required
                          </option>
                        </select>
                      </label>
                      <NumberField
                        label="Maximum delivery latency (seconds)"
                        value={draft.brief.maxLatencySeconds}
                        onChange={(v) => brief("maxLatencySeconds", v)}
                        min={1}
                        max={86400}
                      />
                      <NumberField
                        label="Delivery window (weeks)"
                        value={draft.brief.deadlineWeeks}
                        onChange={(v) => brief("deadlineWeeks", v)}
                        min={1}
                        max={52}
                      />
                      <NumberField
                        label="Outage to recover from (minutes)"
                        value={draft.brief.outageMinutes}
                        onChange={(v) => brief("outageMinutes", v)}
                        min={1}
                        max={240}
                      />
                      <NumberField
                        label="Recovery after restoration (minutes)"
                        value={draft.brief.recoveryMinutes}
                        onChange={(v) => brief("recoveryMinutes", v)}
                        min={1}
                        max={1440}
                      />
                    </div>
                    <label className="check-field">
                      <input
                        type="checkbox"
                        checked={draft.brief.requireRegion}
                        onChange={(e) =>
                          brief("requireRegion", e.target.checked)
                        }
                      />
                      <span>
                        Processing location must be explicitly approved
                      </span>
                    </label>
                    {draft.brief.requireRegion && (
                      <label className="field">
                        Approved location
                        <input
                          maxLength={100}
                          placeholder="Name the region or private environment"
                          value={draft.brief.region}
                          onChange={(e) => brief("region", e.target.value)}
                        />
                      </label>
                    )}
                  </div>
                </section>
                <section className="panel">
                  <PanelTitle
                    number="03"
                    title="Size the planning envelope."
                    note="Use explicit assumptions. Monthly volume and peak load are separate."
                  />
                  <div className="panel-fields">
                    <div className="field-grid">
                      <NumberField
                        label="Current events / month"
                        value={draft.brief.monthlyEvents}
                        onChange={(v) => brief("monthlyEvents", v)}
                        max={1000000000}
                      />
                      <NumberField
                        label="Current peak events / minute"
                        value={draft.brief.peakEventsPerMinute}
                        onChange={(v) => brief("peakEventsPerMinute", v)}
                        min={1}
                        max={1000000}
                      />
                      <NumberField
                        label="Growth allowance (%)"
                        value={draft.brief.growthPercent}
                        onChange={(v) => brief("growthPercent", v)}
                        max={200}
                        step="0.01"
                      />
                      <NumberField
                        label="Additional headroom (%)"
                        value={draft.brief.headroomPercent}
                        onChange={(v) => brief("headroomPercent", v)}
                        max={100}
                        step="0.01"
                      />
                      <label className="field">
                        Monthly cost cap ({draft.costs.currency})
                        <input
                          type="number"
                          min={0}
                          max={1000000000}
                          step="0.01"
                          placeholder="Optional: no cap set"
                          value={draft.brief.monthlyBudget ?? ""}
                          onChange={(e) =>
                            brief(
                              "monthlyBudget",
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                            )
                          }
                        />
                        <small>
                          Recurring cost only. One-off implementation is
                          separate.
                        </small>
                      </label>
                    </div>
                    {a && (
                      <div className="load-summary">
                        <Network size={19} />
                        <div>
                          <strong>
                            {int(a.candidates[0].estimate.plannedEvents)} events
                            / month
                          </strong>
                          <span>
                            {int(a.candidates[0].estimate.plannedPeak)} peak
                            events / minute after growth and headroom
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
                <section className="panel">
                  <PanelTitle
                    number="04"
                    title="Decide what matters most."
                    note="Weights affect eligible options. They never override a hard constraint."
                  />
                  <div className="panel-fields weights">
                    {(Object.entries(CRITERIA) as [Criterion, string][]).map(
                      ([key, label]) => (
                        <label key={key}>
                          <span>
                            {label}
                            <strong>
                              {draft.weights[key]}
                              <small>/5</small>
                            </strong>
                          </span>
                          <input
                            type="range"
                            min={0}
                            max={5}
                            step={1}
                            value={draft.weights[key]}
                            onChange={(e) =>
                              update((next) => {
                                next.weights[key] = Number(e.target.value);
                              })
                            }
                          />
                        </label>
                      ),
                    )}
                  </div>
                </section>
                <button
                  className="button primary next-step"
                  disabled={!a}
                  onClick={() => go("compare")}
                >
                  Compare the architecture options
                  <ArrowRight size={16} />
                </button>
              </div>
              <aside
                className="decision-rail"
                aria-label="Live decision summary"
              >
                <div className="decision-card">
                  <span className="eyebrow">THE EMERGING DIRECTION</span>
                  <div className="decision-symbol">
                    <Layers3 size={28} />
                  </div>
                  <h2>
                    {r
                      ? r.blueprint.shortName
                      : a
                        ? "No feasible option."
                        : "Review the inputs."}
                  </h2>
                  {r ? (
                    <>
                      <Status status={r.status} />
                      <p>{r.blueprint.tradeoff}</p>
                      <div className="rail-stats">
                        <div>
                          <strong>
                            {r.score}
                            <small>/100</small>
                          </strong>
                          <span>Weighted fit</span>
                        </div>
                        <div>
                          <strong>
                            {
                              a!.candidates.filter((c) => !c.blockers.length)
                                .length
                            }
                            <small>/3</small>
                          </strong>
                          <span>Eligible options</span>
                        </div>
                      </div>
                      <button
                        className="button outline"
                        onClick={() => go("compare")}
                      >
                        Inspect the reasoning
                        <ArrowRight size={15} />
                      </button>
                    </>
                  ) : (
                    <p>
                      {a
                        ? "The stated boundary, staffing, timeline or cost constraints conflict. Review the blocked options before proposing a delivery plan."
                        : "Correct the validation issues to evaluate the options."}
                    </p>
                  )}
                  <small className="planning-label">
                    Planning direction, subject to PoC. Rates and capability
                    assumptions require review.
                  </small>
                </div>
                <div className="challenge-card">
                  <GitCompareArrows size={22} />
                  <span className="tiny">THE FIVE-MINUTE DEMO</span>
                  <h3>
                    A new constraint
                    <br />
                    changes the conversation.
                  </h3>
                  <p>
                    {scenario?.constraint ??
                      "Pin this brief, then change a structured constraint to compare the result."}
                  </p>
                  <button
                    className="text-button"
                    disabled={!a || !scenario}
                    onClick={reveal}
                  >
                    Introduce this constraint
                    <ArrowRight size={15} />
                  </button>
                </div>
                <button
                  className="pin-button"
                  disabled={!a}
                  onClick={() => {
                    setDraft(pinBaseline(draft));
                    setNotice(
                      `Pinned revision ${draft.revision}. Change the brief to compare decisions.`,
                    );
                  }}
                >
                  <Pin size={15} />
                  Pin this brief as a baseline
                </button>
              </aside>
            </div>
          )}
          {view === "compare" && (
            <>
              {draft.baseline && (
                <section className="baseline-banner">
                  <span className="baseline-icon">
                    <GitCompareArrows size={22} />
                  </span>
                  <div>
                    <span className="tiny">
                      BEFORE → AFTER / PINNED REVISION {draft.baseline.revision}
                    </span>
                    <h2>
                      {baseline?.recommended?.blueprint.shortName ??
                        "No feasible option"}
                      <ArrowRight size={18} />
                      {r?.blueprint.shortName ?? "No feasible option"}
                    </h2>
                    <p>
                      {differences(draft).length
                        ? `Changed structured fields: ${differences(draft)
                            .map((k) =>
                              k.replace(/([A-Z])/g, " $1").toLowerCase(),
                            )
                            .join(", ")}.`
                        : "Change constraints, costs or priorities to compare with this pinned brief."}
                    </p>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Clear pinned baseline"
                    onClick={() => setDraft({ ...draft, baseline: null })}
                  >
                    <X size={17} />
                  </button>
                </section>
              )}
              {a && (
                <>
                  <div className="section-line">
                    <div>
                      <h2>Three routes. One explicit decision.</h2>
                      <p>
                        Hard constraints first, then the declared weighted
                        scores.
                      </p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => go("discovery")}
                    >
                      Edit the brief
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                  <div className="option-grid">
                    {a.candidates.map((c) => (
                      <section
                        key={c.blueprint.id}
                        className={`option-card ${r?.blueprint.id === c.blueprint.id ? "recommended" : ""}`}
                      >
                        <div className="option-top">
                          <span className="tiny">{c.blueprint.tag}</span>
                          {r?.blueprint.id === c.blueprint.id && (
                            <span className="recommended-tag">PROPOSED</span>
                          )}
                        </div>
                        <h3>{c.blueprint.name}</h3>
                        <p>{c.blueprint.description}</p>
                        <Status status={c.status} />
                        <div className="score-line">
                          <strong>
                            {c.score}
                            <small>/100</small>
                          </strong>
                          <div>
                            <span>Weighted planning fit</span>
                            <div className="score-track">
                              <i style={{ width: `${c.score}%` }} />
                            </div>
                          </div>
                        </div>
                        <div className="option-cost">
                          <strong>
                            {money(
                              c.estimate.monthlyCents,
                              draft.costs.currency,
                            )}
                            <small>/mo</small>
                          </strong>
                          <span>
                            {c.weeks} modelled weeks ·{" "}
                            {draft.costs.confirmed
                              ? "reviewed inputs"
                              : "illustrative inputs"}
                          </span>
                        </div>
                        <ul className="option-checks">
                          {c.blockers.length ? (
                            c.blockers.map((b) => (
                              <li className="blocked-reason" key={b}>
                                <X size={14} />
                                {b}
                              </li>
                            ))
                          ) : (
                            <li>
                              <Check size={14} />
                              Clears the entered hard constraints
                            </li>
                          )}
                          {c.conditions.map((condition) => (
                            <li className="condition" key={condition}>
                              <Info size={14} />
                              {condition}
                            </li>
                          ))}
                        </ul>
                        <details className="score-details">
                          <summary>
                            See score contributions
                            <ChevronDown size={13} />
                          </summary>
                          <dl>
                            {(
                              Object.entries(CRITERIA) as [Criterion, string][]
                            ).map(([key, label]) => (
                              <div key={key}>
                                <dt>
                                  {label} · weight {draft.weights[key]}
                                </dt>
                                <dd>
                                  {c.ratings[key].toFixed(1)}/5 →{" "}
                                  {c.contributions[key].toFixed(1)} pts
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </details>
                        <button
                          className="text-button"
                          onClick={() => setInspect(c.blueprint.id)}
                        >
                          Inspect this architecture
                          <ArrowDown size={14} />
                        </button>
                      </section>
                    ))}
                  </div>
                  <Architecture
                    draft={draft}
                    analysis={a}
                    inspect={inspect}
                    onInspect={setInspect}
                  />
                </>
              )}
              <section className="panel cost-panel">
                <PanelTitle
                  number="£"
                  title="Make the estimate inspectable."
                  note="Sample rates are fictional. Enter assumptions in one currency; no live vendor prices are used."
                />
                <div className="panel-fields">
                  <div className="cost-common">
                    <label className="field">
                      Currency label
                      <select
                        value={draft.costs.currency}
                        onChange={(e) =>
                          update((next) => {
                            next.costs.currency = e.target
                              .value as Draft["costs"]["currency"];
                          })
                        }
                      >
                        {["GBP", "USD", "ILS", "EUR"].map((code) => (
                          <option key={code}>{code}</option>
                        ))}
                      </select>
                      <small>Relabels amounts. No exchange conversion.</small>
                    </label>
                    <NumberField
                      label="Labour rate / hour"
                      step="0.01"
                      value={draft.costs.hourlyRate}
                      max={10000}
                      onChange={(v) =>
                        update((next) => {
                          next.costs.hourlyRate = v;
                        })
                      }
                    />
                    <NumberField
                      label="One-off migration cost"
                      step="0.01"
                      value={draft.costs.migrationCost}
                      onChange={(v) =>
                        update((next) => {
                          next.costs.migrationCost = v;
                        })
                      }
                    />
                  </div>
                  <div
                    className="table-scroll"
                    role="region"
                    aria-label="Editable cost assumptions"
                    tabIndex={0}
                  >
                    <table className="cost-input-table">
                      <thead>
                        <tr>
                          <th>Planning blueprint</th>
                          <th>Fixed / month</th>
                          <th>Per 1,000 events</th>
                          <th>Ops hours / month</th>
                          <th>Implementation hours</th>
                        </tr>
                      </thead>
                      <tbody>
                        {BLUEPRINTS.map((option) => (
                          <tr key={option.id}>
                            <th scope="row">{option.shortName}</th>
                            {(
                              [
                                "fixedMonthly",
                                "perThousand",
                                "opsHours",
                                "setupHours",
                              ] as (keyof CostInput)[]
                            ).map((key) => (
                              <td key={key}>
                                <input
                                  type="number"
                                  min={0}
                                  max={
                                    key === "perThousand"
                                      ? 10000
                                      : key === "fixedMonthly"
                                        ? 10000000
                                        : 100000
                                  }
                                  step="0.01"
                                  aria-label={`${option.shortName}: ${key}`}
                                  value={draft.costs.options[option.id][key]}
                                  onChange={(e) =>
                                    update((next) => {
                                      next.costs.options[option.id][key] =
                                        Number(e.target.value);
                                    })
                                  }
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <label className="check-field review-check">
                    <input
                      type="checkbox"
                      checked={draft.costs.confirmed}
                      onChange={(e) => {
                        const next = revise(draft, () => {});
                        next.costs.confirmed = e.target.checked;
                        setDraft(next);
                      }}
                    />
                    <span>
                      I have reviewed the rates and planning assumptions for
                      this brief.
                      <small>
                        This records your review, not a vendor quote. Further
                        input changes clear it.
                      </small>
                    </span>
                  </label>
                  {a && (
                    <>
                      <div className="calculation-note">
                        <SlidersHorizontal size={18} />
                        <div>
                          <strong>Every line has a calculation.</strong>
                          <p>
                            Planned events = ceil(
                            {int(draft.brief.monthlyEvents)} × (1 +{" "}
                            {draft.brief.growthPercent}%) × (1 +{" "}
                            {draft.brief.headroomPercent}%)) ={" "}
                            <b>{int(a.candidates[0].estimate.plannedEvents)}</b>
                            . Traffic is pro-rata. Each line rounds to cents
                            before summing.
                          </p>
                        </div>
                      </div>
                      <div
                        className="table-scroll"
                        role="region"
                        aria-label="Calculated cost breakdown"
                        tabIndex={0}
                      >
                        <table className="result-table">
                          <thead>
                            <tr>
                              <th>Option</th>
                              <th>Fixed</th>
                              <th>Traffic</th>
                              <th>Operations</th>
                              <th>Monthly total</th>
                              <th>One-off</th>
                              <th>Year one</th>
                            </tr>
                          </thead>
                          <tbody>
                            {a.candidates.map((c) => (
                              <tr key={c.blueprint.id}>
                                <th scope="row">{c.blueprint.shortName}</th>
                                {[
                                  c.estimate.fixedCents,
                                  c.estimate.trafficCents,
                                  c.estimate.operationsCents,
                                  c.estimate.monthlyCents,
                                  c.estimate.setupCents,
                                  c.estimate.yearOneCents,
                                ].map((amount, i) => (
                                  <td key={i}>
                                    {money(amount, draft.costs.currency)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="fine-print">
                        Operations = monthly ops hours × labour rate. One-off =
                        implementation hours × labour rate + migration cost.
                        Year one = 12 × monthly total + one-off. Taxes,
                        discounts, inflation and financing are excluded.
                      </p>
                    </>
                  )}
                </div>
              </section>
              <div className="step-footer">
                <p>
                  {r
                    ? `${r.blueprint.shortName} is the current planning direction.`
                    : "Resolve the blocked constraints before proposing implementation."}
                </p>
                <button
                  className="button primary"
                  disabled={!a}
                  onClick={() => go("proposal")}
                >
                  Shape the proposal
                  <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}
          {view === "proposal" && a && sections && (
            <>
              <section className={`proposal-status${r ? "" : " no-fit"}`}>
                <div className="proposal-status-icon">
                  {r ? <CheckCircle2 size={25} /> : <Info size={25} />}
                </div>
                <div>
                  <span className="tiny">
                    GENERATED DECISION / CURRENT BRIEF
                  </span>
                  <h2>
                    {r
                      ? r.blueprint.name
                      : "No feasible option under the current constraints"}
                  </h2>
                  <p>
                    {r
                      ? `${r.score}/100 weighted fit · ${money(r.estimate.monthlyCents, draft.costs.currency)}/month under ${draft.costs.confirmed ? "reviewed" : "illustrative"} inputs. ${r.weeks}-week planning allowance.`
                      : "The proposal records the conflicts and a discovery step; it makes no implementation commitment."}
                  </p>
                </div>
                <span className="revision-tag">REV {draft.revision}</span>
              </section>
              {stale.length > 0 && (
                <div className="notice stale-notice" role="status">
                  <Info size={18} />
                  <span>
                    {stale.length} authored{" "}
                    {stale.length === 1 ? "section needs" : "sections need"}{" "}
                    review against this changed brief. Your wording has been
                    preserved and exports carry the review flag.
                  </span>
                </div>
              )}
              <div className="proposal-layout">
                <article className="proposal-paper">
                  <div className="paper-header">
                    <span className="tiny">
                      SOLUTION OUTLINE / EDITABLE DRAFT
                    </span>
                    <h2>{draft.brief.project}</h2>
                    <p>
                      Fictional workshop. No completed engagement or binding
                      quote is implied.
                    </p>
                  </div>
                  {(Object.entries(SECTIONS) as [SectionId, string][]).map(
                    ([id, title]) => (
                      <section className="proposal-section" key={id}>
                        <div>
                          <h3>{title}</h3>
                          <span>
                            {draft.edits[id]
                              ? stale.includes(id)
                                ? "Review required"
                                : "Author edited"
                              : "Generated"}
                          </span>
                          <button
                            aria-label={
                              editing === id
                                ? `Close ${title} editor`
                                : `Edit ${title} wording`
                            }
                            className="text-button"
                            onClick={() =>
                              setEditing(editing === id ? null : id)
                            }
                          >
                            <NotebookPen size={13} />
                            {editing === id ? "Close editor" : "Edit wording"}
                          </button>
                        </div>
                        {editing === id ? (
                          <textarea
                            aria-label={`${title} wording`}
                            rows={9}
                            maxLength={6000}
                            value={sectionText(draft, id, a)}
                            onChange={(e) =>
                              setDraft((current) => ({
                                ...current,
                                edits: {
                                  ...current.edits,
                                  [id]: {
                                    text: e.target.value,
                                    basedOnRevision: current.revision,
                                  },
                                },
                              }))
                            }
                          />
                        ) : (
                          <p className="proposal-copy">
                            {sectionText(draft, id, a)}
                          </p>
                        )}
                        {draft.edits[id] && (
                          <div className="edit-actions">
                            <span>
                              Based on brief revision{" "}
                              {draft.edits[id]!.basedOnRevision}
                            </span>
                            {stale.includes(id) && (
                              <button
                                onClick={() =>
                                  setDraft((current) => ({
                                    ...current,
                                    edits: {
                                      ...current.edits,
                                      [id]: {
                                        ...current.edits[id]!,
                                        basedOnRevision: current.revision,
                                      },
                                    },
                                  }))
                                }
                              >
                                Mark reviewed for revision {draft.revision}
                              </button>
                            )}
                            <button
                              onClick={() =>
                                setDraft((current) => {
                                  const next = structuredClone(current);
                                  delete next.edits[id];
                                  return next;
                                })
                              }
                            >
                              Use current generated wording
                            </button>
                          </div>
                        )}
                      </section>
                    ),
                  )}
                </article>
                <aside className="proposal-side">
                  <div className="export-card">
                    <span className="tiny">TAKE THE REASONING WITH YOU</span>
                    <h3>
                      One brief.
                      <br />A complete review pack.
                    </h3>
                    <ul>
                      {[
                        "Editable discovery brief",
                        "Solution proposal",
                        "Architecture diagram",
                        "Proposed decision record",
                        "Six PoC acceptance checks",
                        "Scores and cost calculations",
                      ].map((text) => (
                        <li key={text}>
                          <Check size={14} />
                          {text}
                        </li>
                      ))}
                    </ul>
                    <button className="button primary" onClick={exportPack}>
                      <Download size={15} />
                      Download proposal pack
                    </button>
                    <small>
                      ZIP: JSON, Markdown, SVG and CSV.
                      <br />
                      All outputs remain drafts for review.
                    </small>
                  </div>
                  <div className="single-exports">
                    <h3>Individual files</h3>
                    <button
                      onClick={() =>
                        download(
                          "brief.json",
                          JSON.stringify(draft, null, 2),
                          "application/json",
                        )
                      }
                    >
                      <FileText size={14} />
                      Editable brief
                      <Download size={13} />
                    </button>
                    <button
                      onClick={() =>
                        download(
                          "proposal.md",
                          proposalMarkdown(draft),
                          "text/markdown",
                        )
                      }
                    >
                      <NotebookPen size={14} />
                      Proposal Markdown
                      <Download size={13} />
                    </button>
                    <button
                      onClick={() =>
                        download(
                          "architecture.svg",
                          architectureSvg(draft),
                          "image/svg+xml",
                        )
                      }
                    >
                      <Network size={14} />
                      Architecture SVG
                      <Download size={13} />
                    </button>
                    <button
                      onClick={() =>
                        download(
                          "decision-record.md",
                          decisionRecord(draft),
                          "text/markdown",
                        )
                      }
                    >
                      <ClipboardCheck size={14} />
                      Decision record
                      <Download size={13} />
                    </button>
                  </div>
                </aside>
              </div>
              <section className="panel poc-panel">
                <PanelTitle
                  number="✓"
                  title="Define the proof before the PoC."
                  note="These are proposed acceptance tests, not completed validation results."
                />
                <div className="poc-grid">
                  {pocCriteria(draft).map((criterion) => (
                    <article key={criterion.id}>
                      <span>{criterion.id}</span>
                      <h3>{criterion.name}</h3>
                      <p>{criterion.method}</p>
                      <div>
                        <strong>PASS CRITERION</strong>
                        <p>{criterion.target}</p>
                      </div>
                      <footer>
                        <b>Proposed owner:</b> {criterion.owner}
                        <br />
                        <b>Evidence:</b> {criterion.evidence}
                      </footer>
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}
          {view === "proposal" && !a && (
            <div className="panel empty-panel">
              <Info size={25} />
              <h2>Resolve the invalid inputs first.</h2>
              <p>
                The last proposal is not presented as current while its
                underlying brief is invalid.
              </p>
              <button
                className="button outline"
                onClick={() => go("discovery")}
              >
                Return to discovery
              </button>
            </div>
          )}
          {view === "method" && <Method />}
          <footer className="workbench-footer">
            <span>
              <Layers3 size={14} />
              Explicit assumptions. Inspectable decisions.
            </span>
            <a
              href="/docs/VALIDATION.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              Validation evidence
              <ArrowUpRight size={13} />
            </a>
          </footer>
        </main>
      </div>
      <dialog
        className="scenario-dialog"
        ref={scenarioDialog}
        aria-labelledby="scenario-title"
        onCancel={() => setScenarioOpen(false)}
        onClose={() => setScenarioOpen(false)}
      >
        <div className="dialog-header">
          <div>
            <span className="eyebrow">THREE FICTIONAL WORKSHOPS</span>
            <h2 id="scenario-title">Start with a customer problem.</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close scenario selection"
            onClick={() => setScenarioOpen(false)}
          >
            <X size={21} />
          </button>
        </div>
        <p>
          Loading a scenario replaces the current browser draft. Export your
          brief first to keep your changes.
        </p>
        <div className="scenario-grid">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setDraft(loadScenario(s.id));
                setInspect(null);
                setEditing(null);
                setScenarioOpen(false);
                setNotice(
                  `${s.name} loaded. All names, rates and requirements are fictional planning inputs.`,
                );
                go("discovery");
              }}
            >
              <span className="scenario-letter">{s.name[0]}</span>
              <small>{s.sector}</small>
              <strong>{s.name}</strong>
              <p>{s.description}</p>
              <span className="scenario-link">
                Open scenario
                <ArrowRight size={15} />
              </span>
            </button>
          ))}
        </div>
      </dialog>
    </div>
  );
}
function Architecture({
  draft,
  analysis,
  inspect,
  onInspect,
}: {
  draft: Draft;
  analysis: Analysis;
  inspect: OptionId | null;
  onInspect: (id: OptionId) => void;
}) {
  const candidate =
    analysis.candidates.find((c) => c.blueprint.id === inspect) ??
    analysis.recommended ??
    analysis.candidates[0];
  return (
    <section className="architecture-panel">
      <div className="section-line">
        <div>
          <span className="tiny">CONCEPTUAL TOPOLOGY / NOT A DEPLOYMENT</span>
          <h2>Follow the flow.</h2>
        </div>
        <select
          aria-label="Architecture to inspect"
          value={candidate.blueprint.id}
          onChange={(e) => onInspect(e.target.value as OptionId)}
        >
          {BLUEPRINTS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.shortName}
            </option>
          ))}
        </select>
      </div>
      <div
        className="flow-diagram"
        aria-label={`Conceptual architecture: ${candidate.blueprint.name}`}
      >
        {architectureNodes(candidate.blueprint.id).map((node, index) => (
          <div key={node.title}>
            <span className="flow-node">
              <span className="node-icon">
                {index === 0 ? (
                  <Network size={22} />
                ) : index === 1 ? (
                  <Layers3 size={22} />
                ) : (
                  <ClipboardCheck size={22} />
                )}
              </span>
              <strong>{node.title}</strong>
              <small>{node.sub}</small>
            </span>
            {index < 2 && <ArrowRight className="flow-arrow" size={22} />}
          </div>
        ))}
      </div>
      <div className="architecture-bottom">
        <span>
          <MapPin size={14} />
          {draft.brief.dataPolicy === "private-only"
            ? "Private processing required"
            : draft.brief.requireRegion
              ? draft.brief.region || "Deployment location unresolved"
              : "Location to confirm in discovery"}
        </span>
        <Status status={candidate.status} />
      </div>
      <p className="architecture-tradeoff">
        {candidate.blueprint.tradeoff}{" "}
        {candidate.blockers.length > 0 && (
          <strong>
            This inspected option is blocked and will not be recommended.
          </strong>
        )}
      </p>
      <details>
        <summary>
          Inspect this blueprint's assumptions
          <ChevronDown size={14} />
        </summary>
        <ul>
          {candidate.blueprint.assumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
function Method() {
  return (
    <div className="method-layout">
      <section className="panel method-main">
        <PanelTitle
          number="01"
          title="A small, explicit decision model."
          note="Version 1: deterministic, provider-neutral and inspectable."
        />
        <div className="panel-fields">
          <h3>Gates before grades.</h3>
          <p>
            The model checks the permitted processing boundary, required region
            control, intermittent connectivity, minimum latency, operating team,
            planning lead time and monthly cost cap. An option with any hard
            conflict is blocked. If every option is blocked, there is no
            recommendation.
          </p>
          <h3>Scores express priorities.</h3>
          <p>
            Each criterion has a weight from 0 to 5. Contributions are rating ÷
            5 × weight ÷ total weight × 100. At least one weight must be
            non-zero. Fixed ratings are declared judgements about these three
            blueprints. They are not measured product benchmarks.
          </p>
          <div className="table-scroll">
            <table className="result-table">
              <thead>
                <tr>
                  <th>Criterion</th>
                  {BLUEPRINTS.map((b) => (
                    <th key={b.id}>{b.shortName}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(Object.keys(CRITERIA) as Criterion[])
                  .filter((k) => k !== "cost")
                  .map((key) => (
                    <tr key={key}>
                      <th>{CRITERIA[key]}</th>
                      {BLUEPRINTS.map((b) => (
                        <td key={b.id}>
                          {b.ratings[key as Exclude<Criterion, "cost">]}/5
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p>
            Cost rating = 5 × lowest modelled recurring cost across all three
            blueprints ÷ this option's cost. A zero-cost option scores 5; if the
            lowest cost is zero, positive-cost options score 0. The catalogue
            stays fixed when a candidate is blocked. Fit ranks ahead of
            conditional status, then score, then recurring cost, then fixed
            catalogue order.
          </p>
          <h3>Scope is part of the output.</h3>
          <p>
            The 60s / 1s / 2s latency baselines and 4 / 7 / 11-week lead times
            are workshop assumptions. Every two systems beyond the first three
            add one planning week, rounded up. A shortlisted product must prove
            its actual capabilities and costs. User-marked cost review is not
            vendor validation.
          </p>
          <h3>Authored text stays yours.</h3>
          <p>
            Changing a structured input increments the brief revision and
            preserves edited proposal sections. Older edits are flagged for
            review in both the UI and exported Markdown. Free-text notes do not
            silently become constraints: reflect them in the structured fields
            to affect eligibility and scores.
          </p>
          <h3>Your draft stays on this device.</h3>
          <p>
            Calculations, imports, local saving and exports run in your browser.
            There is no AI service, server-side draft storage, analytics or
            account system. The public Worker serves the application and its
            documentation. Use fictional or anonymised discovery information.
          </p>
          <h3>References and evidence.</h3>
          <p>
            The proposed decision record follows the context, decision and
            consequences structure in{" "}
            <a
              href="https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/adr-process.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              AWS's ADR guidance
            </a>
            . The event blueprint's recovery and operating trade-offs draw on{" "}
            <a
              href="https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/event-driven"
              target="_blank"
              rel="noopener noreferrer"
            >
              Microsoft's event-driven architecture guidance
            </a>
            . Neither source supplies the fictional rates, ratings or delivery
            assumptions in this model.
          </p>
          <div className="method-links">
            <a
              className="button outline"
              href="/docs/BUILD_NOTES.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              Architecture & decisions
              <ArrowUpRight size={14} />
            </a>
            <a
              className="button outline"
              href="/docs/VALIDATION.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              Recorded validation
              <ArrowUpRight size={14} />
            </a>
          </div>
        </div>
      </section>
      <aside className="method-note">
        <ShieldCheck size={27} />
        <h2>
          A proposal.
          <br />
          Not a promise.
        </h2>
        <p>
          The workbench makes assumptions visible and tests proposed success
          criteria. It does not claim a customer win, current vendor pricing,
          regulatory approval or production performance.
        </p>
        <span>FICTIONAL DATA / REAL REASONING</span>
      </aside>
    </div>
  );
}
