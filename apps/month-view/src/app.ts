import { App } from "@modelcontextprotocol/ext-apps";
import {
  createGCalApp,
  parseToolResult,
  listEvents,
  getEvent,
  getEventColor,
  getMeetingLink,
  GCalEvent,
  ListEventsResult,
} from "../../shared/gcal-app";
import {
  formatTimeRange,
  formatDate,
  formatMonthYear,
  isAllDay,
  getEventDateTime,
  toISODate,
  addDays,
  startOfMonth,
  endOfMonth,
} from "../../shared/time-utils";

// ---- State ----
let currentMonth = new Date();
let allEvents: GCalEvent[] = [];
let app: App;

// ---- DOM refs ----
const monthTitle = document.getElementById("month-title") as HTMLHeadingElement;
const calendarGrid = document.getElementById("calendar-grid") as HTMLDivElement;
const popupContainer = document.getElementById("popup-container") as HTMLDivElement;
const prevBtn = document.getElementById("prev-btn") as HTMLButtonElement;
const nextBtn = document.getElementById("next-btn") as HTMLButtonElement;
const todayBtn = document.getElementById("today-btn") as HTMLButtonElement;

// ---- Helpers ----

/** Build a 42-cell (6-week) array of dates for the given month */
function buildMonthGrid(month: Date): Date[] {
  const first = startOfMonth(month);
  const startDay = first.getDay(); // 0=Sun
  const gridStart = addDays(first, -startDay);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push(addDays(gridStart, i));
  }
  return cells;
}

/** Group events by YYYY-MM-DD date key */
function groupEventsByDate(events: GCalEvent[]): Map<string, GCalEvent[]> {
  const map = new Map<string, GCalEvent[]>();
  for (const ev of events) {
    const { start, end } = getEventDateTime(ev);
    const startStr = start;
    const endStr = end;

    if (isAllDay(ev)) {
      // All-day events can span multiple days
      const startDate = new Date(startStr);
      const endDate = new Date(endStr);
      const d = new Date(startDate);
      while (d < endDate) {
        const key = toISODate(d);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(ev);
        d.setDate(d.getDate() + 1);
      }
    } else {
      const key = toISODate(new Date(startStr));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
  }
  return map;
}

/** Sort events: all-day first, then by start time */
function sortDayEvents(events: GCalEvent[]): GCalEvent[] {
  return [...events].sort((a, b) => {
    const aAllDay = isAllDay(a);
    const bAllDay = isAllDay(b);
    if (aAllDay && !bAllDay) return -1;
    if (!aAllDay && bAllDay) return 1;
    const aStart = getEventDateTime(a).start;
    const bStart = getEventDateTime(b).start;
    return new Date(aStart).getTime() - new Date(bStart).getTime();
  });
}

/** Render the full month grid */
function renderGrid(): void {
  const cells = buildMonthGrid(currentMonth);
  const eventsByDate = groupEventsByDate(allEvents);
  const currentMonthNum = currentMonth.getMonth();
  const todayStr = toISODate(new Date());

  monthTitle.textContent = formatMonthYear(currentMonth);

  calendarGrid.innerHTML = "";

  for (let i = 0; i < 42; i++) {
    const date = cells[i];
    const dateKey = toISODate(date);
    const isOutside = date.getMonth() !== currentMonthNum;
    const isTodayCell = dateKey === todayStr;
    const dayEvents = sortDayEvents(eventsByDate.get(dateKey) || []);

    const cell = document.createElement("div");
    cell.className = "day-cell";
    if (isOutside) cell.classList.add("outside-month");
    if (isTodayCell) cell.classList.add("today");

    // Date number
    const dateNum = document.createElement("div");
    dateNum.className = "day-number";
    dateNum.textContent = String(date.getDate());
    cell.appendChild(dateNum);

    // Event pills (max 3)
    const maxPills = 3;
    const visibleEvents = dayEvents.slice(0, maxPills);
    const overflowCount = dayEvents.length - maxPills;

    for (const ev of visibleEvents) {
      const pill = document.createElement("div");
      pill.className = "event-pill";
      if (isAllDay(ev)) pill.classList.add("all-day");
      pill.style.backgroundColor = getEventColor(ev);
      pill.textContent = ev.summary || "(No title)";
      pill.title = ev.summary || "(No title)";

      pill.addEventListener("click", (e) => {
        e.stopPropagation();
        showEventDetail(ev);
      });

      cell.appendChild(pill);
    }

    if (overflowCount > 0) {
      const more = document.createElement("div");
      more.className = "more-link";
      more.textContent = `+${overflowCount} more`;
      more.addEventListener("click", (e) => {
        e.stopPropagation();
        showDayPopup(date, dayEvents);
      });
      cell.appendChild(more);
    }

    // Click day cell to show all events for that day
    cell.addEventListener("click", () => {
      if (dayEvents.length > 0) {
        showDayPopup(date, dayEvents);
      } else {
        // Fetch events for this specific day
        fetchDayEvents(date);
      }
    });

    calendarGrid.appendChild(cell);
  }
}

/** Fetch events for a specific day and show popup */
async function fetchDayEvents(date: Date): Promise<void> {
  try {
    const timeMin = new Date(date);
    timeMin.setHours(0, 0, 0, 0);
    const timeMax = new Date(date);
    timeMax.setHours(23, 59, 59, 999);

    const result = await listEvents(app, {
      calendarId: "primary",
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
    });

    if (result.events.length > 0) {
      showDayPopup(date, result.events);
    } else {
      showDayPopup(date, []);
    }
  } catch (err) {
    console.error("Failed to fetch day events:", err);
  }
}

/** Show a popup with all events for a given day */
function showDayPopup(date: Date, events: GCalEvent[]): void {
  const sorted = sortDayEvents(events);
  const dateLabel = formatDate(date.toISOString());

  popupContainer.innerHTML = "";

  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closePopup();
  });

  const popup = document.createElement("div");
  popup.className = "popup";

  const closeBtn = document.createElement("button");
  closeBtn.className = "popup-close";
  closeBtn.innerHTML = "&times;";
  closeBtn.addEventListener("click", closePopup);
  popup.appendChild(closeBtn);

  const title = document.createElement("h2");
  title.textContent = dateLabel;
  popup.appendChild(title);

  if (sorted.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No events on this day";
    popup.appendChild(empty);
  } else {
    for (const ev of sorted) {
      const item = document.createElement("div");
      item.className = "popup-event-item";

      const dot = document.createElement("div");
      dot.className = "popup-event-dot";
      dot.style.backgroundColor = getEventColor(ev);
      item.appendChild(dot);

      const info = document.createElement("div");
      info.className = "popup-event-info";

      const evTitle = document.createElement("div");
      evTitle.className = "popup-event-title";
      evTitle.textContent = ev.summary || "(No title)";
      info.appendChild(evTitle);

      const evTime = document.createElement("div");
      evTime.className = "popup-event-time";
      if (isAllDay(ev)) {
        evTime.textContent = "All day";
      } else {
        const { start, end } = getEventDateTime(ev);
        evTime.textContent = formatTimeRange(start, end);
      }
      info.appendChild(evTime);

      item.appendChild(info);

      item.addEventListener("click", () => {
        showEventDetail(ev);
      });

      popup.appendChild(item);
    }
  }

  overlay.appendChild(popup);
  popupContainer.appendChild(overlay);
}

