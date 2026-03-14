import { App } from "@modelcontextprotocol/ext-apps";
import {
  createGCalApp,
  parseToolResult,
  listEvents,
  getEventColor,
  getMeetingLink,
  getEvent,
  GCalEvent,
  ListEventsResult,
} from "../../shared/gcal-app";
import {
  formatTime,
  formatDate,
  isToday,
  getRelativeDateLabel,
  isAllDay,
  getEventDateTime,
  toISODate,
  addDays,
} from "../../shared/time-utils";

// ---- State ----
let allEvents: GCalEvent[] = [];
let expandedEventId: string | null = null;
let expandedEventData: GCalEvent | null = null;
let isLoadingMore = false;

// ---- DOM ----
const eventsContainer = document.getElementById("eventsContainer") as HTMLDivElement;

// ---- App Init ----
const app = createGCalApp("Upcoming Events");

app.ontoolresult = (result: any) => {
  try {
    const data = parseToolResult<ListEventsResult>(result);
    if (data && Array.isArray(data.events)) {
      allEvents = data.events;
      expandedEventId = null;
      expandedEventData = null;
      render();
    }
  } catch {
    // Tool returned an error — auto-fetch upcoming events
    fetchUpcoming();
  }
};

async function fetchUpcoming(): Promise<void> {
  try {
    const now = new Date();
    const future = addDays(now, 14);
    const data = await listEvents(app, {
      calendarId: "primary",
      timeMin: now.toISOString(),
      timeMax: future.toISOString(),
    });
    allEvents = data.events || [];
    render();
  } catch (err) {
    console.error("Failed to fetch upcoming events:", err);
  }
}

// ---- Grouping ----

interface DayGroup {
  dateKey: string;
  label: string;
  isToday: boolean;
  events: GCalEvent[];
}

function groupEventsByDay(events: GCalEvent[]): DayGroup[] {
  const groups: Map<string, DayGroup> = new Map();

  for (const event of events) {
    const { start } = getEventDateTime(event);
    if (!start) continue;

    // Get the date part only
    let dateKey: string;
    if (event.start.date && !event.start.dateTime) {
      // All-day event: use date directly
      dateKey = event.start.date;
    } else {
      // Timed event: extract local date
      const d = new Date(start);
      dateKey = toISODate(d);
    }

    if (!groups.has(dateKey)) {
      const todayFlag = isToday(dateKey + "T12:00:00");
      const label = getRelativeDateLabel(dateKey + "T12:00:00");
      groups.set(dateKey, {
        dateKey,
        label,
        isToday: todayFlag,
        events: [],
      });
    }
    groups.get(dateKey)!.events.push(event);
  }

  // Sort groups by date key
  const sorted = Array.from(groups.values()).sort((a, b) =>
    a.dateKey.localeCompare(b.dateKey)
  );

  return sorted;
}

// ---- Rendering ----

function render() {
  if (allEvents.length === 0) {
    renderEmptyState();
    return;
  }

  const groups = groupEventsByDay(allEvents);
  eventsContainer.innerHTML = "";

  for (const group of groups) {
    const groupEl = document.createElement("div");
    groupEl.className = "day-group";

    // Day header
    const headerEl = document.createElement("div");
    headerEl.className = `day-header${group.isToday ? " day-header-today" : ""}`;
    headerEl.textContent = group.label;
    groupEl.appendChild(headerEl);

    // Event cards
    for (const event of group.events) {
      const card = createEventCard(event);
      groupEl.appendChild(card);
    }

    eventsContainer.appendChild(groupEl);
  }

  // Load more button
  const loadMoreRow = document.createElement("div");
  loadMoreRow.className = "load-more-row";
  const loadMoreBtn = document.createElement("button");
  loadMoreBtn.className = "load-more-btn";
  loadMoreBtn.textContent = "Load more";
  loadMoreBtn.addEventListener("click", () => loadMore());
  loadMoreRow.appendChild(loadMoreBtn);
  eventsContainer.appendChild(loadMoreRow);
}

