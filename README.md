# gcal-mcpui

Google Calendar with interactive UI — right inside your AI chat.

Built on [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview), the official extension for rendering interactive interfaces inside MCP-compatible hosts. Instead of walls of JSON, you get real calendar views, forms, and visualizations rendered inline.

> Fork of [nspady/google-calendar-mcp](https://github.com/nspady/google-calendar-mcp) (MIT). Original calendar tools preserved — this project adds the visual layer on top.

## What This Looks Like

Every tool returns a rich, interactive UI rendered directly in the conversation. All 13 tools have visual representations — 15 UI screens total:

### Calendar Views

| Tool | UI | What You See |
|------|-----|--------------|
| `list-events` | **Upcoming Events** | Events grouped by day with colored cards, time, title, location, "Join" buttons for meetings |
| `search-events` | **Agenda** | Searchable event list with date filters, keyboard navigation, expandable inline details |
| `get-freebusy` | **Availability** | Visual free/busy heatmap across calendars with common free slot detection |

Three alternate calendar views are also available (built but mapped to `list-events` on demand):

| UI | What You See |
|-----|--------------|
| **Day View** | 24-hour vertical timeline with positioned event blocks, current time indicator, day navigation |
| **Week View** | 7-column grid with all-day banner, overlapping event handling, today column highlighted |
| **Month View** | Monthly grid with colored event pills, "+N more" overflow, click day to drill down |

### Event Management

| Tool | UI | What You See |
|------|-----|--------------|
| `get-event` | **Event Detail** | Full event card — attendees with RSVP status, "Join Meeting" link, location map, Accept/Decline/Delete actions, recurrence info |
| `create-event` | **Event Form** | Creation form with title, date/time pickers, all-day toggle, calendar selector, color picker, attendee chips, recurrence dropdown |
| `update-event` | **Event Form** | Same form pre-filled with existing event data for editing |
| `delete-event` | **Delete Confirmation** | Animated success/error card with event ID and status message |
| `respond-to-event` | **RSVP Confirmation** | Response status (accepted/declined/tentative) with event summary card |
| `create-events` | **Bulk Create Progress** | Progress bar, per-event success/failure breakdown, created event list |

### Utilities

| Tool | UI | What You See |
|------|-----|--------------|
| `list-calendars` | **Calendar List** | All calendars with color swatches, access role badges (Owner/Writer/Reader), grouped by account |
| `list-colors` | **Color Palette** | Event and calendar color grids with names, hex values, click-to-copy ID |
| `get-current-time` | **Clock / Timezone** | Large digital clock, date, timezone name, UTC offset, DST indicator, auto-updating |
| `manage-accounts` | **Account Manager** | Connected accounts with status badges, email, calendar count, auth URLs for new accounts |

All UIs support **light and dark mode** — adapting to the host's theme automatically via `hostContext.theme` or `prefers-color-scheme`. Styled with Google Calendar's design system — Google Sans font, Material Design 3 elevation, official event color palette.

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
│   ├── shared/                # Shared code
│   │   ├── gcal-app.ts        # Typed tool call wrappers, App factory, theme detection
│   │   ├── time-utils.ts      # Date/time formatting, calendar math
│   │   ├── components.ts      # Reusable UI components (cards, badges, buttons, toasts...)
│   │   ├── base-styles.ts     # Theme tokens (light + dark)
│   │   └── theme.css          # CSS custom properties reference
│   ├── upcoming/              # Upcoming events (default for list-events)
│   ├── day-view/              # 24h day timeline
│   ├── week-view/             # 7-column week grid
│   ├── month-view/            # Monthly calendar grid
│   ├── agenda/                # Searchable event list
│   ├── event-detail/          # Event detail card
│   ├── event-form/            # Event creation/edit form
│   ├── delete-confirm/        # Deletion confirmation
│   ├── rsvp-confirm/          # RSVP response confirmation
│   ├── bulk-create/           # Bulk creation progress
│   ├── freebusy/              # Free/busy availability
│   ├── calendar-list/         # Calendar list with roles
│   ├── colors/                # Color palette browser
│   ├── clock/                 # Clock / timezone display
│   └── accounts/              # Account manager
├── src/
│   ├── server.ts              # MCP server (registers tools + UI resources)
│   ├── apps/ui-resources.ts   # Maps tools → ui:// resources (15 views)
│   ├── tools/registry.ts      # Tool definitions with _meta.ui
│   ├── handlers/core/         # Google Calendar API handlers (13 tools)
│   └── ...                    # Auth, transports, services (from upstream)
├── dist/apps/                 # Built single-file HTML apps (Vite output)
└── build/                     # Server build (esbuild output)
```

Each UI app is bundled by Vite + `vite-plugin-singlefile` into a self-contained HTML file (~270KB). The server registers these as `ui://` resources. When a tool has `_meta.ui.resourceUri` in its definition, the host fetches and renders the corresponding HTML in a sandboxed iframe.

The `App` class from `@modelcontextprotocol/ext-apps` handles the iframe ↔ host communication — tool result streaming, server tool calls from the UI, link opening, and size reporting.

### Tool → UI Mapping

Every tool has a UI. 13 tools, 15 views (some tools share a view, some have alternates):

| Tool | Default UI Resource | Alternate Views |
|------|-------------------|-----------------|
| `list-events` | `ui://gcal/upcoming` | day-view, week-view, month-view |
| `search-events` | `ui://gcal/agenda` | |
| `get-event` | `ui://gcal/event-detail` | |
| `create-event` | `ui://gcal/event-form` | |
| `create-events` | `ui://gcal/bulk-create` | |
| `update-event` | `ui://gcal/event-form` | |
| `delete-event` | `ui://gcal/delete-confirm` | |
| `respond-to-event` | `ui://gcal/rsvp-confirm` | |
| `get-freebusy` | `ui://gcal/freebusy` | |
| `get-current-time` | `ui://gcal/clock` | |
| `list-calendars` | `ui://gcal/calendar-list` | |
| `list-colors` | `ui://gcal/colors` | |
| `manage-accounts` | `ui://gcal/accounts` | |

## All 15 Screens

### Upcoming Events (default for `list-events`)
- Events grouped by day with relative headers ("Today", "Tomorrow", "Wed, Mar 18")
- Event cards with left color bar, time range, title, location
- All-day event support
- "Join" button for video meetings
- "Load more" pagination for additional events
- Auto-fetches from primary calendar if called with empty input

### Day View
- 24-hour vertical timeline with 48px/hour grid
- Events positioned and colored by calendar
- Overlapping event column layout
- Current time red line indicator (auto-updates every minute)
- All-day events banner at top
- Click event → detail popup with full info
- Prev/Next day navigation + "Today" button

### Week View
- 7-column grid (Sun–Sat) with positioned event blocks
- All-day event banner row at top
- Today's column highlighted with blue tint
- Event overlap handling within each day column
- Current time indicator in today's column
- Week navigation (prev/next)

### Month View
- Traditional month grid with colored event pills (max 3 per cell)
- "+N more" overflow links with click-to-expand
- Today's date in blue circle
- Days outside current month dimmed
- Click day → event popup, click event → detail popup
- Month navigation + "Today" button

### Agenda
- Search bar with 500ms debounce calling `search-events`
- Date range filter (start/end date inputs)
- Events grouped by day with sticky headers
- Compact row format: time | title | location | color dot
- Click-to-expand inline details (description, attendees, meeting link)
- Keyboard navigation (arrow keys + Enter)

### Event Detail Card
- Left color strip (4px, event color)
- Full event info: title, date/time, location, description
- Attendee list with 32px avatar circles and RSVP status (✓ accepted, ✗ declined, ? tentative)
- "Join Meeting" button for Google Meet / video links
- Location → Google Maps link via `sendOpenLink`
- Action buttons: Accept, Decline, Maybe, Delete (with confirmation dialog)
- Recurrence info with human-readable RRULE parsing (daily, weekly, monthly, etc.)

### Event Form
- Title input (22px, Google Calendar style underline)
- Date/time pickers with all-day toggle
- Calendar selector dropdown (populated from `list-calendars`)
- Color picker (populated from `list-colors`) with selection ring
- Attendee input with email validation and removable chips
- Recurrence dropdown (None / Daily / Weekly / Monthly / Yearly → RRULE)
- Location and description text fields
- Save calls `create-event` or `update-event`, Cancel clears form

### Delete Confirmation
- Animated success/error icon (scale-in animation)
- Success: green checkmark, "Event deleted" heading, event ID
- Error: red X, "Failed to delete event" heading, error message
- Clean centered card layout

### RSVP Confirmation
- Response icon with color: ✓ green (accepted), ✗ red (declined), ? yellow (tentative)
- Response text: "You accepted / declined / responded tentatively"
- Event summary card with title, date/time, location
- "Updates sent to" info (all / external / none)

### Bulk Create Progress
- Summary: "Created N of M events"
- 8px progress bar (green fill proportional to success rate)
- Stats row: green "N created" badge + red "N failed" badge (if applicable)
- Collapsible created events list with color dot, title, date
- Failed events section (red-tinted) with error messages per event

### Free/Busy Availability
- Horizontal timeline bars per calendar
- Busy blocks (blue, semi-transparent) over free background (green)
- Hover tooltips showing busy period time range
- Common free slot detection and green highlighting
- Range selectors: Today / This Week / Custom date picker

### Calendar List
- All calendars with 14px color swatches and names
- Access role badges: "Owner" (green), "Writer" (blue), "Reader" (gray)
- Star icon for primary calendar
- Grouped by account when multiple accounts connected
- Calendar count in header

### Color Palette
- Two sections: "Event Colors" and "Calendar Colors"
- 3-column grid of color cards: 32px swatch, color name, hex value, ID
- Event colors named: Lavender, Sage, Grape, Flamingo, Banana, Tangerine, Peacock, Graphite, Blueberry, Basil, Tomato
- Click to copy color ID to clipboard (toast confirmation)

### Clock / Timezone
- Large digital clock (48px font, auto-updates every second)
- Full date with day of week
- Timezone name with abbreviation and UTC offset
- DST indicator badge: "DST Active" (green) or "Standard Time" (neutral)

### Account Manager
- Connected accounts with avatar circles, account ID, email
- Status badges: "Active" (green), "Expired" (warning), "Error" (red)
- Calendar count and primary calendar info per account
- For add action: auth URL link and instructions
- For remove action: success/error message with remaining account count

## Shared Component Library

All UIs share a reusable component library at `apps/shared/components.ts`:

| Component | Description |
|-----------|-------------|
| `renderEventCard()` | Event card with color bar, time, title, location, join button |
| `renderAttendeeChip()` | Avatar circle + name + RSVP status icon |
| `renderColorSwatch()` | Themed color circle (any size, selection ring) |
| `renderBadge()` | Status badge — success / error / warning / info / neutral variants |
| `renderButton()` | Themed button — primary / secondary / danger / text variants |
| `renderListItem()` | Icon + title + subtitle + badge row |
| `renderEmptyState()` | Centered placeholder with icon and message |
| `renderSpinner()` | Loading spinner with message |
| `renderSectionHeader()` | Uppercase label divider |
| `showToast()` | Animated notification popup (auto-dismiss) |
| `showConfirmDialog()` | Modal dialog with confirm/cancel actions |
| `escapeHtml()` | XSS-safe HTML escaping |

All components use CSS custom properties for theming — they work in both light and dark mode automatically.

## Development

```bash
npm install
npm run build:apps    # Build all 15 UI apps (Vite)
npm run build:server  # Build server only (esbuild)
npm run build         # Build everything (apps + server)

npm test              # Run unit tests (808 tests)
npm run lint          # TypeScript type check
```

### Adding a New UI View

1. Create `apps/<name>/index.html` with theme CSS tokens (copy from any existing app)
2. Create `apps/<name>/src/app.ts` using `createGCalApp()` and shared components
3. Add the `ui://` resource URI to `src/apps/ui-resources.ts` → `UI_RESOURCES` array
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
