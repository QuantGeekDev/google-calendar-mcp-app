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
let weekStart = getWeekStart(new Date()); // Sunday
let events: GCalEvent[] = [];
let currentTimeInterval: ReturnType<typeof setInterval> | null = null;

// ── DOM refs ───────────────────────────────────────────────────────────
const topBarTitle = document.getElementById("topBarTitle")!;
const prevBtn = document.getElementById("prevBtn")!;
const nextBtn = document.getElementById("nextBtn")!;
const todayBtn = document.getElementById("todayBtn")!;
const dayHeaderCols = document.getElementById("dayHeaderCols")!;
const allDayRow = document.getElementById("allDayRow")!;
const allDayCols = document.getElementById("allDayCols")!;
const gridScroll = document.getElementById("gridScroll")!;
const gridBody = document.getElementById("gridBody")!;
const timeGutter = document.getElementById("timeGutter")!;
const dayColumns = document.getElementById("dayColumns")!;
const popupOverlay = document.getElementById("popupOverlay")!;
const popup = document.getElementById("popup")!;

const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOUR_HEIGHT = 48;

// ── App setup ──────────────────────────────────────────────────────────
const app = createGCalApp("Week View");

app.ontoolresult = (result: unknown) => {
  try {
    const data = parseToolResult<ListEventsResult>(result);
    if (data.events) {
      // Infer week from first event
      if (data.events.length > 0) {
        const firstTimed = data.events.find((e) => !isAllDay(e));
        if (firstTimed) {
          const dt = getEventDateTime(firstTimed);
          weekStart = getWeekStart(new Date(dt.start));
        } else {
          // All-day events only
          const dt = getEventDateTime(data.events[0]);
          weekStart = getWeekStart(new Date(dt.start));
        }
      }
      events = data.events;
      render();
    }
  } catch {
    console.log("Tool result not usable, auto-fetching this week...");
    fetchWeek();
  }
};

// ── Navigation ─────────────────────────────────────────────────────────
prevBtn.addEventListener("click", () => navigateWeek(-7));
nextBtn.addEventListener("click", () => navigateWeek(7));
todayBtn.addEventListener("click", () => {
  weekStart = getWeekStart(new Date());
  fetchWeek();
});

function navigateWeek(offset: number): void {
  weekStart = addDays(weekStart, offset);
  fetchWeek();
}

async function fetchWeek(): Promise<void> {
  const weekEnd = addDays(weekStart, 7);
  try {
    const data = await listEvents(app, {
      calendarId: "primary",
      timeMin: startOfDay(weekStart),
      timeMax: endOfDay(addDays(weekEnd, -1)),
    });
    events = data.events || [];
    render();
  } catch (err) {
    console.error("Failed to fetch events:", err);
  }
}

// ── Popup ──────────────────────────────────────────────────────────────
popupOverlay.addEventListener("click", (e) => {
  if (e.target === popupOverlay) closePopup();
});

function closePopup(): void {
  popupOverlay.classList.remove("visible");
}

