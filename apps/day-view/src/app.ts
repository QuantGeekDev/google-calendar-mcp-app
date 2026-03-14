import { App } from "@modelcontextprotocol/ext-apps";
import {
  createGCalApp,
  parseToolResult,
  listEvents,
  getEvent,
  createEvent,
  getEventColor,
  getMeetingLink,
  GCalEvent,
  ListEventsResult,
} from "../../shared/gcal-app";
import {
  formatTime,
  formatTimeRange,
  formatDate,
  getHourFraction,
  getDurationMinutes,
  isAllDay,
  getEventDateTime,
  toISODate,
  addDays,
  startOfDay,
  endOfDay,
} from "../../shared/time-utils";

// ── State ──────────────────────────────────────────────────────────────
let currentDate = new Date();
let events: GCalEvent[] = [];
let currentTimeInterval: ReturnType<typeof setInterval> | null = null;

// ── DOM refs ───────────────────────────────────────────────────────────
const headerDate = document.getElementById("headerDate")!;
const prevBtn = document.getElementById("prevBtn")!;
const nextBtn = document.getElementById("nextBtn")!;
const todayBtn = document.getElementById("todayBtn")!;
const allDaySection = document.getElementById("allDaySection")!;
const gridContainer = document.getElementById("gridContainer")!;
const timeGrid = document.getElementById("timeGrid")!;
const currentTimeLine = document.getElementById("currentTimeLine")!;
const fabBtn = document.getElementById("fabBtn")!;
const popupOverlay = document.getElementById("popupOverlay")!;
const popup = document.getElementById("popup")!;

// ── App setup ──────────────────────────────────────────────────────────
const app = createGCalApp("Day View");

app.ontoolresult = (result: unknown) => {
  try {
    const data = parseToolResult<ListEventsResult>(result);
    if (data.events && data.events.length > 0) {
      // Infer date from the first timed event
      const firstTimed = data.events.find((e) => !isAllDay(e));
      if (firstTimed) {
        const dt = getEventDateTime(firstTimed);
        currentDate = new Date(dt.start);
        // Normalize to start of day
        currentDate.setHours(0, 0, 0, 0);
      }
    }
    events = data.events || [];
    render();
  } catch {
    // Tool returned an error or unexpected format — auto-fetch today
    console.log("Tool result not usable, auto-fetching today's events...");
    fetchDay();
  }
};

// ── Navigation ─────────────────────────────────────────────────────────
prevBtn.addEventListener("click", () => navigateDay(-1));
nextBtn.addEventListener("click", () => navigateDay(1));
todayBtn.addEventListener("click", () => {
  currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  fetchDay();
});

function navigateDay(offset: number): void {
  currentDate = addDays(currentDate, offset);
  fetchDay();
}

async function fetchDay(): Promise<void> {
  try {
    const data = await listEvents(app, {
      calendarId: "primary",
      timeMin: startOfDay(currentDate),
      timeMax: endOfDay(currentDate),
    });
    events = data.events || [];
    render();
  } catch (err) {
    console.error("Failed to fetch events:", err);
  }
}

