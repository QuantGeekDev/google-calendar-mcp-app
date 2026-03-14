# gcal-mcpui

Google Calendar with interactive UI — right inside your AI chat.

Built on [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview), the official extension for rendering interactive interfaces inside MCP-compatible hosts. Instead of walls of JSON, you get real calendar views, forms, and visualizations rendered inline.

> Fork of [nspady/google-calendar-mcp](https://github.com/nspady/google-calendar-mcp) (MIT). Original calendar tools preserved — this project adds the visual layer on top.

## What This Looks Like

Every tool returns a rich, interactive UI rendered directly in the conversation:

| Tool | UI | What You See |
|------|------------|--------------|
| `list-events` | Day View | 24-hour timeline with positioned event blocks, current time indicator, day navigation |
| `list-events` | Week View | 7-column grid with all-day banner, overlapping event handling, today highlight |
| `list-events` | Month View | Monthly grid with colored event pills, click-to-drill-down, "+N more" overflow |
| `get-event` | Event Detail | Full event card with attendees, RSVP buttons, "Join Meeting" link, delete action |
| `create-event` | Event Form | Complete creation form — title, date/time pickers, attendees, recurrence, color picker |
| `update-event` | Event Form | Same form, pre-filled with existing event data |
| `search-events` | Agenda | Searchable event list with filters, keyboard navigation, expandable details |
| `get-freebusy` | Availability | Visual free/busy heatmap across multiple calendars with common free slot detection |

All UIs are styled with Google Calendar's design system — Google Sans font, Material Design elevation, the same color palette and component patterns.

## How It Works

MCP Apps let tools return `ui://` resources alongside their normal text responses. The host (Claude, ChatGPT, VS Code, etc.) fetches the HTML and renders it in a sandboxed iframe. The UI can call tools back on the server — so clicking "Delete" in the event detail card actually deletes the event.

```
You: "show my schedule for tomorrow"
  → LLM calls list-events tool
  → Server returns event data + ui://gcal/day-view resource
  → Host renders interactive day view in an iframe
  → You click an event → UI calls get-event → detail card appears
  → You click "Join Meeting" → opens Google Meet link
```

Hosts without MCP Apps support get the same text responses as before. The UI is additive, not a replacement.

### Supported Hosts

MCP Apps are rendered by: [Claude](https://claude.ai), [Claude Desktop](https://claude.ai/download), [VS Code GitHub Copilot](https://code.visualstudio.com/), [Goose](https://block.github.io/goose/), [Postman](https://postman.com), [MCPJam](https://www.mcpjam.com/)

Terminal-based hosts (Claude Code, etc.) still work — they just show the text output.

## Setup

### 1. Google Cloud Credentials

You need OAuth 2.0 credentials from a GCP project with the Calendar API enabled.

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create/select a project
2. Enable the **Google Calendar API**
3. Go to **Credentials** → **Create Credentials** → **OAuth client ID**
4. Select **Desktop app** as the application type
5. Download the JSON file and save it (e.g., `gcp-oauth.keys.json`)
6. Under **OAuth consent screen** → **Test users**, add your email

### 2. Install & Authenticate

```bash
git clone https://github.com/YOUR_USERNAME/gcal-mcpui.git
cd gcal-mcpui
npm install
npm run build

# Authenticate with Google (opens browser)
export GOOGLE_OAUTH_CREDENTIALS=./gcp-oauth.keys.json
npm run auth
```

### 3. Connect to a Host

**Claude Desktop** (stdio):
```json
{
  "mcpServers": {
    "gcal": {
      "command": "node",
      "args": ["/path/to/gcal-mcpui/build/index.js"],
      "env": {
        "GOOGLE_OAUTH_CREDENTIALS": "/path/to/gcp-oauth.keys.json"
      }
    }
  }
}
```

**Claude.ai** (HTTP + tunnel):
```bash
# Terminal 1: start the server
npm run start:http

# Terminal 2: expose via tunnel
npx cloudflared tunnel --url http://localhost:3000

# Copy the tunnel URL → Claude Settings → Connectors → Add custom connector
```

**Local testing with basic-host** (no LLM needed):
```bash
# Terminal 1: start gcal-mcpui in HTTP mode
npm run start:http -- --port 3001 --host 0.0.0.0

# Terminal 2: clone and run the MCP Apps test host
git clone https://github.com/modelcontextprotocol/ext-apps.git
cd ext-apps && npm install && npm run build
SERVERS='["http://127.0.0.1:3001"]' npx tsx examples/basic-host/serve.ts

# Open http://localhost:8080 — select tools, call them, see the UIs render
```

## Architecture

```
gcal-mcpui/
├── apps/                      # MCP Apps UI source (HTML + TypeScript)
│   ├── shared/                # Shared utilities (gcal-app.ts, time-utils.ts)
│   ├── day-view/              # Day timeline view
│   ├── week-view/             # Week grid view
│   ├── month-view/            # Month calendar grid
│   ├── event-detail/          # Event detail card with actions
│   ├── event-form/            # Event creation/edit form
│   ├── upcoming/              # Upcoming events card list
│   ├── freebusy/              # Availability heatmap
│   └── agenda/                # Searchable event list
├── src/
│   ├── server.ts              # MCP server (registers tools + UI resources)
│   ├── apps/ui-resources.ts   # Maps tools → ui:// resources
│   ├── tools/registry.ts      # Tool definitions with _meta.ui
│   ├── handlers/core/         # Google Calendar API handlers
│   └── ...                    # Auth, transports, services (from upstream)
├── dist/apps/                 # Built single-file HTML apps (Vite output)
└── build/                     # Server build (esbuild output)
```

Each UI app is bundled by Vite + `vite-plugin-singlefile` into a self-contained HTML file (~270KB). The server registers these as `ui://` resources. When a tool has `_meta.ui.resourceUri` in its definition, the host fetches and renders the corresponding HTML in a sandboxed iframe.

The `App` class from `@modelcontextprotocol/ext-apps` handles the iframe ↔ host communication — tool result streaming, server tool calls from the UI, link opening, and size reporting.

### Tool → UI Mapping

| Tool | Default UI Resource |
|------|-------------------|
| `list-events` | `ui://gcal/day-view` |
| `search-events` | `ui://gcal/agenda` |
| `get-event` | `ui://gcal/event-detail` |
| `create-event` | `ui://gcal/event-form` |
| `update-event` | `ui://gcal/event-form` |
| `get-freebusy` | `ui://gcal/freebusy` |

Tools without a UI mapping (`list-calendars`, `list-colors`, `get-current-time`, `delete-event`, `respond-to-event`, `manage-accounts`) return text-only responses.

## Interactive UI Features

### Day View
- 24-hour vertical timeline with 48px/hour grid
- Events positioned and colored by calendar
- Overlapping event columns
- Current time red line indicator (auto-updates)
- Click event → detail popup
- Prev/Next day navigation, "Today" button

### Week View
- 7-column grid with all-day event banner
- Today's column highlighted
- Event overlap handling per column
- Week navigation

### Month View
- Traditional month grid with event pills (max 3 per cell)
- "+N more" overflow with click-to-expand
- Today in blue circle
- Click day → event popup, click event → detail popup

### Event Detail Card
- Left color strip, full event info
- Attendee list with RSVP status indicators
- "Join Meeting" button (Google Meet / video links)
- Location → Google Maps link
- Action buttons: Accept, Decline, Maybe, Delete
- Recurrence info with human-readable RRULE parsing

### Event Form
- Title, date/time pickers, all-day toggle
- Calendar selector (fetched from `list-calendars`)
- Color picker (fetched from `list-colors`)
- Attendee input with email validation and chips
- Recurrence dropdown (Daily/Weekly/Monthly/Yearly)
- Saves via `create-event` or `update-event`

### Agenda View
- Search bar with debounced `search-events` calls
- Date range filter
- Events grouped by day with relative labels ("Today", "Tomorrow")
- Click-to-expand inline details
- Keyboard navigation (arrow keys + Enter)

### Free/Busy Availability
- Horizontal timeline bars per calendar
- Busy blocks (blue) over free background (green)
- Hover tooltips on busy periods
- Common free slot detection and highlighting
- Today / This Week / Custom range selectors

## Development

```bash
npm install
npm run build:apps    # Build UI apps only (Vite)
npm run build:server  # Build server only (esbuild)
npm run build         # Build everything

npm test              # Run unit tests (809 tests)
npm run lint          # TypeScript type check
```

### Adding a New UI View

1. Create `apps/<name>/index.html` and `apps/<name>/src/app.ts`
2. Use `createGCalApp()` from `apps/shared/gcal-app.ts` for typed tool calls
3. Add the `ui://` resource URI to `src/apps/ui-resources.ts`
4. Map the tool → URI in `TOOL_UI_MAP`
5. `npm run build` and test

## Calendar Tools Reference

| Tool | Description |
|------|-------------|
| `list-calendars` | List all available calendars across accounts |
| `list-events` | List events with date filtering, multi-calendar support |
| `search-events` | Full-text search across events |
| `get-event` | Get event details by ID |
| `create-event` | Create event with conflict/duplicate detection |
| `create-events` | Bulk create (up to 50 events) |
| `update-event` | Update with recurring event scope support |
| `delete-event` | Delete with notification control |
| `respond-to-event` | Accept / Decline / Maybe for invitations |
| `get-freebusy` | Query availability across calendars |
| `get-current-time` | Current time with timezone and DST info |
| `list-colors` | Available event/calendar colors |
| `manage-accounts` | Add, list, or remove Google accounts |

Multi-account support, cross-account conflict detection, and all features from the upstream project are preserved.

## Credits

- Calendar tools and Google API integration: [nspady/google-calendar-mcp](https://github.com/nspady/google-calendar-mcp) (MIT)
- MCP Apps protocol: [modelcontextprotocol/ext-apps](https://github.com/modelcontextprotocol/ext-apps)
- MCP SDK: [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)

## License

MIT — see [LICENSE](LICENSE) for details.
