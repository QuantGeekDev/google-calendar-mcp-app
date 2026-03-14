# UI Checklist

Status of all MCP Apps UIs for gcal-mcpui. Every Google Calendar tool should have a meaningful visual representation.

## Tool → UI Coverage

### Has UI (6/13 tools mapped)

| Tool | UI View | Resource URI | Status | Notes |
|------|---------|-------------|--------|-------|
| `list-events` | Upcoming | `ui://gcal/upcoming` | Done | Default view. Shows events grouped by day with cards |
| `search-events` | Agenda | `ui://gcal/agenda` | Done | Searchable list with filters, keyboard nav |
| `get-event` | Event Detail | `ui://gcal/event-detail` | Done | Full event card with attendees, RSVP, actions |
| `create-event` | Event Form | `ui://gcal/event-form` | Done | Creation form with pickers, attendees, recurrence |
| `update-event` | Event Form | `ui://gcal/event-form` | Done | Same form, pre-filled in edit mode |
| `get-freebusy` | Free/Busy | `ui://gcal/freebusy` | Done | Availability heatmap across calendars |

### Built but not mapped as default

| UI View | Resource URI | Status | Notes |
|---------|-------------|--------|-------|
| Day View | `ui://gcal/day-view` | Done | 24h vertical timeline. Available but not the default for any tool |
| Week View | `ui://gcal/week-view` | Done | 7-column grid. Available but not mapped |
| Month View | `ui://gcal/month-view` | Done | Monthly grid with event pills. Available but not mapped |

### No UI yet (7 tools)

| Tool | Needs UI? | Proposed UI | Priority |
|------|-----------|-------------|----------|
| `list-calendars` | Yes | Calendar list with color swatches, account badges, access roles | Medium |
| `list-colors` | Yes | Color palette grid showing all event/calendar colors with names | Low |
| `create-events` | Maybe | Bulk creation progress view with success/fail per event | Low |
| `delete-event` | Yes | Confirmation card with event summary, undo option, success state | Medium |
| `respond-to-event` | Yes | RSVP confirmation card showing response sent, updated status | Medium |
| `get-current-time` | Maybe | Clock/timezone display with current date, DST info | Low |
| `manage-accounts` | Yes | Account list with status indicators, add/remove buttons | Medium |

## UI Polish & Features Needed

### Dark Mode
- [x] Shared CSS variables for light/dark themes
- [x] `data-theme` attribute set from host context
- [x] `prefers-color-scheme` media query fallback
- [ ] Test in dark mode host (MCPJam dark theme, etc.)
- [ ] Verify all hardcoded colors replaced with variables in all 8 apps

### Upcoming Events (default for list-events)
- [x] Day group headers with relative labels
- [x] Event cards with color bar, time, title, location
- [x] All-day event support
- [x] Load more pagination
- [x] Auto-fetch on error/empty input
- [ ] Meeting "Join" button (needs `sendOpenLink` working in host)
- [ ] Click event → expand inline detail
- [ ] Swipe/drag to dismiss or RSVP
- [ ] Empty state illustration improvement

### Day View
- [x] 24h time grid with positioned event blocks
- [x] Current time indicator
- [x] Event overlap handling
- [x] All-day events banner
- [x] Day navigation (prev/next/today)
- [x] Click event → popup detail
- [ ] Drag to create event (click time slot)
- [ ] Event resize by dragging
- [ ] Smooth scroll to current time on load
- [ ] Multi-calendar color legend

### Week View
- [x] 7-column grid with events
- [x] All-day row
- [x] Today highlight
- [x] Week navigation
- [ ] Responsive: collapse to 3-day view on narrow hosts
- [ ] Click empty slot → create event at that time
- [ ] Weekend toggle (show/hide)

### Month View
- [x] Monthly grid with event pills
- [x] +N more overflow
- [x] Today circle
- [x] Month navigation
- [x] Click day → popup
- [ ] Drag event to reschedule (different day)
- [ ] Mini month nav in sidebar
- [ ] Week number column

### Event Detail
- [x] Full event info with color strip
- [x] Attendees with RSVP status
- [x] Action buttons (Accept, Decline, Maybe, Delete)
- [x] Meeting link (Join button)
- [x] Location → Maps link
- [x] Recurrence info
- [ ] Edit button → opens event form with pre-fill
- [ ] Attachments display
- [ ] "Add to calendar" share link
- [ ] Recurring event instance navigation

