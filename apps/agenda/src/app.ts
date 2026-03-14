import { App } from "@modelcontextprotocol/ext-apps";
import {
  createGCalApp,
  parseToolResult,
  listEvents,
  searchEvents,
  getFreeBusy,
  getEvent,
  getEventColor,
  getMeetingLink,
  GCalEvent,
  ListEventsResult,
  FreeBusyResult,
} from "../../shared/gcal-app";
import {
  formatTime,
  formatTimeRange,
  formatDate,
  formatDateShort,
  getRelativeDateLabel,
  isToday,
  isAllDay,
  getEventDateTime,
  toISODate,
  addDays,
  startOfDay,
  endOfDay,
  getHourFraction,
} from "../../shared/time-utils";

// ── State ──────────────────────────────────────────────────────────────────
const app = createGCalApp("Agenda View");
let originalData: ListEventsResult | null = null;
let currentData: ListEventsResult | null = null;
let expandedEventId: string | null = null;
let focusedIndex: number = -1;
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let isLoading = false;

// ── DOM refs ───────────────────────────────────────────────────────────────
const eventListEl = document.getElementById("eventList")!;
const searchInput = document.getElementById("searchInput") as HTMLInputElement;
const filterStart = document.getElementById("filterStart") as HTMLInputElement;
const filterEnd = document.getElementById("filterEnd") as HTMLInputElement;
const filterBtn = document.getElementById("filterBtn")!;

// ── Initialise date filter defaults ────────────────────────────────────────
const now = new Date();
filterStart.value = toISODate(now);
filterEnd.value = toISODate(addDays(now, 14));

// ── Search handling ────────────────────────────────────────────────────────
searchInput.addEventListener("input", () => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    performSearch();
  }, 500);
});

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    performSearch();
  }
});

async function performSearch() {
  const query = searchInput.value.trim();
  if (!query) {
    // Revert to original data
    if (originalData) {
      currentData = originalData;
      renderEventList(currentData);
    }
    return;
  }

  showLoading();
  try {
    const result = await searchEvents(app, query);
    currentData = result;
    renderEventList(result);
  } catch (err: any) {
    showError("Search failed: " + (err.message || "Unknown error"));
  }
}

// ── Date filter handling ───────────────────────────────────────────────────
filterBtn.addEventListener("click", async () => {
  const start = filterStart.value;
  const end = filterEnd.value;
  if (!start || !end) return;

  showLoading();
  try {
    const timeMin = startOfDay(new Date(start + "T00:00:00"));
    const timeMax = endOfDay(new Date(end + "T00:00:00"));
    const result = await listEvents(app, { calendarId: "primary", timeMin, timeMax });
    originalData = result;
    currentData = result;
    searchInput.value = "";
    renderEventList(result);
  } catch (err: any) {
    showError("Failed to load events: " + (err.message || "Unknown error"));
  }
});

// ── Keyboard navigation ───────────────────────────────────────────────────
document.addEventListener("keydown", (e) => {
  if (document.activeElement === searchInput || document.activeElement === filterStart || document.activeElement === filterEnd) {
    return;
  }

  const rows = eventListEl.querySelectorAll<HTMLElement>(".event-row");
  if (rows.length === 0) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    focusedIndex = Math.min(focusedIndex + 1, rows.length - 1);
    rows[focusedIndex].focus();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    focusedIndex = Math.max(focusedIndex - 1, 0);
    rows[focusedIndex].focus();
  } else if (e.key === "Enter" && focusedIndex >= 0 && focusedIndex < rows.length) {
    e.preventDefault();
    rows[focusedIndex].click();
  }
});

// ── Loading / Error states ─────────────────────────────────────────────────
function showLoading() {
  isLoading = true;
  eventListEl.innerHTML = `
    <div class="loading">
      <div class="loading-spinner"></div>
      Loading events...
    </div>
  `;
}

