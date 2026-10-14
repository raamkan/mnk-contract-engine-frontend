# MNK contract engine frontend

React and TypeScript application for the MNK challenge. Reviewers can create an original contract slip, record endorsements, compare original and amended terms, and query a position on a chosen effective date. Django calculates the positions and premiums; PostgreSQL persists the slips and endorsement history.

## Review order

1. Set up PostgreSQL and Django using the [service README](../mnk-contract-engine-service/README.md).
2. Install and start this frontend using the steps below.
3. Complete the manual review sequence and validation scenarios.
4. Run the build, lint and backend automated checks.

No login, seed script or sample database is required. Start with an empty database and create the example contract through the browser. If reviewing separate checkouts, open the service README in that checkout; the relative link assumes the two folders are siblings.

## Dependencies

| Dependency | Requirement / purpose |
| --- | --- |
| Node.js and npm | Node.js 22.13+ within 22.x, or 24.x; npm comes with Node.js. These versions satisfy the engine constraints in the lockfile. |
| Backend | Django API running at `http://127.0.0.1:8000` |
| Database | PostgreSQL 16 started by the service's Docker Compose configuration |
| Browser | A modern browser with date-input support |
| Runtime packages | React 19, React DOM 19, React Router DOM 7 |
| Development packages | TypeScript 6, Vite 8, React Vite plugin, ESLint and TypeScript/React lint plugins |

`package.json` declares dependencies; `package-lock.json` fixes the installed versions. Use `npm ci` for a reproducible install.

## Local setup

### 1. Start the database and API

Follow the service README: create its Python virtual environment, install `requirements.txt`, create its `.env`, then run these commands **inside `mnk-contract-engine-service`** with the environment activated:

```bash
docker compose up -d --wait db
python manage.py migrate
python manage.py check
python manage.py runserver 127.0.0.1:8000
```

Keep the Django terminal open. In another terminal verify:

```bash
curl -i http://127.0.0.1:8000/health/
```

Expect HTTP 200 and `status: "ok"`. PostgreSQL is published on host port **5433**, while the API uses **8000**. Only PostgreSQL runs in Docker.

### 2. Install the frontend

Open a second terminal at the challenge workspace:

```bash
cd mnk-contract-engine-frontend
node --version
npm --version
npm ci
```

For separate repository checkouts, enter the frontend checkout directory instead. All remaining npm commands run from this folder.

### 3. Check environment configuration

The included `.env.development` contains:

```dotenv
VITE_API_BASE_URL=/api
```

If the file is missing, create it with that value. The client also defaults to `/api`. Restart Vite after changing environment files. Vite's `server.proxy` in `vite.config.ts` forwards both `/api` and `/health` to `http://127.0.0.1:8000`, preserving the URL paths. No proxy environment variable is required. `VITE_*` values are exposed to the browser and must not contain secrets.

### 4. Run and verify