### Event Form
- [x] Title, date/time, location, description
- [x] Calendar selector
- [x] Color picker
- [x] Attendee chips
- [x] Recurrence dropdown
- [x] All-day toggle
- [ ] Time zone selector
- [ ] Reminder configuration
- [ ] File attachment support
- [ ] Rich text description editor
- [ ] Location autocomplete (Google Places)

### Agenda View
- [x] Searchable event list
- [x] Date range filter
- [x] Day group headers
- [x] Keyboard navigation
- [x] Click-to-expand details
- [ ] Calendar filter checkboxes
- [ ] Export/print view
- [ ] Infinite scroll instead of manual date range

### Free/Busy
- [x] Horizontal timeline bars
- [x] Busy block visualization
- [x] Common free slot detection
- [x] Range selector (Today/Week/Custom)
- [ ] Click free slot → create event
- [ ] Show event titles on hover (needs additional API call)
- [ ] Multi-day view (currently single day focused)
- [ ] Meeting duration selector for finding slots

## New UIs to Build

### Calendar List View (`ui://gcal/calendar-list`)
**For:** `list-calendars` tool
- List of all calendars across accounts
- Color swatch + calendar name + account badge
- Access role indicator (owner/writer/reader)
- Toggle visibility checkboxes
- Primary calendar highlighted
- Calendar count summary

### Delete Confirmation (`ui://gcal/delete-confirm`)
**For:** `delete-event` tool
- Event summary card (title, date, time)
- "This event has been deleted" success state
- Undo button (within timeout)
- Warning for recurring events (delete this/all/following)

### RSVP Confirmation (`ui://gcal/rsvp-confirm`)
**For:** `respond-to-event` tool
- Event summary
- Response sent confirmation (Accepted/Declined/Tentative)
- Updated attendee status display
- Option to add comment with response

### Account Manager (`ui://gcal/accounts`)
**For:** `manage-accounts` tool
- List of connected accounts with status (active/expired)
- Email and calendar count per account
- Add account button → OAuth flow
- Remove account with confirmation
- Re-authenticate expired accounts

### Color Palette (`ui://gcal/colors`)
**For:** `list-colors` tool
- Grid of event colors with names and IDs
- Grid of calendar colors
- Click to copy color ID
- Preview of how events look in each color

### Bulk Create Progress (`ui://gcal/bulk-create`)
**For:** `create-events` tool
- Progress bar (N/total created)
- Per-event status (success/failed with error)
- Summary at completion
- Links to created events

### Clock / Timezone (`ui://gcal/clock`)
**For:** `get-current-time` tool
- Analog or digital clock display
- Current date with day of week
- Timezone name and UTC offset
- DST indicator
- World clock with multiple timezones

## Compatibility with Upstream

The original [nspady/google-calendar-mcp](https://github.com/nspady/google-calendar-mcp) tools are fully preserved:

- [x] All 13 tools work identically (same schemas, same handlers, same responses)
- [x] Text-only responses still returned for non-MCP-Apps hosts
- [x] OAuth flow unchanged
- [x] Multi-account support preserved
- [x] Stdio + HTTP transports both work
- [x] All 808 unit tests pass
- [x] Conflict detection and duplicate checking preserved
- [x] Recurring event modification scopes preserved
- [x] Tool filtering via `--enable-tools` still works

### Breaking changes from upstream
- HTTP transport: `close()/connect()` per request for multi-client support (SDK 1.27+ compat)
- `_meta.ui.resourceUri` added to 6 tool definitions (ignored by non-MCP-Apps hosts)
- Package renamed from `@cocal/google-calendar-mcp` to `gcal-mcpui`
- Build now includes Vite step for UI apps (`npm run build:apps`)

## Edge Cases to Handle

- [ ] Events with no title (show "(No title)" like Google Calendar does)
- [ ] Events spanning midnight (multi-day timed events)
- [ ] Events in different timezones than the user's locale
- [ ] Very long event titles (truncation with ellipsis)
- [ ] 100+ events in a single view (virtualization / pagination)
- [ ] Declined events (show with strikethrough, reduced opacity)
- [ ] Cancelled events (filter out or show differently)
- [ ] All-day events spanning multiple days
- [ ] Events with HTML in description (sanitize)
- [ ] RTL language support
- [ ] Very narrow host viewport (< 300px)
- [ ] Host without `sendOpenLink` support (disable Join/Maps buttons gracefully)
- [ ] Tool result with `isError: true` (show error state, not infinite loading)
- [ ] Empty calendar (show helpful empty state, not blank)
- [ ] Token expiry during session (show re-auth prompt)
