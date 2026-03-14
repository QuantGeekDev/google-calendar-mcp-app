# google-calendar-mcp-app

Google Calendar with interactive UI — right inside your AI chat.

Ask your AI assistant about your schedule and get real, interactive calendar views instead of plain text. Create events with a form. See your availability as a visual heatmap. All rendered inline in the conversation.

Built on [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview), the official protocol extension for interactive UIs in AI chat. Fork of [nspady/google-calendar-mcp](https://github.com/nspady/google-calendar-mcp) (MIT) — all 13 calendar tools preserved, 15 interactive UI screens added on top.

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/QuantGeekDev/google-calendar-mcp-app.git
cd google-calendar-mcp-app
npm install
npm run build
```

### 2. Set Up Google Calendar Access

You need OAuth credentials to access the Google Calendar API. Two ways to set this up:

#### Option A: Using `gcloud` CLI (fastest)

If you have [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) installed:

```bash
# Create project and enable Calendar API
gcloud projects create my-gcal-mcp --name="Google Calendar MCP"
gcloud config set project my-gcal-mcp
gcloud services enable calendar-json.googleapis.com
```

Then finish in the browser (2 clicks):

1. **Configure consent screen** — open [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent?project=my-gcal-mcp), pick "External", fill app name + your email, skip scopes, add yourself as test user
2. **Create credentials** — open [Create OAuth client](https://console.cloud.google.com/apis/credentials/oauthclient?project=my-gcal-mcp), select "Desktop app", create, download JSON

Save the downloaded file as `gcp-oauth.keys.json` in the project root.

#### Option B: All in browser

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create a project
2. Search **"Google Calendar API"** → Enable it
3. Go to **APIs & Services → OAuth consent screen** → External → fill basics → add yourself as test user
4. Go to **Credentials → Create Credentials → OAuth client ID → Desktop app** → Download JSON
5. Save as `gcp-oauth.keys.json` in the project root

### 3. Authenticate

```bash
export GOOGLE_OAUTH_CREDENTIALS=./gcp-oauth.keys.json
npm run auth
```

A browser window opens — sign in with your Google account and grant calendar access. Tokens are saved locally. You only need to do this once (tokens auto-refresh).

> **Tip:** If you see "This app isn't verified", click **Advanced → Go to [app name] (unsafe)**. This is normal for test-mode apps.

### 4. Connect to Your AI Host

#### Claude Desktop (recommended — full MCP Apps UI support)

Add to `~/.config/Claude/claude_desktop_config.json` (Linux) or `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "google-calendar": {
      "command": "node",
      "args": ["/absolute/path/to/google-calendar-mcp-app/build/index.js"],
      "env": {
        "GOOGLE_OAUTH_CREDENTIALS": "/absolute/path/to/gcp-oauth.keys.json"
      }
    }
  }
}
```

Restart Claude Desktop. Ask: *"What's on my calendar this week?"*

#### MCPJam Inspector (best for testing & development)

```bash
# Terminal 1: start the MCP server
export GOOGLE_OAUTH_CREDENTIALS=./gcp-oauth.keys.json
npm run start:http -- --port 3001 --host 0.0.0.0

# Terminal 2: launch MCPJam
npx @mcpjam/inspector@latest
```

Open http://localhost:6274, click **Add Server → HTTP**, enter `http://127.0.0.1:3001`, connect. Select any tool and call it — the interactive UI renders inline.

#### VS Code (GitHub Copilot)

VS Code with GitHub Copilot supports MCP Apps. Add the server in VS Code's MCP settings and use Copilot Chat.

#### Claude.ai (web — text only, no UI rendering)

```bash
# Start HTTP server
npm run start:http -- --port 3001 --host 0.0.0.0

# Tunnel to the internet
npx cloudflared tunnel --url http://localhost:3001

# Copy the tunnel URL → claude.ai → Settings → Connectors → Add custom connector
```

> Note: Claude.ai web currently shows text responses only. Interactive UIs render in Claude Desktop, MCPJam, VS Code, and Goose.

## What You Get

Every tool returns an interactive UI. 13 tools, 15 screens:

### Calendar Views

| When you ask... | You see |
|----------------|---------|
| *"Show my calendar"* | **Upcoming Events** — events grouped by day, colored cards with time/title/location |
| *"Search for meetings"* | **Agenda** — searchable list with date filters and keyboard navigation |
| *"Am I free Thursday?"* | **Availability** — visual free/busy heatmap across all your calendars |

Plus **Day View** (24h timeline), **Week View** (7-column grid), and **Month View** (calendar grid with event pills) — all available as alternate views.

### Event Actions

| When you ask... | You see |
|----------------|---------|
| *"Show me the team meeting details"* | **Event Detail** — attendees, RSVP status, Join Meeting button, location map, delete action |
| *"Create a meeting tomorrow at 2pm"* | **Event Form** — title, date/time pickers, calendar selector, color picker, attendee chips |
| *"Delete the standup"* | **Delete Confirmation** — animated success/error card |
| *"Accept the Friday invite"* | **RSVP Confirmation** — response status with event summary |
| *"Add these 10 events"* | **Bulk Progress** — progress bar with per-event success/failure |

### Utilities

