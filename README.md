# Agent Usage

A Chrome extension that shows **consumer AI subscription usage** for Codex, Claude, and Cursor in one popup. It reads the same session you already use in the browser — no API keys, no backend, no account on our side.

Current version: **0.1.0** (see `extension/manifest.config.ts`).

## Install (recommended — no npm)

This is the path for normal users. You only need Chrome and a downloaded zip from the repo’s GitHub Releases page.

1. Download the latest `agent-usage-vX.Y.Z.zip` from the repo’s [GitHub Releases](https://github.com/<your-org-or-username>/Agent-Usage-/releases) page (create Releases after you push the repo).
2. Unzip it to a folder you will keep (for example `~/Apps/agent-usage`).
3. Open `chrome://extensions`.
4. Turn on **Developer mode** (top right).
5. Click **Load unpacked** and select the **unzipped folder** (the one that contains `manifest.json` at the top level).
6. Pin the extension if you want quick access from the toolbar.

Chrome will show a warning that the extension is not from the Chrome Web Store. That is expected for unpacked installs.

### First-time setup

1. Log in to each provider you care about in the **same Chrome profile** (cursor.com, chatgpt.com for Codex, claude.ai).
2. Click the Agent Usage icon → **Connect** on a provider card.
3. Use **Import from browser session** (easiest). Manual paste is there if import fails.

The popup refreshes about every 60 seconds while open. A background job also polls every 5 minutes when Chrome is running.

## What each provider shows

| Provider | What you see | How it connects |
|----------|--------------|-----------------|
| **Cursor** | Total usage, Auto + Composer, API % | `WorkosCursorSessionToken` cookie |
| **Codex** | 5-hour and weekly limits | ChatGPT account session at chatgpt.com |
| **Claude** | 5-hour and 7-day windows (plus Sonnet/Opus when returned by the API) | `sessionKey` cookie |

Usage numbers come from each vendor’s own dashboard-style endpoints, not official public APIs. If a provider changes their site, numbers may stop updating until the adapter is fixed.

Codex is labeled **Codex** in the UI but still uses your ChatGPT login — there is no separate ChatGPT usage meter in this extension because ChatGPT does not expose one the same way.

## How it works

```
You (logged in on vendor sites)
        │
        ▼
  Chrome cookies / pasted session token
        │
        ▼
  extension/src/adapters/*.ts  ──fetch──▶  cursor.com / chatgpt.com / claude.ai
        │
        ▼
  chrome.storage.local  (credentials + cached usage snapshots)
        │
        ▼
  Popup UI (extension/src/popup/)
```

**Provider adapters** (`extension/src/adapters/`) each know one vendor: how to read a session, which URL to call, and how to map the JSON into progress bars.

**Background service worker** (`extension/src/background/index.ts`) handles connect/disconnect, refresh requests, and a `chrome.alarms` poll every 5 minutes (`POLL_INTERVAL_MINUTES` in `extension/src/storage/usage-cache.ts`).

**Popup** (`extension/src/popup/App.tsx`) loads cached data immediately, triggers a refresh in the background, and auto-refreshes every 60 seconds while open.

There is no server component. The extension never sends your tokens to a project-owned backend.

## Security and privacy

**Credentials stay local.** Session tokens and cookies are stored in `chrome.storage.local` on your machine. Disconnecting a provider removes its stored connection from that storage.

**No passwords.** The extension does not ask for your password. It reuses session cookies you already have after logging in on the vendor site, or tokens you paste yourself.

**Direct requests only.** When usage is fetched, the extension calls the provider domains directly from your browser (see `host_permissions` in `extension/manifest.config.ts`). Nothing is proxied through a third-party service run for this project.

**What the extension can access (by permission):**

| Permission | Why |
|------------|-----|
| `storage` | Save connections and cached usage locally |
| `alarms` | Refresh usage on a timer in the background |
| `cookies` | Read session cookies when you click Import from browser session |
| Host access to cursor.com, chatgpt.com, claude.ai, api.anthropic.com | Fetch usage from those sites |

**What v0.1 does not include:** cloud sync, analytics, accounts, or telemetry. If that changes in a future version, this README should be updated.

**Your responsibility:** session tokens are as sensitive as being logged in. Anyone with access to your Chrome profile could use them. Do not share exported zips or pasted tokens.

## Why it stays lightweight

- **No backend** — no hosting bill, no sync server, no database.
- **Small surface area** — one popup, one service worker, three adapters.
- **Cached reads** — the popup shows the last snapshot first, then refreshes; you are not waiting on three network calls every click.
- **Infrequent polling** — 5-minute background interval is enough for subscription limits that reset over hours or days.

The built extension zip is on the order of a few hundred KB (mostly the bundled popup UI).

## Manual connect (if import fails)

Log in on the vendor site, then open DevTools → Application → Cookies and copy the value below. Paste it in the Connect panel.

| Provider | Cookie / token |
|----------|----------------|
| Cursor | `WorkosCursorSessionToken` |
| Codex | `__Secure-next-auth.session-token` shards, or a JWT `access_token` from chatgpt.com |
| Claude | `sessionKey` (optional: `lastActiveOrg` for org id) |

## Build from source (contributors)

You need Node.js 18+ and npm.

```bash
git clone https://github.com/<your-org-or-username>/Agent-Usage-.git
cd Agent-Usage-/extension
npm install
npm run build
```

Load `extension/dist` as unpacked in `chrome://extensions`.

Other commands:

```bash
npm run dev      # watch build + load extension/dist
npm run icons    # regenerate PNG icons from src/assets/agent-usage-icon.svg
npm run lint     # eslint
```

Icons are generated from `extension/src/assets/agent-usage-icon.svg` because Chrome manifest icons must be PNG (`extension/scripts/generate-icons.mjs`).

## Publishing a release (maintainers)

End users should not need npm. When you tag a release:

```bash
cd extension
npm ci
npm run build
cd dist
zip -r ../../agent-usage-v0.1.0.zip .
```

Upload `agent-usage-v0.1.0.zip` to GitHub Releases and attach release notes (what changed, any reconnect steps). Bump `version` in `extension/manifest.config.ts` to match the tag.

## Project layout

```
extension/
  manifest.config.ts   # Chrome MV3 manifest (via @crxjs/vite-plugin)
  src/
    adapters/          # cursor.ts, chatgpt.ts (Codex), claude.ts
    background/        # service worker + message handlers
    popup/             # React UI
    storage/           # credentials + usage cache
    types/             # shared TypeScript types
    constants/         # billing / manage-plan URLs
  scripts/
    generate-icons.mjs
  public/              # static assets copied into dist
```

## Licenses

### This project (source code)

Agent Usage is released under the **MIT License**. See [LICENSE](LICENSE).

You may use, modify, and distribute it under those terms. The software is provided as-is.

### Third-party dependencies

The extension is built with open-source npm packages. Main ones:

| Package | License | Role |
|---------|---------|------|
| [React](https://github.com/facebook/react) | MIT | Popup UI |
| [Vite](https://github.com/vitejs/vite) | MIT | Build tool |
| [@crxjs/vite-plugin](https://github.com/crxjs/chrome-extension-tools) | MIT | Chrome extension bundling |
| [sharp](https://github.com/lovell/sharp) | Apache-2.0 | Dev-only: SVG → PNG icon generation at build time |

`sharp` is a **devDependency** — it is not shipped inside the extension zip users install. The installed extension bundle contains the compiled JavaScript/CSS and PNG icons only.

Full dependency list and versions: `extension/package.json` and `extension/package-lock.json`. Each package in `node_modules/` includes its own `LICENSE` file.

### Assets

The extension icon is `extension/src/assets/agent-usage-icon.svg`, created for this project and covered by the same MIT License as the repository unless noted otherwise.

### Trademarks

Codex, Claude, Cursor, and ChatGPT are trademarks of their respective owners. This project is unofficial and not affiliated with OpenAI, Anthropic, or Cursor.

## Limitations (read this)

- **Unofficial** — usage endpoints are reverse-engineered from logged-in dashboard behavior. They can break without notice.
- **Chrome only for now** — Manifest V3 + Chrome extension APIs. Firefox/Edge would need separate packaging work.
- **Unpacked install** — GitHub zip install requires Developer mode. A Chrome Web Store listing would remove that step but is not set up yet.
- **Same browser profile** — import reads cookies from the profile where the extension is installed. If you use another browser for AI tools, import will not find a session there.
- **Plan differences** — free vs paid plans may return different fields; some cards may show “connected” with few or no meters.

## Roadmap

- Usage alerts (e.g. 80% / 95%)
- Optional landing page (Cloudflare Pages was considered earlier)
- Chrome Web Store publish (one-click install)

## Troubleshooting

**“Session expired — reconnect”** — log in again on the vendor site, then Import from browser session or paste a fresh token.

**Import says no session found** — confirm you are logged in on that site in this Chrome profile, then reload the tab and try again.

**Stale numbers** — click ↻ in the popup or close and reopen it. Background poll runs every 5 minutes.

**Extension stops responding** — go to `chrome://extensions` and click reload on Agent Usage.

---

Questions or fixes welcome via GitHub Issues.
