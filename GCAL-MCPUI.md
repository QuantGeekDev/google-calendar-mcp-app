# gcal-mcpui — Google Calendar MCP with Interactive UI

## Vision

A Google Calendar MCP server with rich, interactive UI powered by **MCP Apps** — the official MCP extension for embedding UI directly in AI chat conversations. Instead of plain-text event listings, users get interactive calendar views, visual event creation forms, availability heatmaps, and more — all rendered inline in Claude, ChatGPT, VS Code, and other MCP Apps-compatible hosts.

**Base project:** Fork of [nspady/google-calendar-mcp](https://github.com/nspady/google-calendar-mcp) (TypeScript, 12 tools, multi-account, OAuth 2.0).

## Goals

1. **Add MCP Apps UI to every tool** in the existing Google Calendar MCP server — each tool returns an interactive `ui://` resource alongside its text/data response
2. **Ship production-quality UIs** — responsive, accessible, visually polished calendar interfaces rendered inside sandboxed iframes
3. **Bidirectional interaction** — users can take actions directly from the UI (create events, RSVP, delete, navigate dates) without additional prompts
4. **Zero-config for end users** — same OAuth setup as the base project; UI "just works" in any MCP Apps-compatible host
5. **Maintain full backward compatibility** — hosts without MCP Apps support still get the existing text responses

## Architecture

### Tech Stack

- **Server:** TypeScript, `@modelcontextprotocol/sdk`, `@modelcontextprotocol/ext-apps/server`
- **UI Apps:** HTML/CSS/TypeScript bundled with Vite + `vite-plugin-singlefile`
- **UI Framework:** Vanilla TypeScript (lightweight, no framework dependency in iframe) — or Preact for complex views
- **Styling:** CSS with CSS custom properties for host theme adaptation
- **API:** Google Calendar API v3 (inherited from base project)
- **Transport:** Stdio (default) + Streamable HTTP

### How It Works

```
User asks "show my schedule for today"
  → LLM calls `list-events` tool (has _meta.ui.resourceUri = "ui://gcal/day-view")
  → Server returns event data as text + host fetches ui://gcal/day-view resource
  → Host renders interactive day view in sandboxed iframe
  → User clicks event → app calls `get-event` tool via app.callServerTool()
  → User clicks "New Event" → inline creation form, calls `create-event` tool
```

### Project Structure

```
gcal-mcpui/
├── src/
│   ├── server.ts              # MCP server entry (extended from fork)
│   ├── tools/                 # Tool handlers (from fork + UI registration)
│   ├── auth/                  # OAuth 2.0 (from fork)
│   └── utils/                 # Shared utilities
├── apps/                      # MCP Apps UI source
│   ├── day-view/
│   │   ├── index.html
│   │   └── src/app.ts
│   ├── week-view/
│   │   ├── index.html
│   │   └── src/app.ts
│   ├── month-view/
│   │   ├── index.html
│   │   └── src/app.ts
│   ├── event-detail/
│   │   ├── index.html
│   │   └── src/app.ts
│   ├── event-form/
│   │   ├── index.html
│   │   └── src/app.ts
│   ├── upcoming/
│   │   ├── index.html
│   │   └── src/app.ts
│   ├── freebusy/
│   │   ├── index.html
│   │   └── src/app.ts
│   ├── agenda/
│   │   ├── index.html
│   │   └── src/app.ts
│   └── shared/                # Shared CSS, calendar utils, theme tokens
│       ├── calendar.css
│       ├── theme.ts
│       └── time-utils.ts
├── dist/                      # Built/bundled HTML files
├── vite.config.ts
├── package.json
├── tsconfig.json
└── GCAL-MCPUI.md              # This file
```

---

## UI Views

### 1. Day View (`ui://gcal/day-view`)

**Tool:** `list-events` (when querying a single day)

Interactive vertical timeline for a single day:
- 24-hour time grid with events as positioned, color-coded blocks
- Event blocks show title, time, location, and meeting link icon
- Click event → expands inline detail card (or calls `get-event`)
- "Previous Day" / "Next Day" navigation buttons that call `list-events` with updated dates
- "New Event" button that opens the event creation form at the clicked time slot
- Current time indicator (red line)
- Multi-calendar color coding with legend

### 2. Week View (`ui://gcal/week-view`)

**Tool:** `list-events` (when querying a week range)

7-column grid showing the full week:
- Day columns with hourly rows, events as positioned blocks
- All-day events in a top banner row
- Click any empty slot → pre-fills event form with that date/time
- Click event → detail popup
- Week navigation (prev/next) via `list-events` re-calls
- Responsive: collapses to scrollable horizontal on narrow hosts
- Weekend columns slightly muted

### 3. Month Overview (`ui://gcal/month-view`)

**Tool:** `list-events` (when querying a full month)

Traditional monthly calendar grid:
- 7x5/6 grid with date numbers and event dots/pills
- Color-coded dots per calendar source
- Click a day → drills into day view (calls `list-events` for that day, renders day-view inline)
- Today highlighted
- Month navigation arrows
- Event count badges on busy days

### 4. Event Detail Card (`ui://gcal/event-detail`)

**Tool:** `get-event`

Rich single-event view:
- Title, date/time with timezone, duration
- Location with embedded map link (opens via `app.openLink()`)
- Description (rendered markdown)
- Attendee list with RSVP status indicators (accepted/declined/tentative/pending)
- Organizer info
- Video meeting "Join" button
- Action bar: Edit, Delete, RSVP (Accept/Decline/Tentative)
  - Edit → opens event form pre-filled
  - Delete → confirms then calls `delete-event`
  - RSVP → calls `respond-to-event`
- Recurrence info if applicable
- Calendar color strip on the left edge

### 5. Event Creation/Edit Form (`ui://gcal/event-form`)

**Tool:** `create-event`, `update-event`

Full-featured event form rendered inline:
- Title input
- Date/time pickers (start + end) with duration auto-calculate
- All-day toggle
- Location input
- Description textarea
- Calendar selector dropdown (from `list-calendars`)
- Color picker (from `list-colors`)
- Attendee input with email validation
- Recurrence selector (none, daily, weekly, monthly, yearly, custom)
- Reminder setting
- Timezone selector
- "Save" button → calls `create-event` or `update-event`
- "Cancel" button → closes form
- Validation with inline error messages

### 6. Upcoming Events (`ui://gcal/upcoming`)

**Tool:** `list-events` (upcoming, no specific range)

Card-based scrollable timeline:
- Grouped by day with date headers ("Today", "Tomorrow", "Wednesday Mar 18", etc.)
- Each event as a compact card: time, title, location, calendar color
- Meeting link quick-join button for video calls
- "Load more" pagination
- Empty state: friendly illustration + "No upcoming events"
- Quick actions on hover/tap: edit, delete, RSVP

### 7. Free/Busy Availability (`ui://gcal/freebusy`)

**Tool:** `get-freebusy`

Visual availability display:
- Horizontal time blocks for each calendar/account
- Color-coded: green (free), red (busy), gray (tentative)
- Time range selector (today, this week, custom range)
- Multi-calendar rows stacked vertically for comparison
- Hover on busy block → shows conflicting event title
- "Find free slot" highlight — automatically marks common free windows
- Click free slot → opens event form pre-filled with that time

### 8. Agenda View (`ui://gcal/agenda`)

**Tool:** `list-events`, `search-events`

Clean, linear event list:
- Scrollable list grouped by day
- Compact single-line per event: time range | title | location
- Search bar at top (calls `search-events`)
- Date range filter
- Calendar filter checkboxes
- Print-friendly layout
- Keyboard navigation support

---

## Tickets

### Phase 0: Project Setup

#### T-001: Fork and scaffold project
- Fork `nspady/google-calendar-mcp`
- Add MCP Apps dependencies (`@modelcontextprotocol/ext-apps`, `vite`, `vite-plugin-singlefile`)
- Set up `apps/` directory structure with shared CSS/utils
- Configure Vite for multi-entry HTML bundling
- Add build scripts to package.json
- Verify existing tools still work after restructuring

#### T-002: Shared UI foundations
- Create `apps/shared/calendar.css` — base calendar grid styles, color tokens, responsive breakpoints
- Create `apps/shared/theme.ts` — host theme detection, CSS custom property injection
- Create `apps/shared/time-utils.ts` — date formatting, timezone helpers, relative time
- Create `apps/shared/event-renderer.ts` — common event card/block rendering logic
- Create `apps/shared/app-helpers.ts` — wrapper around `App` class with typed tool calls for gcal tools

#### T-003: Server-side MCP Apps registration infrastructure
- Create helper to register `ui://` resources from built HTML files in `dist/`
- Modify each tool registration to include `_meta.ui.resourceUri`
- Ensure text responses remain for non-UI hosts (backward compat)
- Add resource serving for all UI views
- Test with `ext-apps` basic-host

### Phase 1: Core Calendar Views

#### T-004: Day View
- Build `apps/day-view/` — 24h vertical timeline with event blocks
- Position events based on start/end times, handle overlapping events
- Color code by calendar source
- Current time indicator
- Click event → call `get-event`, show inline detail
- Day navigation (prev/next) → re-call `list-events`
- "New Event" at time slot → open event form
- Register `ui://gcal/day-view` resource on server
- Wire to `list-events` tool when date range is a single day

#### T-005: Week View
- Build `apps/week-view/` — 7-column grid with hourly rows
- All-day events banner row
- Event block positioning with overlap handling
- Week navigation
- Click empty slot → event form pre-filled
- Click event → detail popup
- Responsive collapse for narrow viewports
- Register `ui://gcal/week-view` and wire to `list-events`

#### T-006: Month Overview
- Build `apps/month-view/` — traditional month grid
- Event dots/pills per day, color-coded
- Click day → drill into day view
- Today highlight, month navigation
- Event count badges
- Register `ui://gcal/month-view` and wire to `list-events`

#### T-007: Agenda View
- Build `apps/agenda/` — scrollable event list grouped by day
- Search bar wired to `search-events` tool
- Date range and calendar filters
- Keyboard navigation
- Register `ui://gcal/agenda` and wire to `list-events` / `search-events`

### Phase 2: Event Management UIs

#### T-008: Event Detail Card
- Build `apps/event-detail/` — rich single-event display
- Attendee list with RSVP status indicators
- Video meeting join button via `app.openLink()`
- Location map link
- Action bar: Edit → event form, Delete → confirm + `delete-event`, RSVP → `respond-to-event`
- Recurrence display
- Register `ui://gcal/event-detail` and wire to `get-event`

#### T-009: Event Creation/Edit Form
- Build `apps/event-form/` — full event form
- Date/time pickers, all-day toggle, duration auto-calc
- Calendar selector (calls `list-calendars`)
- Color picker (calls `list-colors`)
- Attendee email input with validation
- Recurrence selector (none/daily/weekly/monthly/yearly/custom)
- Timezone selector
- Create mode → calls `create-event`, Edit mode → calls `update-event`
- Pre-fill support from tool input (time slot clicks, edit actions)
- Form validation with inline errors
- Register `ui://gcal/event-form` and wire to `create-event` / `update-event`

### Phase 3: Advanced Views

#### T-010: Upcoming Events
- Build `apps/upcoming/` — card timeline grouped by day
- Relative date headers ("Today", "Tomorrow", etc.)
- Video call quick-join buttons
- Load more pagination
- Empty state
- Quick action buttons (edit, delete, RSVP)
- Register `ui://gcal/upcoming` and wire to `list-events`

#### T-011: Free/Busy Availability
- Build `apps/freebusy/` — horizontal time block visualization
- Multi-calendar/account row stacking
- Free/busy/tentative color coding
- Time range selector
- Hover → show conflicting event
- "Find free slot" auto-highlight of common availability
- Click free slot → open event form
- Register `ui://gcal/freebusy` and wire to `get-freebusy`

### Phase 4: Smart Tool-to-View Routing

#### T-012: Intelligent view selection
- Implement logic to choose the best UI view based on tool input:
  - `list-events` with single day range → day view
  - `list-events` with 7-day range → week view
  - `list-events` with month range → month view
  - `list-events` with no specific range / "upcoming" → upcoming view
  - `search-events` → agenda view with search pre-filled
  - `get-event` → event detail card
  - `create-event` → event form (create mode)
  - `update-event` → event form (edit mode, pre-filled)
  - `get-freebusy` → freebusy view
- Support `_meta.ui.resourceUri` dynamic selection or parameterization

### Phase 5: Polish and Production

#### T-013: Visual polish and accessibility
- Consistent typography, spacing, and color system across all views
- Dark/light mode support via host theme detection
- ARIA labels, keyboard navigation, focus management
- Screen reader announcements for dynamic content
- Responsive design testing across host viewports

#### T-014: Testing
- Unit tests for time utilities and event positioning logic
- Integration tests for tool → UI resource flow
- E2E tests using `ext-apps` basic-host
- Test with Claude, ChatGPT, VS Code to verify rendering
- Test backward compatibility (hosts without MCP Apps)

#### T-015: Documentation and release
- README with setup instructions, screenshots, feature list
- Configuration docs (OAuth setup, tool filtering, transport modes)
- Contributing guide
- npm package publishing
- Demo video/GIF for each UI view

---

## Implementation Notes

### MCP Apps SDK Usage

Each tool is registered with `registerAppTool()` from `@modelcontextprotocol/ext-apps/server`:

```typescript
registerAppTool(server, "list-events", {
  title: "List Events",
  description: "List calendar events for a date range",
  inputSchema: { /* ... */ },
  _meta: { ui: { resourceUri: "ui://gcal/day-view" } }
}, async (args) => {
  const events = await fetchEvents(args);
  return { content: [{ type: "text", text: JSON.stringify(events) }] };
});
```

Each UI app uses the `App` class:

```typescript
import { App } from "@modelcontextprotocol/ext-apps";

const app = new App({ name: "Day View", version: "1.0.0" });
app.connect();

app.ontoolresult = (result) => {
  const events = JSON.parse(result.content[0].text);
  renderDayView(events);
};
```

### Bundling Strategy

Each UI view is a separate HTML entry point, bundled to a single file by Vite + `vite-plugin-singlefile`. The server reads these from `dist/` and serves them as `ui://` resources. This keeps each view self-contained and cacheable.

### Backward Compatibility

All tools continue to return text content. The `_meta.ui` field is optional metadata — hosts that don't support MCP Apps simply ignore it and display the text response as usual.