| When you ask... | You see |
|----------------|---------|
| *"List my calendars"* | **Calendar List** — color swatches, access roles, grouped by account |
| *"Show available colors"* | **Color Palette** — event/calendar colors with names, click to copy ID |
| *"What time is it?"* | **Clock** — digital clock with timezone, DST indicator, auto-updating |
| *"Show connected accounts"* | **Account Manager** — status badges, calendar counts, auth management |

All UIs support **light and dark mode** automatically.

## How It Works

```
You: "what's on my calendar this week?"
  → AI calls list-events tool
  → Server returns event data + ui://gcal/upcoming resource
  → Host fetches the HTML and renders it in a sandboxed iframe
  → You see an interactive calendar view inline in the chat
  → Click "Join" → opens Google Meet link
  → Click "Load more" → fetches next page of events
```

The `_meta.ui.resourceUri` field in each tool definition tells the host which UI to render. The UI communicates back to the server via `postMessage` — it can call any tool (navigate dates, create events, RSVP) without additional prompts.

Hosts without MCP Apps support still get text responses. The UI is additive.

## Architecture

```
google-calendar-mcp-app/
├── apps/                       # 15 MCP Apps (HTML + TypeScript)
│   ├── shared/                 # Shared code
│   │   ├── gcal-app.ts         # Typed tool wrappers, theme detection
│   │   ├── components.ts       # Reusable UI components (11 components)
│   │   ├── time-utils.ts       # Date formatting, calendar math
│   │   └── theme.css           # CSS design tokens (light + dark)
│   ├── upcoming/               # Default for list-events
│   ├── day-view/               # 24h timeline
│   ├── week-view/              # 7-column grid
│   ├── month-view/             # Monthly grid
│   ├── agenda/                 # Searchable list
│   ├── event-detail/           # Event card with actions
│   ├── event-form/             # Create/edit form
│   ├── delete-confirm/         # Deletion confirmation
│   ├── rsvp-confirm/           # RSVP confirmation
│   ├── bulk-create/            # Bulk creation progress
│   ├── freebusy/               # Availability heatmap
│   ├── calendar-list/          # Calendar browser
│   ├── colors/                 # Color palette
│   ├── clock/                  # Clock / timezone
│   └── accounts/               # Account manager
├── src/                        # MCP server (TypeScript)
│   ├── server.ts               # Server entry + UI resource registration
│   ├── apps/ui-resources.ts    # Tool → UI mapping (15 resources)
│   ├── tools/registry.ts       # 13 tool definitions with _meta.ui
│   ├── handlers/core/          # Google Calendar API handlers
│   ├── auth/                   # OAuth 2.0 (multi-account)
│   ├── transports/             # Stdio + HTTP
│   └── services/               # Conflict detection, calendar registry
└── build/                      # Compiled output
```

Each UI is bundled by Vite into a single self-contained HTML file. The server serves these as `ui://` resources with MIME type `text/html;profile=mcp-app`.

## Shared Component Library

All 15 UIs share reusable components at `apps/shared/components.ts`:

| Component | Use |
|-----------|-----|
| `renderEventCard()` | Event card with color bar, time, title |
| `renderAttendeeChip()` | Avatar + name + RSVP status |
| `renderBadge()` | Status badges (success/error/warning/info) |
| `renderButton()` | Themed buttons (primary/secondary/danger) |
| `renderListItem()` | List row with icon + title + badge |
| `showToast()` | Notification popup |
| `showConfirmDialog()` | Confirm/cancel modal |
| `renderSpinner()` | Loading state |
| `renderEmptyState()` | Placeholder with icon |

All components use CSS custom properties — light and dark mode work automatically.

## Development

```bash
npm install              # Install dependencies
npm run build            # Build everything (apps + server)
npm run build:apps       # Build 15 UI apps only
npm run build:server     # Build server only
npm test                 # Run 808 unit tests
npm run lint             # TypeScript type check

# Run locally
export GOOGLE_OAUTH_CREDENTIALS=./gcp-oauth.keys.json
npm run start:http -- --port 3001    # HTTP mode
npm start                            # Stdio mode (for Claude Desktop)
```

### Adding a New UI

1. Create `apps/<name>/index.html` and `apps/<name>/src/app.ts`
2. Use `createGCalApp()` from shared code + reusable components
3. Register in `src/apps/ui-resources.ts` (add to `UI_RESOURCES` + `TOOL_UI_MAP`)
4. `npm run build` → test with MCPJam Inspector

## Multi-Account Support

Connect multiple Google accounts and query them simultaneously:

```bash
# In chat, use the manage-accounts tool:
# "Add my work Google account"

# Or from CLI:
npm run account auth work      # Authenticate 'work' account
npm run account auth personal  # Authenticate 'personal' account
```

When multiple accounts are connected, `list-events` merges results from all accounts. Write operations auto-select the account with the right permissions.

## Credits

- Calendar tools: [nspady/google-calendar-mcp](https://github.com/nspady/google-calendar-mcp) (MIT)
- MCP Apps protocol: [modelcontextprotocol/ext-apps](https://github.com/modelcontextprotocol/ext-apps)
- MCP SDK: [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)

## License

MIT — see [LICENSE](LICENSE) for details.