// ── FAB ────────────────────────────────────────────────────────────────
fabBtn.addEventListener("click", async () => {
  const now = new Date();
  const startHour = now.getHours() + 1;
  const startDate = new Date(currentDate);
  startDate.setHours(startHour, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setHours(startHour + 1);

  const summary = prompt("Event title:");
  if (!summary) return;

  try {
    await createEvent(app, {
      summary,
      startDateTime: startDate.toISOString(),
      endDateTime: endDate.toISOString(),
    });
    await fetchDay();
  } catch (err) {
    console.error("Failed to create event:", err);
  }
});

// ── Popup ──────────────────────────────────────────────────────────────
popupOverlay.addEventListener("click", (e) => {
  if (e.target === popupOverlay) closePopup();
});

function closePopup(): void {
  popupOverlay.classList.remove("visible");
}

async function showEventPopup(event: GCalEvent): Promise<void> {
  // Try to get full details
  let ev = event;
  try {
    const detail = await getEvent(app, event.id, event.calendarId);
    ev = detail.event;
  } catch {
    // Use what we have
  }

  const dt = getEventDateTime(ev);
  const color = getEventColor(ev);
  const meetLink = getMeetingLink(ev);
  const allDay = isAllDay(ev);

  let html = `
    <button class="popup-close" id="popupCloseBtn">&times;</button>
    <div class="popup-color-bar" style="background:${color}"></div>
    <div class="popup-title">${escapeHtml(ev.summary || "(No title)")}</div>
  `;

  // Time
  if (allDay) {
    html += `<div class="popup-row">
      <span class="popup-row-icon">&#128197;</span>
      <span class="popup-row-text">${formatDate(dt.start)} &middot; All day</span>
    </div>`;
  } else {
    html += `<div class="popup-row">
      <span class="popup-row-icon">&#128337;</span>
      <span class="popup-row-text">${formatDate(dt.start)}<br>${formatTimeRange(dt.start, dt.end)}</span>
    </div>`;
  }

  // Location
  if (ev.location) {
    html += `<div class="popup-row">
      <span class="popup-row-icon">&#128205;</span>
      <span class="popup-row-text">${escapeHtml(ev.location)}</span>
    </div>`;
  }

  // Meeting link
  if (meetLink) {
    html += `<div class="popup-row">
      <span class="popup-row-icon">&#127909;</span>
      <span class="popup-row-text"><a href="${escapeHtml(meetLink)}" target="_blank" rel="noopener">Join meeting</a></span>
    </div>`;
  }

  // Description
  if (ev.description) {
    html += `<div class="popup-row">
      <span class="popup-row-icon">&#128196;</span>
      <span class="popup-row-text">${escapeHtml(ev.description).replace(/\n/g, "<br>")}</span>
    </div>`;
  }

  // Organizer
  if (ev.organizer) {
    const name = ev.organizer.displayName || ev.organizer.email || "";
    html += `<div class="popup-row">
      <span class="popup-row-icon">&#128100;</span>
      <span class="popup-row-text">${escapeHtml(name)}</span>
    </div>`;
  }

  // Attendees
  if (ev.attendees && ev.attendees.length > 0) {
    let attendeeHtml = `<div class="popup-attendees">`;
    for (const a of ev.attendees) {
      const label = a.displayName || a.email;
      const statusIcon = a.responseStatus === "accepted" ? "&#10003;" : a.responseStatus === "declined" ? "&#10007;" : "?";
      attendeeHtml += `<div class="popup-attendee">${escapeHtml(label)} <span class="status">${statusIcon}</span></div>`;
    }
    attendeeHtml += `</div>`;
    html += `<div class="popup-row">
      <span class="popup-row-icon">&#128101;</span>
      <span class="popup-row-text">${attendeeHtml}</span>
    </div>`;
  }

  // Calendar link
  if (ev.htmlLink) {
    html += `<div class="popup-row">
      <span class="popup-row-icon">&#128279;</span>
      <span class="popup-row-text"><a href="${escapeHtml(ev.htmlLink)}" target="_blank" rel="noopener">Open in Google Calendar</a></span>
    </div>`;
  }

  popup.innerHTML = html;
  popupOverlay.classList.add("visible");

  document.getElementById("popupCloseBtn")?.addEventListener("click", closePopup);
}

// ── Render ─────────────────────────────────────────────────────────────
function render(): void {
  // Update header
  headerDate.textContent = formatDate(currentDate.toISOString());

  // Separate all-day and timed events
  const allDayEvents = events.filter((e) => isAllDay(e));
  const timedEvents = events.filter((e) => !isAllDay(e));

  // All-day section
  renderAllDayEvents(allDayEvents);

  // Time grid
  renderTimeGrid(timedEvents);

  // Current time line
  updateCurrentTimeLine();

  // Scroll to 7am or current time
  scrollToRelevantTime();
}

function renderAllDayEvents(allDay: GCalEvent[]): void {
  if (allDay.length === 0) {
    allDaySection.classList.remove("has-events");
    allDaySection.innerHTML = "";
    return;
  }

  allDaySection.classList.add("has-events");
  allDaySection.innerHTML = allDay
    .map((e) => {
      const color = getEventColor(e);
      return `<div class="all-day-chip" style="background:${color}" data-event-id="${e.id}">${escapeHtml(e.summary || "(No title)")}</div>`;
    })
    .join("");

  allDaySection.querySelectorAll(".all-day-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const id = (chip as HTMLElement).dataset.eventId!;
      const ev = events.find((e) => e.id === id);
      if (ev) showEventPopup(ev);
    });
  });
}

