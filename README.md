# KODI Web

A web UI for an existing KODI media library stored in MariaDB.

## Roadmap

**Stage 1:** React/Vite frontend + Node/Express API on Synology NAS. The API talks to the existing MariaDB over the private network.

**Stage 2:** Move the frontend to Cloudflare Pages and the API to Cloudflare Workers. Keep MariaDB if practical through Cloudflare Hyperdrive and private connectivity.

## Start here with Codex

Open the repository in Visual Studio Code with the Codex extension, then use:

> Read AGENTS.md and docs/JIRA_BACKLOG.md. Start KODI-001 only. Follow the Jira sprint workflow and relevant repo skills. Show me the plan before modifying files, then implement, test, and summarize the result.

After KODI-001 is complete:

> Start KODI-002. Do not work on any other ticket.

This keeps Codex operating like a developer working from a Jira backlog rather than trying to build the entire application in one prompt.

## Planned repository layout

```text
kodi-web/
├─ AGENTS.md
├─ README.md
├─ package.json
├─ .env.example
├─ .gitignore
├─ docker-compose.yml
├─ apps/
│  ├─ api/
│  │  └─ src/
│  └─ web/
│     └─ src/
├─ docs/
│  ├─ ARCHITECTURE.md
│  ├─ PRODUCT_SCOPE.md
│  ├─ JIRA_BACKLOG.md
│  ├─ DEFINITION_OF_DONE.md
│  └─ KODI_DB_DISCOVERY.md
└─ .agents/
   └─ skills/
```

## Security baseline

The Stage 1 database account should be read-only and limited to the KODI database(s). Never expose MariaDB port 3306 to the Internet.

## Environment

Copy `.env.example` to `.env` locally and fill in your own values. Never commit `.env`.

The KODI video database name is versioned. Set `KODI_VIDEO_DB` after discovery; do not assume the suffix.

## Production containers

Build and start the Stage 1 services with:

```powershell
docker compose up --build -d
docker compose ps
```

The web UI is published at `http://localhost:8181`; nginx serves the static
React build and proxies `/api` to the private API service. The API is also
published on port `3001` for local diagnostics. Both images use multi-stage
builds and define health checks. The API runtime runs as the unprivileged
`node` user, while the web runtime uses the standard nginx Alpine image.

Compose uses `restart: unless-stopped` for both services: Docker restarts them
after failures or host restarts unless an operator explicitly stops them. The
web service waits for the API health check before starting.

Production configuration is read from the uncommitted `.env` file:

- `KODI_DB_HOST`: private-LAN MariaDB hostname or IP address; required.
- `KODI_DB_PORT`: MariaDB port; defaults to `3306`.
- `KODI_DB_USER`: dedicated SELECT-only MariaDB user; required.
- `KODI_DB_PASSWORD`: password for the read-only user; required.
- `KODI_VIDEO_DB`: discovered versioned database name; required.

`NODE_ENV=production` and `API_PORT=3001` are set by Compose. Do not expose
MariaDB port 3306 publicly or commit the populated `.env` file.