```bash
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open **http://127.0.0.1:5173**. The root redirects to `/contracts`. An empty database should show the empty contract-list state; existing records should appear in the list. The strict port option prevents Vite silently switching to another port.

Check both proxy routes from another terminal:

```bash
curl -i http://127.0.0.1:5173/health/
curl -i http://127.0.0.1:5173/api/contracts/
```

Expect HTTP 200 for both. The second response is a JSON array, initially `[]` on an empty database. Keep PostgreSQL, Django and Vite running together.

## End-to-end browser review

Use the following fixed dates even if reviewing in a different year. The default position uses today's UTC date, so explicitly change **Effective as at** for every assertion below. Changing that date fetches the position automatically. Monetary values may be formatted with currency symbols and separators in the browser; compare their numeric values.

Use a new reference for each run, such as `MNK-REVIEW-001`, then `MNK-REVIEW-002`. Stored slips and endorsements have no edit/delete UI. The API samples in the service README use a different reference, so they can coexist with this sequence.

### 1. Create the original slip

Open `/contracts/new`, fill these fields, and click **Create contract**:

| Field | Value |
| --- | --- |
| MGA reference | `MNK-REVIEW-001` |
| Insured name | `Raman Logistics Ltd` |
| Class of business | `Property` |
| Currency | `INR` |
| Inception date | `2026-10-10` |
| Expiry date | `2026-12-31` |
| Sum insured | `5000000.00` |
| Gross premium | `120000.00` |
| Brokerage (%) | `20.00` |
| Signed line (%) | `25.00` |

Expected: navigation to `/contracts/MNK-REVIEW-001`. Set **Effective as at** to `2026-10-10`. Original and amended values match, status is Bound, net premium is `96000.00` and our net premium is `24000.00`. Return to `/contracts` and confirm the reference is listed, then reopen its detail page.

### 2. Add a sum-insured endorsement and test its date boundary

Click **Add endorsement**. Set **What is changing?** to **Sum insured**, status to **Agreed**, number to `1`, effective date to `2026-11-10`, recorded date to `2027-02-14`, premium change to `20000.00`, new sum insured to `6000000.00`, and reason to `New warehouse added`. Click **Add agreed endorsement**.

Expected: success feedback, refreshed data, and endorsement 1 in the Endorsements tab. Its recorded date is retained for audit.

| Effective as at | Amended sum insured | Gross | Net | Our net | Applied numbers |
| --- | --- | --- | --- | --- | --- |
| `2026-11-09` | `5000000.00` | `120000.00` | `96000.00` | `24000.00` | None |
| `2026-11-10` | `6000000.00` | `140000.00` | `112000.00` | `28000.00` | 1 |

The original column must retain sum insured `5000000.00` and gross `120000.00`. The later recorded date does not delay the endorsement. Try the comparison's changed-fields checkbox to inspect amended fields.

### 3. Save a draft and verify exclusion

Add **Premium adjustment**, status **Draft**, number `2`, effective date `2026-11-15`, recorded date `2026-11-16`, premium change `5000.00`, reason `Proposed additional premium`. Click **Save draft**.

Set the position date to `2026-11-15`. Expected: draft 2 appears in history but is not applied. Gross remains `140000.00`, net `112000.00`, our net `28000.00`. There is no action to promote a saved draft; an agreed endorsement must use a different number.

### 4. Change insured details

Add **Insured name**, status **Agreed**, number `3`, effective date `2026-11-20`, recorded date `2026-11-21`, premium change `0.00`, new insured name `Raman Logistics Group Ltd`, reason `Company name updated`.

Set the position date to `2026-11-20`. Expected: amended insured name changes, original insured name stays `Raman Logistics Ltd`, and gross remains `140000.00`. Applied numbers are 1 and 3.

### 5. Extend cover

Add **Cover extension**, status **Agreed**, number `4`, effective date `2026-12-01`, recorded date `2026-12-02`, premium change `10000.00`, new expiry date `2027-06-30`, reason `Extend policy period`.

At `2026-11-30`, amended expiry is still `2026-12-31` and gross is `140000.00`. At `2026-12-01`, expiry becomes `2027-06-30`, gross `150000.00`, net `120000.00`, and our net `30000.00`. The original expiry remains `2026-12-31`.

### 6. Apply an agreed premium adjustment in the extended period

Add **Premium adjustment**, status **Agreed**, number `5`, effective date `2027-01-10`, recorded date `2027-01-11`, premium change `-10000.00`, reason `Agreed premium return`.

At `2027-01-09`, gross is `150000.00`. At `2027-01-10`, gross is `140000.00`, net `112000.00`, and our net `28000.00`. This also verifies that the agreed extension permits an endorsement after the original expiry.

### 7. Cancel and check the calculated refund

Add **Cancellation**, status **Agreed**, number `6`, effective date `2027-02-01`, recorded date `2027-02-02`, reason `Insured requested cancellation`. The form sends `premium_change: null`; the backend calculates the refund.

The extended period is 264 inclusive days, with 150 unused days. The refund is `-79545.45` (`140000 × 150 / 264`, rounded half up).

| Effective as at | Status | Cover end | Gross | Net | Our net |
| --- | --- | --- | --- | --- | --- |
| `2027-01-31` | Bound | `2027-06-30` | `140000.00` | `112000.00` | `28000.00` |
| `2027-02-01` | Cancelled | `2027-01-31` | `60454.55` | `48363.64` | `12090.91` |

History contains numbers 1–6, including draft 2. The cancellation position applies 1, 3, 4, 5 and 6. The original slip remains Bound with its original dates and premium. The list displays original slip status, so its Bound badge does not represent the amended cancellation status.

Reload the page and select `2027-02-01` again: all saved records and calculated values should persist.

## Validation and additional scenarios

For rejection scenarios, enter otherwise valid data and a nonblank reason. Confirm an error is displayed and no endorsement is added. Use a fresh contract with the original values above when a scenario's prerequisites differ from the completed cancellation sequence.

| Scenario | Steps | Expected result |
| --- | --- | --- |
| Required contract fields | Submit an empty create form | Field errors and focus on the first invalid field |
| Invalid original amounts / percentages | Enter negative gross, `1.234` sum insured, or brokerage `101` | Frontend validation blocks submission |
| Invalid original dates | Set expiry before inception | Frontend expiry error |
| Duplicate reference | Recreate the example with the same reference | Backend 400 surfaced at MGA reference |
| Duplicate endorsement | Reuse number 1 with otherwise valid data | Backend number error, even if the existing record is a draft |
| Missing change value | Choose Sum insured, Insured name or Cover extension and leave its extra field empty | Field validation error |
| Blank reason | Submit a valid endorsement with an empty reason | Backend reason error |
| Outside cover | On a fresh contract, use effective date `2026-10-09` or `2027-01-01` | Backend effective-date error |
| Invalid extension | On a fresh contract, extend to `2026-12-31` or an earlier date | Backend new-expiry error |
| Excessive agreed return | On a fresh contract, add agreed premium adjustment `-120000.01` effective `2026-11-01` | Backend premium error; gross cannot become negative |
| Exact zero balance | On a separate fresh contract, add agreed premium adjustment `-120000.00` effective `2026-11-01` | Accepted; gross, net and our net all zero on that date |
| Post-cancellation change | After the main sequence, add number 7 effective `2027-02-01` or later | Backend effective-date error, including for drafts |
| Conflicting cancellation | On a fresh contract first add an agreed adjustment effective `2026-12-10`, then cancel effective `2026-12-01` | Cancellation rejected because an agreed change already exists on/after cancellation |
| Backdated refund change | After the main sequence, try agreed adjustment number 7, `1000.00`, effective `2027-01-15` | Rejected because it would alter the stored cancellation refund |
| Before inception | Select `2026-10-09` | Original values, Bound status, no applied endorsements |
| After normal expiry | On a fresh contract without cancellation, select `2027-01-01` | Bound status remains; no automatic Expired status |
| Missing contract / route | Open `/contracts/DOES-NOT-EXIST`, then `/unknown-page` | Contract error state / not-found page respectively |
| API unavailable | Stop Django with Ctrl+C, reload the contract list, then restart Django and retry | Error state, followed by recovered data |

For exact JSON assertions, inspect browser Network responses or use the service's curl examples. The API applies eligible endorsements in **endorsement-number order**, and ignores recorded date for position filtering. It supports `as_at`, not `known_at`; the frontend's “As known at” control is disabled in code.

## Build and checks

Run from the frontend directory:

```bash
npm run lint
npm run build
```

Expected: both exit successfully. The build first runs TypeScript project checks (`tsc -b`) and then produces static assets in `dist/`. There is currently no frontend unit-test or browser-test runner and no `npm test` script; the scenarios above are the manual browser checks.

For a local build preview with working API requests, run:

```bash
npm run preview -- --host 127.0.0.1 --port 5173 --strictPort
```

Stop the dev server first to free port 5173. Vite preview inherits the configured server proxy, so keep Django running on port 8000. Verify `/health/` and `/api/contracts/` on port 5173 before repeating the browser sequence. Preview serves the built output; rebuild after changing source files. It is a local verification server.

Backend automated checks run from the service directory with its virtual environment activated and PostgreSQL running:

```bash
python manage.py check
python manage.py test contracts --verbosity 2
```

See the service README for focused suites covering API validation, position ordering, decimals, extensions and cancellation. The frontend submits money as decimal strings and displays backend-calculated financial results.

## Code reading guide

| File / directory | What to review |
| --- | --- |
| `src/main.tsx`, `src/App.tsx` | Application entry and browser routes |
| `src/contracts/layout/` | Shared layout, header and sidebar |
| `src/contracts/pages/ContractsPage.tsx` | Contract list, loading, empty and error states |
| `src/contracts/pages/CreateContractPage.tsx` | Original-slip form, validation and creation |
| `src/contracts/pages/ContractDetailsPage.tsx` | Detail tabs, date selection, endorsement creation and refresh |
| `src/contracts/components/EndorsementForm.tsx` | Five endorsement types, dynamic fields and decimal-string payloads |
| `src/contracts/components/ContractPositionPanel.tsx` | Original/amended comparison and premium breakdown |
| `src/contracts/components/EndorsementsTable.tsx` | History and applied-endorsement presentation |
| `src/hooks/` | Fetching, cancellation of stale requests, retry and position selection |
| `src/api/client.ts`, `src/api/contracts.ts` | Fetch wrapper, routes and flattened Django validation errors |
| `src/types/contract.ts` | Contract, endorsement and position types |
| `src/utils/format.ts` | Display formatting |
| `vite.config.ts` | React plugin and local API/health proxies |

Trace a review action from page → API function → Django view → serializer/service → PostgreSQL. The service README maps the backend files and explains calculation rules.

## Troubleshooting and stopping

| Problem | Resolution |
| --- | --- |
| `npm ci` engine error | Check Node version against the requirement above. Install with the committed lockfile. |
| Port 5173 already in use | Stop the previous dev/preview server, then rerun with `--strictPort`. |
| Proxy `ECONNREFUSED` / failed API requests | Verify Django's `/health/` directly on port 8000, then through port 5173. Start Django at the proxy's configured address. |
| Database errors | Check `docker compose ps`, service `.env`, and migrations from the service folder. Django uses host port 5433. |
| Build runs but contracts do not load | Keep the backend running; frontend assets do not include an API or database. |
| CORS error after using an absolute API URL | Restore `/api` for local proxy use. Django allows frontend origins `http://localhost:5173` and `http://127.0.0.1:5173`. |
| Stored endorsement seems absent | Check Draft/Agreed status and selected effective date. A successful save does not imply it applies at every date. |
| Default date differs near midnight | Django's default date uses UTC; explicitly select the test date. Form defaults use the browser's local date. |

Stop Vite and Django with Ctrl+C in their terminals. From the service folder, `docker compose stop db` stops PostgreSQL and retains its data; `docker compose up -d --wait db` starts it again. `docker compose down` removes containers but retains the named volume. `docker compose down -v` deletes stored database data and should be used only for an intentional disposable-data reset, followed by startup and migrations.