/** Show detailed event info in a popup */
async function showEventDetail(ev: GCalEvent): Promise<void> {
  // Try to get fresh event data
  let event = ev;
  try {
    const result = await getEvent(app, ev.id, ev.calendarId);
    event = result.event;
  } catch {
    // Use the existing event data if fetch fails
  }

  popupContainer.innerHTML = "";

  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closePopup();
  });

  const popup = document.createElement("div");
  popup.className = "popup detail-popup";

  const closeBtn = document.createElement("button");
  closeBtn.className = "popup-close";
  closeBtn.innerHTML = "&times;";
  closeBtn.addEventListener("click", closePopup);
  popup.appendChild(closeBtn);

  // Title
  const title = document.createElement("h2");
  title.textContent = event.summary || "(No title)";
  title.style.borderLeft = `4px solid ${getEventColor(event)}`;
  title.style.paddingLeft = "10px";
  popup.appendChild(title);

  // Date/Time
  const timeSection = document.createElement("div");
  timeSection.className = "detail-section";
  const timeLabel = document.createElement("div");
  timeLabel.className = "detail-label";
  timeLabel.textContent = "Date & Time";
  timeSection.appendChild(timeLabel);
  const timeValue = document.createElement("div");
  timeValue.className = "detail-value";
  if (isAllDay(event)) {
    const { start } = getEventDateTime(event);
    timeValue.textContent = formatDate(start);
  } else {
    const { start, end } = getEventDateTime(event);
    timeValue.textContent = `${formatDate(start)}, ${formatTimeRange(start, end)}`;
  }
  timeSection.appendChild(timeValue);
  popup.appendChild(timeSection);

  // Location
  if (event.location) {
    const locSection = document.createElement("div");
    locSection.className = "detail-section";
    const locLabel = document.createElement("div");
    locLabel.className = "detail-label";
    locLabel.textContent = "Location";
    locSection.appendChild(locLabel);
    const locValue = document.createElement("div");
    locValue.className = "detail-value";
    locValue.textContent = event.location;
    locValue.style.color = "#1a73e8";
    locValue.style.cursor = "pointer";
    locValue.addEventListener("click", () => {
      app.sendOpenLink({ url: `https://maps.google.com/?q=${encodeURIComponent(event.location!)}` });
    });
    locSection.appendChild(locValue);
    popup.appendChild(locSection);
  }

  // Description
  if (event.description) {
    const descSection = document.createElement("div");
    descSection.className = "detail-section";
    const descLabel = document.createElement("div");
    descLabel.className = "detail-label";
    descLabel.textContent = "Description";
    descSection.appendChild(descLabel);
    const descValue = document.createElement("div");
    descValue.className = "detail-value";
    descValue.style.whiteSpace = "pre-wrap";
    descValue.style.wordBreak = "break-word";
    descValue.textContent = event.description;
    descSection.appendChild(descValue);
    popup.appendChild(descSection);
  }

  // Attendees
  if (event.attendees && event.attendees.length > 0) {
    const attSection = document.createElement("div");
    attSection.className = "detail-section";
    const attLabel = document.createElement("div");
    attLabel.className = "detail-label";
    attLabel.textContent = "Attendees";
    attSection.appendChild(attLabel);

    for (const att of event.attendees) {
      const attItem = document.createElement("div");
      attItem.style.display = "flex";
      attItem.style.alignItems = "center";
      attItem.style.gap = "6px";
      attItem.style.padding = "3px 0";
      attItem.style.fontSize = "13px";

      const statusColors: Record<string, string> = {
        accepted: "#34a853",
        declined: "#ea4335",
        tentative: "#fbbc04",
        needsAction: "#9e9e9e",
      };
      const statusColor = statusColors[att.responseStatus || "needsAction"] || "#9e9e9e";

      const dot = document.createElement("span");
      dot.style.width = "8px";
      dot.style.height = "8px";
      dot.style.borderRadius = "50%";
      dot.style.backgroundColor = statusColor;
      dot.style.flexShrink = "0";
      attItem.appendChild(dot);

      const name = document.createElement("span");
      name.className = "detail-value";
      name.textContent = att.displayName || att.email;
      if (att.organizer) name.textContent += " (organizer)";
      if (att.self) name.style.fontWeight = "600";
      attItem.appendChild(name);

      attSection.appendChild(attItem);
    }

    popup.appendChild(attSection);
  }

  // Meeting link
  const meetingLink = getMeetingLink(event);
  if (meetingLink) {
    const meetSection = document.createElement("div");
    meetSection.className = "detail-section";
    const meetBtn = document.createElement("button");
    meetBtn.textContent = "Join Meeting";
    meetBtn.style.cssText =
      "background: #34a853; color: #fff; border: none; border-radius: 20px; padding: 8px 20px; font-size: 13px; font-weight: 500; cursor: pointer;";
    meetBtn.addEventListener("click", () => {
      app.sendOpenLink({ url: meetingLink });
    });
    meetSection.appendChild(meetBtn);
    popup.appendChild(meetSection);
  }

  overlay.appendChild(popup);
  popupContainer.appendChild(overlay);
}