function showError(msg: string) {
  isLoading = false;
  eventListEl.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">!</div>
      <div>${escapeHtml(msg)}</div>
    </div>
  `;
}

// ── Group events by day ────────────────────────────────────────────────────
interface DayGroup {
  dateKey: string;
  dateLabel: string;
  relativeLabel: string;
  isTodayGroup: boolean;
  events: GCalEvent[];
}

function groupByDay(events: GCalEvent[]): DayGroup[] {
  const groups: Map<string, DayGroup> = new Map();

  for (const event of events) {
    const { start } = getEventDateTime(event);
    if (!start) continue;

    const dt = new Date(start);
    const dateKey = toISODate(dt);

    if (!groups.has(dateKey)) {
      const relLabel = getRelativeDateLabel(start);
      const dateLabel = formatDate(start);
      groups.set(dateKey, {
        dateKey,
        dateLabel,
        relativeLabel: relLabel,
        isTodayGroup: isToday(start),
        events: [],
      });
    }
    groups.get(dateKey)!.events.push(event);
  }

  // Sort groups by date key
  const sorted = Array.from(groups.values());
  sorted.sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  // Sort events within each group by start time
  for (const group of sorted) {
    group.events.sort((a, b) => {
      const aStart = getEventDateTime(a).start;
      const bStart = getEventDateTime(b).start;
      // All-day events first
      const aAllDay = isAllDay(a);
      const bAllDay = isAllDay(b);
      if (aAllDay && !bAllDay) return -1;
      if (!aAllDay && bAllDay) return 1;
      return aStart.localeCompare(bStart);
    });
  }

  return sorted;
}

// ── Render event list ──────────────────────────────────────────────────────
function renderEventList(data: ListEventsResult) {
  isLoading = false;
  expandedEventId = null;
  focusedIndex = -1;

  if (!data.events || data.events.length === 0) {
    eventListEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">&#128197;</div>
        <div>No events found</div>
      </div>
    `;
    return;
  }

  const dayGroups = groupByDay(data.events);
  let html = "";
  let rowIndex = 0;

  for (const group of dayGroups) {
    const todayClass = group.isTodayGroup ? " day-header-today" : "";
    html += `
      <div class="day-header${todayClass}">
        ${escapeHtml(group.relativeLabel)}
        <span class="day-header-date">${escapeHtml(group.dateLabel)}</span>
      </div>
    `;

    for (const event of group.events) {
      const { start, end } = getEventDateTime(event);
      const allDay = isAllDay(event);
      const timeDisplay = allDay ? "All day" : formatTimeRange(start, end);
      const title = event.summary || "(No title)";
      const location = event.location || "";
      const color = getEventColor(event);
      const eventId = event.id;

      html += `
        <div class="event-row" tabindex="0" data-event-id="${escapeAttr(eventId)}" data-row-index="${rowIndex}">
          <div class="event-time">${escapeHtml(timeDisplay)}</div>
          <div class="event-title">${escapeHtml(title)}</div>
          ${location ? `<div class="event-location" title="${escapeAttr(location)}">${escapeHtml(location)}</div>` : ""}
          <div class="event-color-dot" style="background: ${color};"></div>
        </div>
        <div class="event-expanded" data-expanded-id="${escapeAttr(eventId)}">
          ${buildExpandedContent(event)}
        </div>
      `;
      rowIndex++;
    }
  }

  eventListEl.innerHTML = html;

  // Attach click handlers
  const rows = eventListEl.querySelectorAll<HTMLElement>(".event-row");
  rows.forEach((row) => {
    row.addEventListener("click", () => {
      const eid = row.getAttribute("data-event-id")!;
      toggleExpanded(eid);
      focusedIndex = parseInt(row.getAttribute("data-row-index") || "0", 10);
    });
  });
}

// ── Toggle expanded details ────────────────────────────────────────────────
function toggleExpanded(eventId: string) {
  const allExpanded = eventListEl.querySelectorAll<HTMLElement>(".event-expanded");
  const allRows = eventListEl.querySelectorAll<HTMLElement>(".event-row");

  allExpanded.forEach((el) => {
    if (el.getAttribute("data-expanded-id") === eventId) {
      const isVisible = el.classList.contains("visible");
      if (isVisible) {
        el.classList.remove("visible");
        expandedEventId = null;
      } else {
        // Collapse all first
        allExpanded.forEach((other) => other.classList.remove("visible"));
        allRows.forEach((r) => r.classList.remove("selected"));
        el.classList.add("visible");
        expandedEventId = eventId;
        // Highlight the row
        const row = eventListEl.querySelector<HTMLElement>(`[data-event-id="${eventId}"]`);
        if (row) row.classList.add("selected");
      }
    } else {
      el.classList.remove("visible");
    }
  });

  // If we collapsed, remove all selected
  if (!expandedEventId) {
    allRows.forEach((r) => r.classList.remove("selected"));
  }
}