async function showEventPopup(event: GCalEvent): Promise<void> {
  let ev = event;
  try {
    const detail = await getEvent(app, event.id, event.calendarId);
    ev = detail.event;
  } catch {
    // Use existing data
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

  if (ev.location) {
    html += `<div class="popup-row">
      <span class="popup-row-icon">&#128205;</span>
      <span class="popup-row-text">${escapeHtml(ev.location)}</span>
    </div>`;
  }

  if (meetLink) {
    html += `<div class="popup-row">
      <span class="popup-row-icon">&#127909;</span>
      <span class="popup-row-text"><a href="${escapeHtml(meetLink)}" target="_blank" rel="noopener">Join meeting</a></span>
    </div>`;
  }

  if (ev.description) {
    html += `<div class="popup-row">
      <span class="popup-row-icon">&#128196;</span>
      <span class="popup-row-text">${escapeHtml(ev.description).replace(/\n/g, "<br>")}</span>
    </div>`;
  }

  if (ev.organizer) {
    const name = ev.organizer.displayName || ev.organizer.email || "";
    html += `<div class="popup-row">
      <span class="popup-row-icon">&#128100;</span>
      <span class="popup-row-text">${escapeHtml(name)}</span>
    </div>`;
  }

  if (ev.attendees && ev.attendees.length > 0) {
    let attendeeHtml = `<div class="popup-attendees">`;
    for (const a of ev.attendees) {
      const label = a.displayName || a.email;
      const statusIcon =
        a.responseStatus === "accepted"
          ? "&#10003;"
          : a.responseStatus === "declined"
            ? "&#10007;"
            : "?";
      attendeeHtml += `<div class="popup-attendee">${escapeHtml(label)} <span class="status">${statusIcon}</span></div>`;
    }
    attendeeHtml += `</div>`;
    html += `<div class="popup-row">
      <span class="popup-row-icon">&#128101;</span>
      <span class="popup-row-text">${attendeeHtml}</span>
    </div>`;
  }

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
  const weekEnd = addDays(weekStart, 6);
  const today = new Date();
  const todayISO = toISODate(today);

  // Title: "Mar 8 - 14, 2026" or spanning months "Feb 28 - Mar 6, 2026"
  topBarTitle.textContent = formatWeekTitle(weekStart, weekEnd);

  // Build day-of-week columns for each day
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(addDays(weekStart, i));
  }

  // Day headers
  dayHeaderCols.innerHTML = days
    .map((d, i) => {
      const iso = toISODate(d);
      const isToday = iso === todayISO;
      const isWeekend = i === 0 || i === 6;
      const classes = ["day-header"];
      if (isToday) classes.push("today");
      if (isWeekend) classes.push("weekend");
      return `<div class="${classes.join(" ")}">
        <div class="day-header-dow">${DOW_SHORT[i]}</div>
        <div class="day-header-num">${d.getDate()}</div>
      </div>`;
    })
    .join("");

  // Categorize events by day
  const dayEvents: Map<string, GCalEvent[]> = new Map();
  const allDayEvents: Map<string, GCalEvent[]> = new Map();

  for (const d of days) {
    const iso = toISODate(d);
    dayEvents.set(iso, []);
    allDayEvents.set(iso, []);
  }

  for (const ev of events) {
    if (isAllDay(ev)) {
      // All-day events can span multiple days
      const dt = getEventDateTime(ev);
      const evStart = new Date(dt.start);
      const evEnd = new Date(dt.end);
      for (const d of days) {
        const dayStart = new Date(d);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(d);
        dayEnd.setHours(23, 59, 59, 999);
        if (evStart <= dayEnd && evEnd > dayStart) {
          const iso = toISODate(d);
          allDayEvents.get(iso)?.push(ev);
        }
      }
    } else {
      const dt = getEventDateTime(ev);
      const evDate = toISODate(new Date(dt.start));
      if (dayEvents.has(evDate)) {
        dayEvents.get(evDate)!.push(ev);
      }
    }
  }

  // All-day row
  const hasAnyAllDay = Array.from(allDayEvents.values()).some((arr) => arr.length > 0);
  if (hasAnyAllDay) {
    allDayRow.classList.add("has-events");
    allDayCols.innerHTML = days
      .map((d) => {
        const iso = toISODate(d);
        const dayAllDay = allDayEvents.get(iso) || [];
        const pills = dayAllDay
          .map(
            (ev) =>
              `<div class="all-day-pill" style="background:${getEventColor(ev)}" data-event-id="${ev.id}">${escapeHtml(ev.summary || "(No title)")}</div>`
          )
          .join("");
        return `<div class="all-day-col">${pills}</div>`;
      })
      .join("");

    // Attach click handlers for all-day pills
    allDayCols.querySelectorAll(".all-day-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        const id = (pill as HTMLElement).dataset.eventId!;
        const ev = events.find((e) => e.id === id);
        if (ev) showEventPopup(ev);
      });
    });
  } else {
    allDayRow.classList.remove("has-events");
    allDayCols.innerHTML = "";
  }

  // Time gutter labels
  let gutterHtml = "";
  for (let h = 1; h < 24; h++) {
    gutterHtml += `<div class="gutter-label" style="top:${h * HOUR_HEIGHT}px">${formatHourLabel(h)}</div>`;
  }
  timeGutter.innerHTML = gutterHtml;

  // Day columns with grid lines and events
  let columnsHtml = `<div class="grid-lines">`;
  for (let h = 0; h < 24; h++) {
    columnsHtml += `<div class="grid-hour-line" style="top:${h * HOUR_HEIGHT}px"></div>`;
    columnsHtml += `<div class="grid-half-line" style="top:${h * HOUR_HEIGHT + HOUR_HEIGHT / 2}px"></div>`;
  }
  columnsHtml += `</div>`;

  // Day columns
  for (let i = 0; i < 7; i++) {
    const d = days[i];
    const iso = toISODate(d);
    const isToday = iso === todayISO;
    const isWeekend = i === 0 || i === 6;
    const classes = ["day-column"];
    if (isToday) classes.push("today");
    if (isWeekend) classes.push("weekend");

    columnsHtml += `<div class="${classes.join(" ")}" data-day-index="${i}">`;

    // Render timed events for this day
    const dayEvs = dayEvents.get(iso) || [];
    const groups = computeOverlapGroups(dayEvs);

    for (const group of groups) {
      const columns = assignColumns(group);
      const totalCols = columns.length;

      for (let col = 0; col < totalCols; col++) {
        for (const ev of columns[col]) {
          const dt = getEventDateTime(ev);
          const startFrac = getHourFraction(dt.start);
          const durationMin = Math.max(getDurationMinutes(dt.start, dt.end), 15);
          const top = startFrac * HOUR_HEIGHT;
          const height = Math.max((durationMin / 60) * HOUR_HEIGHT, 12);
          const color = getEventColor(ev);

          const leftPct = (col / totalCols) * 100;
          const widthPct = (1 / totalCols) * 100 - 1;

          let content = `<div class="week-event-title">${escapeHtml(ev.summary || "(No title)")}</div>`;
          if (height >= 24) {
            content += `<div class="week-event-time">${formatTime(dt.start)}</div>`;
          }

          columnsHtml += `<div class="week-event" style="top:${top}px;height:${height}px;left:${leftPct}%;width:${widthPct}%;background:${color}" data-event-id="${ev.id}">${content}</div>`;
        }
      }
    }

    // Current time line for today
    if (isToday) {
      const nowFrac = today.getHours() + today.getMinutes() / 60;
      columnsHtml += `<div class="current-time-line visible" style="top:${nowFrac * HOUR_HEIGHT}px"></div>`;
    }

    columnsHtml += `</div>`;
  }

  dayColumns.innerHTML = columnsHtml;

  // Attach click handlers for timed events
  dayColumns.querySelectorAll(".week-event").forEach((el) => {
    el.addEventListener("click", () => {
      const id = (el as HTMLElement).dataset.eventId!;
      const ev = events.find((e) => e.id === id);
      if (ev) showEventPopup(ev);
    });
  });

  // Scroll to relevant time
  scrollToRelevantTime();

  // Set up current time line updates
  setupCurrentTimeUpdater();
}

