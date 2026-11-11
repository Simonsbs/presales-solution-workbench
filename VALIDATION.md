# Validation evidence

The workbench is tested with fictional briefs and planning rates. Agent validation establishes the implemented model's behaviour and the app workflow. It does not complete any of the proposed customer PoC tests, establish vendor capabilities or replace stakeholder review.

## Automated coverage

The 48 unit tests cover the three baseline/changed-constraint pairs, arithmetic and budget boundaries, hard gates, conditional locations, weighted grades, zero-price ties, snapshot isolation, stale edits, input bounds, unknown fields, prototype-shaped imports, export size, safe SVG/Markdown/CSV text, actual ZIP extraction and browser persistence fallbacks.

`npm run validate` records scenario decisions and actual ZIP round trips in `docs/validation/domain.json`, including individual verdicts, source hashes and local timing observations. Its independent expected cost totals reconcile Northstar's monthly cost to 94,144 pence, one-off effort to 600,000 pence and year one to 1,729,728 pence under the fictional GBP assumptions.

The build artifact check imports the actual compiled Worker and exercises the HTML, scripts, documentation, security headers, fingerprint, 404, 405 and HEAD responses. Windows and Linux CI run type checking, unit tests, scenario validation, build validation and the dependency audit. Reported timings apply only to recorded small local fixture runs, not a production throughput benchmark or SLA.

## Browser and publication

Version 1 is public without sign-in at [presales.bestdev.co.il](https://presales.bestdev.co.il/). DNS and TLS are active. All 48 unit tests, 12 scenario/export checks, type checking and the compiled Worker checks pass. The dependency audit reports zero vulnerabilities. [Windows and Linux CI](https://github.com/Simonsbs/presales-solution-workbench/actions/runs/43046670798) both pass for the initial application release.

Fourteen local browser checks and ten public browser checks pass. The actual public ZIP was downloaded, independently extracted and re-imported through the app; its revision, pinned baseline, changed requirement, recommendation, authored text and stale-review flag were inspected. Desktop and 390 by 844 mobile views were checked. A passing local build alone is not proof of a public release. Native hosting metadata records each exact source commit and saved Site version.

| Evidence | Result |
| --- | --- |
| `unit.json` | 48 passed, zero failed |
| `domain.json` | 12 passed, source hashes and cost reconciliation |
| `browser-local.json` | 14 local workflow, recovery and responsive checks |
| `browser-public.json` | 10 real public browser checks |
| `browser-export-local.json`, `browser-export-public.json` | Actual downloaded ZIP contents and hashes |
| `hosting-smoke.json`, `public-smoke.json` | Six checks pass on each public hostname |
| `desktop.png`, `mobile.png` | Captured public application views |

The application source fingerprint is `cebc4d1eed1a561c4691c440e1d75fbc1f1c5b48e749f629430b21b08a79c4a7`. The initial release deployed application commit `bbfed695c26cec4f6d1c048c022ed0120de7ba3b`; later documentation and evidence publication keeps that application fingerprint unchanged. CI also runs for those source commits.

Public checks verify application assets and local fonts, security/cache headers, documentation, source fingerprint, no sign-in, unknown routes and rejection of draft POSTs. The client workflow is checked separately because the calculation and persistence logic runs in the visitor's browser.

## Retained development failures

`initial-unit-failures.json` retains the first 46/48 result. The reviewed-cost export was clarified to explicitly distinguish planning assumptions from a vendor quotation. The initial oversized-import fixture was smaller than intended because astral characters occupy two UTF-16 code units. `size-fixture-correction.json` retains the next 47/48 result; the final size regression uses a verified oversized JSON encoding. Subsequent passing reports remain separate from this failed evidence.

## Limits

The catalogue is intentionally restricted to three declared designs. Free-text notes require structured-field updates to change the model. User-marked review is not a human benchmark, customer approval or verification of product functionality. Basic responsive and keyboard checks do not constitute a complete accessibility audit. There is no collaborative backend, actual integration deployment, live vendor pricing, AI inference or production service claim.
