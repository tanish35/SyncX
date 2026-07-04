# Run And Deploy

SyncX is a Cloudflare/Next app for syncing watch progress between Stremio and Nuvio.

## Local Setup

1. Install dependencies.
2. Copy `.dev.vars.example` to `.dev.vars`.
3. Fill `SESSION_SECRET` and `CRED_ENC_KEY`.
4. Run local D1 migrations.
5. Start the dev server.

```bash
npm run dev:setup
npm run dev
```

## Environment

| Variable | Purpose |
| --- | --- |
| `DB` | Cloudflare D1 binding |
| `SESSION_SECRET` | Session JWT signing |
| `CRED_ENC_KEY` | Credential encryption |
| `TMDB_ACCESS_TOKEN` | Optional metadata lookup |
| `GMAIL_USER` | Optional email notifications |
| `GMAIL_APP_PASSWORD` | Optional email notifications |

## Deploy

Set production secrets with Wrangler, then deploy:

```bash
bunx wrangler secret put SESSION_SECRET
bunx wrangler secret put CRED_ENC_KEY
npm run deploy
```
