# Noticed

Single-owner creator studio (blog + LinkedIn/X drafts). Local-first with optional hosted MCP for ChatGPT.

## Quick start

```bash
npm install --legacy-peer-deps
npx prisma migrate deploy
npm run dev          # http://localhost:3004
npm run mcp          # stdio MCP (Claude Desktop / Cursor)
```

## ChatGPT (hosted MCP)

See [docs/CHATGPT-MCP.md](docs/CHATGPT-MCP.md) — Fly.io + Streamable HTTP + OAuth (no tunnel).

```bash
# After deploy:
# Server URL → https://<app>.fly.dev/api/mcp
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Next.js UI on port 3004 |
| `npm run mcp` | Local stdio MCP |
| `npm run build` / `start` | Production UI + `/api/mcp` |
| `npm run smoke:mcp` | OAuth + tools/list smoke (server must be running) |