function scrollToRelevantTime(): void {
  const now = new Date();
  const todayISO = toISODate(now);
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    weekDays.push(toISODate(addDays(weekStart, i)));
  }
  const isViewingThisWeek = weekDays.includes(todayISO);
  const scrollHour = isViewingThisWeek ? Math.max(now.getHours() - 1, 0) : 7;
  gridScroll.scrollTop = scrollHour * HOUR_HEIGHT;
}

function setupCurrentTimeUpdater(): void {
  if (currentTimeInterval) clearInterval(currentTimeInterval);
  currentTimeInterval = setInterval(() => {
    const now = new Date();
    const todayISO = toISODate(now);
    // Find today's column
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      if (toISODate(d) === todayISO) {
        const col = dayColumns.querySelector(`.day-column[data-day-index="${i}"]`);
        if (col) {
          const line = col.querySelector(".current-time-line") as HTMLElement | null;
          if (line) {
            const frac = now.getHours() + now.getMinutes() / 60;
            line.style.top = `${frac * HOUR_HEIGHT}px`;
          }
        }
        break;
      }
    }
  }, 60000);
}

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
function getWeekStart(d: Date): Date {
  const s = new Date(d);
  s.setDate(s.getDate() - s.getDay()); // Sunday
  s.setHours(0, 0, 0, 0);
  return s;
}

function formatWeekTitle(start: Date, end: Date): string {
  const startMonth = start.toLocaleDateString("en-US", { month: "short" });
  const endMonth = end.toLocaleDateString("en-US", { month: "short" });
  const year = end.getFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()} \u2013 ${end.getDate()}, ${year}`;
  }
  return `${startMonth} ${start.getDate()} \u2013 ${endMonth} ${end.getDate()}, ${year}`;
}

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

setTimeout(() => {
  if (events.length === 0) fetchWeek();
}, 1500);
