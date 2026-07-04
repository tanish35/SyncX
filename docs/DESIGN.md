# SyncX Design

SyncX syncs watch progress between Stremio and Nuvio.

## Shape

- D1 stores the canonical watch state.
- Stremio and Nuvio are synced by pull, merge, then push.
- The dashboard shows connection state, manual sync controls, settings, and the currently-watching database view.
- Release scanning and email notifications are optional helpers around the stored series data.

## Data Model

- `users`: account/session owner.
- `connections`: provider credentials and sync cursors for `stremio` and `nuvio`.
- `media`: movies and series metadata.
- `videoIndex`: series episode index where available.
- `watchState`: per-user movie or episode progress.
- `pushLog`: echo suppression for provider writes.
- `notifications`: queued new-episode notices.

## Sync Flow

1. Pull Stremio progress into `watchState`.
2. Pull Nuvio progress into `watchState`.
3. Push changed local rows to Stremio.
4. Push changed local rows to Nuvio.

Manual pull-only mode runs steps 1 and 2, then stops so fetched rows can be inspected before anything is pushed.