function createEventCard(event: GCalEvent): HTMLDivElement {
  const card = document.createElement("div");
  card.className = "event-card";
  if (expandedEventId === event.id) {
    card.classList.add("expanded");
  }

  const color = getEventColor(event);

  // Color bar
  const colorBar = document.createElement("div");
  colorBar.className = "event-color-bar";
  colorBar.style.backgroundColor = color;
  card.appendChild(colorBar);

  // Content
  const content = document.createElement("div");
  content.className = "event-content";

  // Time
  const timeEl = document.createElement("div");
  timeEl.className = "event-time";
  if (isAllDay(event)) {
    timeEl.textContent = "All day";
  } else {
    const { start, end } = getEventDateTime(event);
    timeEl.textContent = `${formatTime(start)} - ${formatTime(end)}`;
  }
  content.appendChild(timeEl);

  // Title
  const titleEl = document.createElement("div");
  titleEl.className = "event-title";
  titleEl.textContent = event.summary || "(No title)";
  content.appendChild(titleEl);

  // Location
  if (event.location) {
    const locEl = document.createElement("div");
    locEl.className = "event-location";
    locEl.textContent = "\uD83D\uDCCD " + event.location;
    content.appendChild(locEl);
  }

  // Expanded detail section
  const detail = document.createElement("div");
  detail.className = "event-detail";
  if (expandedEventId === event.id && expandedEventData) {
    renderDetailInline(detail, expandedEventData);
  }
  content.appendChild(detail);

  card.appendChild(content);

  // Meeting join button
  const meetingLink = getMeetingLink(event);
  if (meetingLink) {
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "event-actions";
    const joinBtn = document.createElement("button");
    joinBtn.className = "join-btn";
    joinBtn.textContent = "Join";
    joinBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      app.sendOpenLink({ url: meetingLink });
    });
    actionsDiv.appendChild(joinBtn);
    card.appendChild(actionsDiv);
  }

  // Click to expand/collapse
  card.addEventListener("click", () => toggleExpand(event, card));

  return card;
}

function renderDetailInline(container: HTMLElement, event: GCalEvent) {
  container.innerHTML = "";

  // Full date/time
  const { start, end } = getEventDateTime(event);
  if (start) {
    const row = createDetailRow(
      "\uD83D\uDD52",
      isAllDay(event) ? formatDate(start) : `${formatDate(start)}, ${formatTime(start)} - ${formatTime(end)}`
    );
    container.appendChild(row);
  }

  // Location
  if (event.location) {
    const row = createDetailRow("\uD83D\uDCCD", event.location);
    container.appendChild(row);
  }

  // Description
  if (event.description) {
    const row = createDetailRow("\uD83D\uDCDD", event.description);
    container.appendChild(row);
  }

  // Organizer
  if (event.organizer) {
    const name = event.organizer.displayName || event.organizer.email || "";
    const row = createDetailRow("\uD83D\uDC64", `Organized by ${name}`);
    container.appendChild(row);
  }

  // Attendees
  if (event.attendees && event.attendees.length > 0) {
    const attendeesDiv = document.createElement("div");
    attendeesDiv.className = "detail-row";

    const icon = document.createElement("div");
    icon.className = "detail-row-icon";
    icon.textContent = "\uD83D\uDC65";
    attendeesDiv.appendChild(icon);

    const textDiv = document.createElement("div");
    textDiv.className = "detail-row-text detail-attendees";

    event.attendees.forEach((att) => {
      const attEl = document.createElement("div");
      attEl.className = "detail-attendee";
      const name = att.displayName || att.email;
      const statusLabel = formatResponseStatus(att.responseStatus);
      attEl.innerHTML = `${escapeHtml(name)}<span class="status">${statusLabel}</span>`;
      textDiv.appendChild(attEl);
    });

    attendeesDiv.appendChild(textDiv);
    container.appendChild(attendeesDiv);
  }

  // Conference
  const meetLink = getMeetingLink(event);
  if (meetLink) {
    const solutionName = event.conferenceData?.conferenceSolution?.name || "Video call";
    const row = createDetailRow("\uD83C\uDFA5", solutionName);
    container.appendChild(row);
  }

  // Recurrence
  if (event.recurringEventId) {
    const row = createDetailRow("\uD83D\uDD04", "Recurring event");
    container.appendChild(row);
  }
}

function createDetailRow(iconText: string, text: string): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "detail-row";

  const icon = document.createElement("div");
  icon.className = "detail-row-icon";
  icon.textContent = iconText;
  row.appendChild(icon);

  const textDiv = document.createElement("div");
  textDiv.className = "detail-row-text";
  textDiv.textContent = text;
  row.appendChild(textDiv);

  return row;
}