function closePopup(): void {
  popupContainer.innerHTML = "";
}

/** Load events for the current month */
async function loadMonth(): Promise<void> {
  const first = startOfMonth(currentMonth);
  const last = endOfMonth(currentMonth);

  // Extend range to cover the full 6-week grid
  const gridStart = addDays(first, -first.getDay());
  const gridEnd = addDays(gridStart, 42);

  monthTitle.textContent = formatMonthYear(currentMonth);
  calendarGrid.innerHTML = '<div class="loading"><div class="loading-spinner"></div>Loading events...</div>';

  try {
    const result = await listEvents(app, {
      calendarId: "primary",
      timeMin: gridStart.toISOString(),
      timeMax: gridEnd.toISOString(),
      maxResults: 500,
    });
    allEvents = result.events;
    renderGrid();
  } catch (err) {
    console.error("Failed to load month events:", err);
    calendarGrid.innerHTML = '<div class="empty-state">Failed to load events. Please try again.</div>';
  }
}

/** Navigate to previous month */
function goToPrevMonth(): void {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
  loadMonth();
}

/** Navigate to next month */
function goToNextMonth(): void {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
  loadMonth();
}

/** Navigate to today's month */
function goToToday(): void {
  currentMonth = new Date();
  currentMonth.setDate(1);
  loadMonth();
}

// ---- Init ----
prevBtn.addEventListener("click", goToPrevMonth);
nextBtn.addEventListener("click", goToNextMonth);
todayBtn.addEventListener("click", goToToday);

// Close popup on Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closePopup();
});

app = createGCalApp("Month View");

// Handle tool results pushed from MCP host
app.ontoolresult = (result: any) => {
  try {
    const data = parseToolResult<ListEventsResult>(result);
    if (data.events) {
      // Determine the month from the first event, or use current
      if (data.events.length > 0) {
        const firstStart = getEventDateTime(data.events[0]).start;
        if (firstStart) {
          const d = new Date(firstStart);
          currentMonth = new Date(d.getFullYear(), d.getMonth(), 1);
        }
      }
      allEvents = data.events;
      renderGrid();
    }
  } catch {
    // Not a ListEventsResult, ignore
  }
};

// Initial load for current month
loadMonth();
