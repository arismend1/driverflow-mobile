# DriverFlow mobile — match acceptance compatibility review

Date: 2026-10-23
Repository: `arismend1/driverflow-mobile`
Working branch: `security-mobile-phase1-2026-10`
Release status: **SECURITY BRANCH ONLY — NOT PUBLISHED OR DEPLOYED**

## Backend contract verified in security source

- Company match list: `GET /matches/candidates`
- Driver match list: `GET /matches/opportunities`
- Acceptance action: `POST /matches/:id/accept`
- Both list endpoints return an array. Requests use the authenticated user's bearer token.
- `POST /matches/:id/accept` may return `409 match_update_conflict` or `409 invalid_match_state` when the match moved between a previous read and a later write. The security-branch backend can acknowledge a repeated acceptance after it confirms the authenticated actor's own acceptance timestamp has already been stored.
- These changes concern **account ownership and matching only**, not Stripe checkout or contact-sharing authorization.

## Security-branch mobile adjustment

`src/screens/MatchesScreen.tsx` now:

1. Prevents repeated quick taps on the same **Accept Interest** button using an in-flight ref guard and disabled/loading UI.
2. For HTTP 409 with `match_update_conflict` or `invalid_match_state`, refreshes the current user's match list, using the existing authenticated backend endpoint.
3. Suppresses the misleading error only after the refreshed record matches the requested `match_id`, has a completed/advanced matching state, and has **that actor's own existing acceptance timestamp**.
4. Preserves the error if the refresh fails, the match is missing, another actor accepted instead, the caller role is missing, the error isn't one of the two expected codes, or consent isn't independently visible.
5. Makes no new payment call, unlock operation, local permission assignment, or speculative match-state change. Production API settings and Stripe logic remain untouched.

The decision logic lives in `src/utils/matchAcceptance.ts` and is covered by `__tests__/matchAcceptance.test.ts` (ten unit cases as of this report). The screen's full native UI and real-device flows have not been exercised here.

## Verified mobile unit test result — October 23, 2026

**GitHub Actions run #5 passed**, on code commit `24c5286e57fe4bc22485516e7d33c610d76f63a1`: [View successful mobile run](https://github.com/arismend1/driverflow-mobile/actions/runs/39946361299). The actual job logs show `PASS __tests__/matchAcceptance.test.ts`, **1 Jest suite passed and 10 of 10 unit tests passed, zero failed**. The dependency-install step also passed after using `npm ci --ignore-scripts --legacy-peer-deps --no-audit --no-fund`.

GitHub commit comparison between the successfully tested commit and the following audit-report commit `fb4036e` showed **only this Markdown document changed**. No UI, acceptance helper, test or dependency files changed after the successful run.

**Coverage and limitation:** these tests cover pure reconciliation decisions for error codes, matching IDs, actor-specific acceptance timestamps, completed match states, missing records, unauthorized actors, and failed refreshes. They do *not* render the React Native screen or replace Android/iOS builds, end-to-end mobile tests, complete TypeScript validation or real-device testing. The guard against repeated quick taps was reviewed in the screen source but not exercised by these ten pure-function tests.

## Isolated CI

`.github/workflows/mobile-match-acceptance-tests.yml` runs only in the mobile security branch (or by manual workflow dispatch), installs dependencies without package lifecycle scripts, and executes:

```sh
npx jest __tests__/matchAcceptance.test.ts --runInBand
```

The first CI attempts failed **before tests ran** due to a pre-existing `npm ci` peer-resolution conflict: `react-native-print@0.11.0` references `react-native-windows` with an incompatible React peer range. The isolated workflow has been adjusted to use `npm ci --ignore-scripts --legacy-peer-deps` while leaving `package.json`, `package-lock.json`, native builds and all production dependencies unchanged.

CI execution after this adjustment is subject to independent confirmation; a workflow file being present is **not** proof of successful tests.

## Release blockers

- Confirm a successful GitHub Actions test run for the exact current mobile helper and tests.
- Perform mobile build/type-check and real-device review of match acceptance, sharing and payment flows.
- Validate full backend/PG behavior under test-only isolated infrastructure and authorize any real deployment separately.
- No change to the stable repository, `main`, live API, Render, production databases, Stripe or Google Play.