function renderTimeGrid(timedEvents: GCalEvent[]): void {
  // Build hour rows
  let gridHtml = "";
  for (let h = 0; h < 24; h++) {
    const top = h * 60; // hour-height = 60px
    const label = h === 0 ? "" : formatHourLabel(h);
    gridHtml += `<div class="hour-row" style="top:${top}px">
      ${h > 0 ? `<span class="hour-label">${label}</span>` : ""}
      <div class="hour-line"></div>
      <div class="half-hour-line"></div>
    </div>`;
  }

  // Events layer
  gridHtml += `<div class="events-layer" id="eventsLayer"></div>`;
  timeGrid.innerHTML = gridHtml;

  // Calculate overlapping groups and render events
  const eventsLayer = document.getElementById("eventsLayer")!;
  const groups = computeOverlapGroups(timedEvents);

  for (const group of groups) {
    const columns = assignColumns(group);
    const totalCols = columns.length;

    for (let col = 0; col < totalCols; col++) {
      for (const ev of columns[col]) {
        const dt = getEventDateTime(ev);
        const startFrac = getHourFraction(dt.start);
        const durationMin = Math.max(getDurationMinutes(dt.start, dt.end), 15);
        const top = startFrac * 60; // 60px per hour, 1px per minute
        const height = Math.max(durationMin, 15); // min height 15px
        const color = getEventColor(ev);

        const left = (col / totalCols) * 100;
        const width = (1 / totalCols) * 100 - 1; // 1% gap

        const block = document.createElement("div");
        block.className = "event-block";
        block.style.top = `${top}px`;
        block.style.height = `${height}px`;
        block.style.left = `${left}%`;
        block.style.width = `${width}%`;
        block.style.backgroundColor = color;
        block.dataset.eventId = ev.id;

        let content = `<div class="event-title">${escapeHtml(ev.summary || "(No title)")}</div>`;
        if (height >= 30) {
          content += `<div class="event-time">${formatTimeRange(dt.start, dt.end)}</div>`;
        }
        if (height >= 45 && ev.location) {
          content += `<div class="event-location">${escapeHtml(ev.location)}</div>`;
        }
        block.innerHTML = content;

        block.addEventListener("click", () => showEventPopup(ev));
        eventsLayer.appendChild(block);
      }
    }
  }
}

function scrollToRelevantTime(): void {
  const now = new Date();
  const isViewingToday = toISODate(currentDate) === toISODate(now);
  const scrollHour = isViewingToday ? Math.max(now.getHours() - 1, 0) : 7;
  gridContainer.scrollTop = scrollHour * 60;
}

// ── Current time line ──────────────────────────────────────────────────
function updateCurrentTimeLine(): void {
  const now = new Date();
  const isViewingToday = toISODate(currentDate) === toISODate(now);

  if (!isViewingToday) {
    currentTimeLine.classList.remove("visible");
    return;
  }

  currentTimeLine.classList.add("visible");
  const frac = now.getHours() + now.getMinutes() / 60;
  currentTimeLine.style.top = `${frac * 60}px`;
}

// Update time line every minute
if (currentTimeInterval) clearInterval(currentTimeInterval);
currentTimeInterval = setInterval(updateCurrentTimeLine, 60000);

// ── Overlap computation ────────────────────────────────────────────────
interface TimeSlot {
  start: number;
  end: number;
  event: GCalEvent;
}

function computeOverlapGroups(timedEvents: GCalEvent[]): GCalEvent[][] {
  if (timedEvents.length === 0) return [];

  const slots: TimeSlot[] = timedEvents
    .map((ev) => {
      const dt = getEventDateTime(ev);
      return {
        start: getHourFraction(dt.start),
        end: getHourFraction(dt.end),
        event: ev,
      };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const groups: GCalEvent[][] = [];
  let currentGroup: TimeSlot[] = [slots[0]];
  let groupEnd = slots[0].end;

  for (let i = 1; i < slots.length; i++) {
    if (slots[i].start < groupEnd) {
      // Overlaps with current group
      currentGroup.push(slots[i]);
      groupEnd = Math.max(groupEnd, slots[i].end);
    } else {
      groups.push(currentGroup.map((s) => s.event));
      currentGroup = [slots[i]];
      groupEnd = slots[i].end;
    }
  }
  groups.push(currentGroup.map((s) => s.event));

  return groups;
}

function assignColumns(group: GCalEvent[]): GCalEvent[][] {
  if (group.length === 0) return [];

  // Sort by start time
  const sorted = [...group].sort((a, b) => {
    const adt = getEventDateTime(a);
    const bdt = getEventDateTime(b);
    return getHourFraction(adt.start) - getHourFraction(bdt.start);
  });

  const columns: GCalEvent[][] = [];

  for (const ev of sorted) {
    const dt = getEventDateTime(ev);
    const evStart = getHourFraction(dt.start);

    let placed = false;
    for (const col of columns) {
      const lastInCol = col[col.length - 1];
      const lastDt = getEventDateTime(lastInCol);
      const lastEnd = getHourFraction(lastDt.end);

      if (evStart >= lastEnd) {
        col.push(ev);
        placed = true;
        break;
      }
    }

    if (!placed) {
      columns.push([ev]);
    }
  }

  return columns;
}

// ── Helpers ────────────────────────────────────────────────────────────
function formatHourLabel(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ── Initial render ─────────────────────────────────────────────────────
render();

// Auto-fetch today's events after a short delay (gives host time to push tool result)
setTimeout(() => {
  if (events.length === 0) {
    fetchDay();
  }
}, 1500);