// ── Build expanded content for an event ────────────────────────────────────
function buildExpandedContent(event: GCalEvent): string {
  const parts: string[] = [];

  // Description
  if (event.description) {
    const desc = event.description.length > 300
      ? event.description.substring(0, 300) + "..."
      : event.description;
    parts.push(`
      <div class="expanded-row">
        <span class="expanded-label">Description</span>
        <span class="expanded-value">${escapeHtml(desc)}</span>
      </div>
    `);
  }

  // Attendees
  if (event.attendees && event.attendees.length > 0) {
    const count = event.attendees.length;
    const accepted = event.attendees.filter((a) => a.responseStatus === "accepted").length;
    const declined = event.attendees.filter((a) => a.responseStatus === "declined").length;
    const tentative = event.attendees.filter((a) => a.responseStatus === "tentative").length;
    const noResponse = count - accepted - declined - tentative;

    let attendeeSummary = `${count} attendee${count > 1 ? "s" : ""}`;
    const details: string[] = [];
    if (accepted > 0) details.push(`${accepted} accepted`);
    if (declined > 0) details.push(`${declined} declined`);
    if (tentative > 0) details.push(`${tentative} tentative`);
    if (noResponse > 0) details.push(`${noResponse} pending`);
    if (details.length > 0) attendeeSummary += ` (${details.join(", ")})`;

    parts.push(`
      <div class="expanded-row">
        <span class="expanded-label">Attendees</span>
        <span class="expanded-value">${escapeHtml(attendeeSummary)}</span>
      </div>
    `);
  }

  // Meeting link
  const meetingLink = getMeetingLink(event);
  if (meetingLink) {
    parts.push(`
      <div class="expanded-row">
        <span class="expanded-label">Meeting</span>
        <span class="expanded-value"><a href="${escapeAttr(meetingLink)}" target="_blank" rel="noopener">Join meeting</a></span>
      </div>
    `);
  }

  // Calendar
  if (event.calendarId) {
    parts.push(`
      <div class="expanded-row">
        <span class="expanded-label">Calendar</span>
        <span class="expanded-value">${escapeHtml(event.calendarId)}</span>
      </div>
    `);
  }

  // Organizer
  if (event.organizer && (event.organizer.displayName || event.organizer.email)) {
    const org = event.organizer.displayName || event.organizer.email || "";
    parts.push(`
      <div class="expanded-row">
        <span class="expanded-label">Organizer</span>
        <span class="expanded-value">${escapeHtml(org)}</span>
      </div>
    `);
  }

  // Status
  if (event.status && event.status !== "confirmed") {
    parts.push(`
      <div class="expanded-row">
        <span class="expanded-label">Status</span>
        <span class="expanded-value">${escapeHtml(event.status)}</span>
      </div>
    `);
  }

  if (parts.length === 0) {
    parts.push(`<div class="expanded-row"><span class="expanded-value" style="color: #80868b;">No additional details</span></div>`);
  }

  return parts.join("");
}

// ── Utilities ──────────────────────────────────────────────────────────────
function escapeHtml(text: string): string {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
}

function escapeAttr(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── MCP tool result handler ────────────────────────────────────────────────
app.ontoolresult = (result: any) => {
  try {
    const data = parseToolResult<ListEventsResult>(result);
    originalData = data;
    currentData = data;
    renderEventList(data);
  } catch (err: any) {
    // Tool returned error — auto-fetch
    fetchAgenda();
  }
};

async function fetchAgenda(): Promise<void> {
  showLoading();
  try {
    const data = await listEvents(app, {
      calendarId: "primary",
      timeMin: filterStart.value ? new Date(filterStart.value).toISOString() : new Date().toISOString(),
      timeMax: filterEnd.value ? new Date(filterEnd.value).toISOString() : addDays(new Date(), 14).toISOString(),
    });
    originalData = data;
    currentData = data;
    renderEventList(data);
  } catch (err) {
    showError("Failed to fetch events");
  }
}

// Auto-fetch if no data arrives from host
setTimeout(() => {
  if (!originalData) fetchAgenda();
}, 1500);
