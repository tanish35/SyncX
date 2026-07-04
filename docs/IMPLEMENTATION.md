# Implementation Notes

## App

- Next app router under `src/app`.
- Server routes under `src/app/api`.
- Shared sync code under `src/lib/sync`.
- Provider clients under `src/lib/stremio` and `src/lib/nuvio`.
- Database schema under `src/lib/db/schema.ts`.

## Sync

`syncStep` advances one bounded batch at a time:

1. `pull-stremio`
2. `pull-nuvio`
3. `push-stremio`
4. `push-nuvio`

Dashboard `Sync Now` loops until all phases finish. `Pull only` uses the same endpoint with pull mode and stops after the pull phases.

## Checks

```bash
npm run build
npm run lint
npm run test
```
