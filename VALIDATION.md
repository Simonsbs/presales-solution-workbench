# Validation evidence

The workbench is tested with fictional briefs and planning rates. Agent validation establishes the implemented model's behaviour and the app workflow. It does not complete any of the proposed customer PoC tests, establish vendor capabilities or replace stakeholder review.

## Automated coverage

The 48 unit tests cover the three baseline/changed-constraint pairs, arithmetic and budget boundaries, hard gates, conditional locations, weighted grades, zero-price ties, snapshot isolation, stale edits, input bounds, unknown fields, prototype-shaped imports, export size, safe SVG/Markdown/CSV text, actual ZIP extraction and browser persistence fallbacks.

`npm run validate` records scenario decisions and actual ZIP round trips in `docs/validation/domain.json`, including individual verdicts, source hashes and local timing observations. Its independent expected cost totals reconcile Northstar's monthly cost to 94,144 pence, one-off effort to 600,000 pence and year one to 1,729,728 pence under the fictional GBP assumptions.

The build artifact check imports the actual compiled Worker and exercises the HTML, scripts, documentation, security headers, fingerprint, 404, 405 and HEAD responses. Windows and Linux CI run type checking, unit tests, scenario validation, build validation and the dependency audit. Reported timings apply only to recorded small local fixture runs, not a production throughput benchmark or SLA.

## Browser and publication

Desktop/mobile browser checks, actual downloaded proposal packs, public HTTPS checks and the final release record are recorded under `docs/validation/` as completed. A passing local build alone is not proof of a public release. Native hosting metadata records the exact source commit and saved Site version.

Public checks verify application assets and local fonts, security/cache headers, documentation, source fingerprint, no sign-in, unknown routes and rejection of draft POSTs. The client workflow is checked separately because the calculation and persistence logic runs in the visitor's browser.

## Retained development failures

`initial-unit-failures.json` retains the first 46/48 result. The reviewed-cost export was clarified to explicitly distinguish planning assumptions from a vendor quotation. The initial oversized-import fixture was smaller than intended because astral characters occupy two UTF-16 code units. `size-fixture-correction.json` retains the next 47/48 result; the final size regression uses a verified oversized JSON encoding. Subsequent passing reports remain separate from this failed evidence.

## Limits

The catalogue is intentionally restricted to three declared designs. Free-text notes require structured-field updates to change the model. User-marked review is not a human benchmark, customer approval or verification of product functionality. Basic responsive and keyboard checks do not constitute a complete accessibility audit. There is no collaborative backend, actual integration deployment, live vendor pricing, AI inference or production service claim.