function formatResponseStatus(status?: string): string {
  switch (status) {
    case "accepted":
      return " (accepted)";
    case "declined":
      return " (declined)";
    case "tentative":
      return " (maybe)";
    case "needsAction":
      return " (pending)";
    default:
      return "";
  }
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderEmptyState() {
  eventsContainer.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">
        <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
          <rect x="6" y="10" width="36" height="32" rx="3" />
          <line x1="6" y1="18" x2="42" y2="18" />
          <line x1="16" y1="6" x2="16" y2="14" />
          <line x1="32" y1="6" x2="32" y2="14" />
          <line x1="14" y1="26" x2="22" y2="26" />
          <line x1="14" y1="34" x2="22" y2="34" />
          <line x1="28" y1="26" x2="34" y2="26" />
        </svg>
      </div>
      <div class="empty-state-text">No upcoming events</div>
      <div class="empty-state-sub">Your schedule is clear</div>
    </div>
  `;
}

function renderLoading() {
  eventsContainer.innerHTML = `
    <div class="loading">
      <div class="loading-spinner"></div>
      <span>Loading events...</span>
    </div>
  `;
}

// ---- Expand/Collapse ----

async function toggleExpand(event: GCalEvent, card: HTMLDivElement) {
  if (expandedEventId === event.id) {
    // Collapse
    expandedEventId = null;
    expandedEventData = null;
    card.classList.remove("expanded");
    const detail = card.querySelector(".event-detail") as HTMLElement;
    if (detail) detail.innerHTML = "";
    return;
  }

  // Expand: fetch full event details
  expandedEventId = event.id;
  expandedEventData = null;

  // Remove expanded from all other cards
  document.querySelectorAll(".event-card.expanded").forEach((el) => {
    el.classList.remove("expanded");
    const d = el.querySelector(".event-detail") as HTMLElement;
    if (d) d.innerHTML = "";
  });

  card.classList.add("expanded");
  const detail = card.querySelector(".event-detail") as HTMLElement;
  if (!detail) return;

  // Show a brief loading state
  detail.innerHTML = '<div class="loading" style="padding: 8px 0; font-size: 12px;"><div class="loading-spinner" style="width: 16px; height: 16px; border-width: 2px;"></div></div>';

  try {
    const result = await getEvent(app, event.id, event.calendarId);
    expandedEventData = result.event;
    renderDetailInline(detail, result.event);
  } catch {
    // Fall back to inline event data
    expandedEventData = event;
    renderDetailInline(detail, event);
  }
}

// ---- Load More ----

async function loadMore() {
  if (isLoadingMore) return;

  // Find the last event's start datetime to compute timeMin
  let lastDate: string | null = null;
  for (let i = allEvents.length - 1; i >= 0; i--) {
    const { start } = getEventDateTime(allEvents[i]);
    if (start) {
      lastDate = start;
      break;
    }
  }

  if (!lastDate) return;

  // Set timeMin to the day after the last event
  const lastDateObj = new Date(lastDate);
  const nextDay = addDays(lastDateObj, 1);
  const timeMin = toISODate(nextDay) + "T00:00:00Z";

  isLoadingMore = true;

  // Disable load more button
  const loadMoreBtn = eventsContainer.querySelector(".load-more-btn") as HTMLButtonElement;
  if (loadMoreBtn) {
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = "Loading...";
  }

  try {
    const result = await listEvents(app, {
      calendarId: "primary",
      timeMin,
      maxResults: 25,
    });

    if (result.events && result.events.length > 0) {
      // Deduplicate by event ID
      const existingIds = new Set(allEvents.map((e) => e.id));
      const newEvents = result.events.filter((e) => !existingIds.has(e.id));
      allEvents = [...allEvents, ...newEvents];
      render();
    } else {
      // No more events
      if (loadMoreBtn) {
        loadMoreBtn.textContent = "No more events";
        loadMoreBtn.disabled = true;
      }
    }
  } catch {
    if (loadMoreBtn) {
      loadMoreBtn.textContent = "Failed to load - try again";
      loadMoreBtn.disabled = false;
    }
  } finally {
    isLoadingMore = false;
  }
}

// Auto-fetch if no data arrives from host
setTimeout(() => {
  if (allEvents.length === 0) fetchUpcoming();
}, 1500);
