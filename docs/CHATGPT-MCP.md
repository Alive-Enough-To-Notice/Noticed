# ChatGPT ↔ Noticed MCP

Connect ChatGPT to Noticed the same way as InfraNet: a **public HTTPS** Streamable HTTP MCP endpoint with OAuth (Connect button). No tunnel.

## What you get

Five tools (drafts only — publish stays in Studio UI):

- `search_content`
- `get_brand_context`
- `create_content_draft`
- `update_draft`
- `get_calendar`

MCP URL (after deploy): `https://<app>.fly.dev/api/mcp`

## Secrets (required on Fly)

```bash
fly secrets set \
  NOTICED_OWNER_PASSWORD='your-strong-password' \
  NOTICED_SESSION_SECRET='long-random-string' \
  NOTICED_PUBLIC_ORIGIN='https://<app>.fly.dev'
```

Optional: `NOTICED_OWNER_NAME` for activity attribution.

When `NOTICED_OWNER_PASSWORD` is set, the Studio UI requires the same password at `/login`.

## Deploy (Fly.io + SQLite volume)

Prereqs: [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/), logged in (`fly auth login`).

```bash
cd /Users/BooBear/noticed

# First time only — creates the app + volume from fly.toml
fly apps create noticed   # skip if app name taken; edit fly.toml app =
fly volumes create noticed_data --region ord --size 1

fly secrets set \
  NOTICED_OWNER_PASSWORD='...' \
  NOTICED_SESSION_SECRET='...' \
  NOTICED_PUBLIC_ORIGIN='https://noticed.fly.dev'

fly deploy
```

Cost is roughly a shared-cpu-1x machine (~$5/mo) with auto-stop off so ChatGPT can always reach MCP.

### Optional: seed existing local drafts

```bash
fly sftp shell
# put local file to /data/noticed.db (stop the machine first if SQLite is locked)
```

Or start empty and create content via ChatGPT / Studio.

## Connect ChatGPT

1. ChatGPT → **Settings → Connectors** (or Apps / Advanced → MCP)
2. Add a custom connector with server URL: `https://<app>.fly.dev/api/mcp`
3. Complete **Connect** / OAuth — enter the owner password on Noticed’s authorize page, then **Approve**
4. Confirm the five tools appear

If tools look stale after a deploy: delete the connector and re-add under a new name (same lesson as InfraNet).

## Local development

```bash
# UI (no password gate unless NOTICED_OWNER_PASSWORD is in .env)
npm run dev

# Stdio MCP for Claude Desktop / Cursor
npm run mcp

# Hosted-style HTTP MCP locally
NOTICED_OWNER_PASSWORD=dev \
NOTICED_PUBLIC_ORIGIN=http://localhost:3004 \
npm run build && npm run start
```

Claude Desktop stdio example:

```json
{
  "mcpServers": {
    "noticed": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/Users/BooBear/noticed"
    }
  }
}
```

## Smoke-check OAuth metadata

```bash
curl -s https://<app>.fly.dev/.well-known/oauth-authorization-server | jq .
curl -s -o /dev/null -w '%{http_code}\n' https://<app>.fly.dev/api/mcp
# Expect 401 without a bearer token
```

## Out of scope

- MCP publish to Narrareach / WordPress (use Studio)
- Multi-user accounts / workforce grants
- Postgres (SQLite on the Fly volume is intentional)
