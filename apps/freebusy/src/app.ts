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
const app = createGCalApp("Free/Busy Availability");
let currentRange: "today" | "week" | "custom" = "today";
let lastData: FreeBusyResult | null = null;

// ── DOM refs ───────────────────────────────────────────────────────────────
const contentEl = document.getElementById("content")!;
const dateRangeEl = document.getElementById("dateRange")!;
const btnToday = document.getElementById("btnToday")!;
const btnWeek = document.getElementById("btnWeek")!;
const btnCustom = document.getElementById("btnCustom")!;

// ── Range button handlers ──────────────────────────────────────────────────
function setActiveButton(active: string) {
  [btnToday, btnWeek, btnCustom].forEach((b) => b.classList.remove("active"));
  const btn = active === "today" ? btnToday : active === "week" ? btnWeek : btnCustom;
  btn.classList.add("active");
}

btnToday.addEventListener("click", async () => {
  currentRange = "today";
  setActiveButton("today");
  await fetchFreeBusy("today");
});

btnWeek.addEventListener("click", async () => {
  currentRange = "week";
  setActiveButton("week");
  await fetchFreeBusy("week");
});

btnCustom.addEventListener("click", () => {
  currentRange = "custom";
  setActiveButton("custom");
  showCustomPicker();
});

// ── Fetch free/busy data ───────────────────────────────────────────────────
async function fetchFreeBusy(range: "today" | "week" | { timeMin: string; timeMax: string }) {
  showLoading();
  try {
    const now = new Date();
    let timeMin: string;
    let timeMax: string;
    if (range === "today") {
      timeMin = startOfDay(now);
      timeMax = endOfDay(now);
    } else if (range === "week") {
      const dayOfWeek = now.getDay();
      const weekStart = addDays(now, -dayOfWeek);
      const weekEnd = addDays(weekStart, 6);
      timeMin = startOfDay(weekStart);
      timeMax = endOfDay(weekEnd);
    } else {
      timeMin = range.timeMin;
      timeMax = range.timeMax;
    }
    const data = await getFreeBusy(app, { timeMin, timeMax });
    lastData = data;
    renderView(data);
  } catch (err: any) {
    showError(err.message || "Failed to fetch availability data");
  }
}

// ── Custom date picker ─────────────────────────────────────────────────────
function showCustomPicker() {
  const now = new Date();
  const startVal = toISODate(now);
  const endVal = toISODate(addDays(now, 6));
  contentEl.innerHTML = `
    <div style="padding: 32px 0; text-align: center;">
      <div style="display: inline-flex; gap: 12px; align-items: center;">
        <label style="font-size: 13px; color: #70757a; font-family: 'Google Sans', Roboto, Arial, sans-serif;">From</label>
        <input type="date" id="customStart" value="${startVal}"
          style="padding: 8px 12px; border: 1px solid #dadce0; border-radius: 4px; font-size: 13px; font-family: 'Google Sans', Roboto, Arial, sans-serif; color: #3c4043; outline: none;" />
        <label style="font-size: 13px; color: #70757a; font-family: 'Google Sans', Roboto, Arial, sans-serif;">To</label>
        <input type="date" id="customEnd" value="${endVal}"
          style="padding: 8px 12px; border: 1px solid #dadce0; border-radius: 4px; font-size: 13px; font-family: 'Google Sans', Roboto, Arial, sans-serif; color: #3c4043; outline: none;" />
        <button id="customGoBtn"
          style="padding: 8px 20px; background: #1a73e8; color: #fff; border: none; border-radius: 100px; cursor: pointer; font-size: 13px; font-family: 'Google Sans', Roboto, Arial, sans-serif; font-weight: 500; letter-spacing: 0.25px;">
          Go
        </button>
      </div>
    </div>
  `;
  document.getElementById("customGoBtn")!.addEventListener("click", () => {
    const s = (document.getElementById("customStart") as HTMLInputElement).value;
    const e = (document.getElementById("customEnd") as HTMLInputElement).value;
    if (!s || !e) return;
    const timeMin = startOfDay(new Date(s + "T00:00:00"));
    const timeMax = endOfDay(new Date(e + "T00:00:00"));
    fetchFreeBusy({ timeMin, timeMax });
  });
}

// ── Loading / Error states ─────────────────────────────────────────────────
function showLoading() {
  contentEl.innerHTML = `
    <div class="loading">
      <div class="loading-spinner"></div>
      Loading availability...
    </div>
  `;
}

function showError(msg: string) {
  contentEl.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">!</div>
      <div>${msg}</div>
    </div>
  `;
}

// ── Render the availability view ───────────────────────────────────────────
function renderView(data: FreeBusyResult) {
  const timeMin = new Date(data.timeMin);
  const timeMax = new Date(data.timeMax);
  const totalMs = timeMax.getTime() - timeMin.getTime();

  // Determine the visible hour range
  const startHour = Math.max(0, Math.floor(getHourFraction(data.timeMin)));
  const endHour = Math.min(24, Math.ceil(getHourFraction(data.timeMax)));

  // Use a reasonable display range for multi-day spans
  const spanDays = totalMs / (1000 * 60 * 60 * 24);
  const isMultiDay = spanDays > 1.5;

  // Update date range display
  if (isMultiDay) {
    dateRangeEl.textContent = `${formatDateShort(data.timeMin)} - ${formatDateShort(data.timeMax)}`;
  } else {
    const label = getRelativeDateLabel(data.timeMin);
    dateRangeEl.textContent = label === "Today" || label === "Tomorrow"
      ? `${label}, ${formatDateShort(data.timeMin)}`
      : formatDateShort(data.timeMin);
  }

  const calendarIds = Object.keys(data.calendars);
  if (calendarIds.length === 0) {
    contentEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">&#128197;</div>
        <div>No calendar data available</div>
      </div>
    `;
    return;
  }

  // Determine hour marks for the time header
  let hourMarks: { label: string; pct: number }[];
  if (isMultiDay) {
    // For multi-day, show day boundaries
    hourMarks = [];
    const cursor = new Date(timeMin);
    cursor.setHours(0, 0, 0, 0);
    if (cursor < timeMin) cursor.setDate(cursor.getDate() + 1);
    while (cursor < timeMax) {
      const pct = ((cursor.getTime() - timeMin.getTime()) / totalMs) * 100;
      hourMarks.push({
        label: cursor.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
        pct,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  } else {
    // Single day: show hours from 6am-10pm (or the range from data)
    const dispStart = Math.max(6, startHour);
    const dispEnd = Math.min(22, Math.max(endHour, 20));
    hourMarks = [];
    for (let h = dispStart; h <= dispEnd; h++) {
      const dt = new Date(timeMin);
      dt.setHours(h, 0, 0, 0);
      if (dt < timeMin || dt > timeMax) continue;
      const pct = ((dt.getTime() - timeMin.getTime()) / totalMs) * 100;
      const label = h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;
      hourMarks.push({ label, pct });
    }
  }

  // Build time header
  let timeHeaderHtml = '<div class="time-header">';
  for (const mark of hourMarks) {
    timeHeaderHtml += `<span class="time-mark" style="left: ${mark.pct}%">${mark.label}</span>`;
  }
  timeHeaderHtml += "</div>";

  // Build grid lines (vertical dashed lines at hour marks)
  let gridLinesHtml = '<div class="grid-lines">';
  for (const mark of hourMarks) {
    gridLinesHtml += `<div class="grid-line" style="left: ${mark.pct}%"></div>`;
  }
  gridLinesHtml += "</div>";

  // Build calendar rows
  let rowsHtml = "";
  for (const calId of calendarIds) {
    const cal = data.calendars[calId];
    const displayName = prettifyCalendarId(calId);
    let busyBlocksHtml = "";

    for (const busy of cal.busy) {
      const busyStart = new Date(busy.start);
      const busyEnd = new Date(busy.end);
      const clampedStart = Math.max(busyStart.getTime(), timeMin.getTime());
      const clampedEnd = Math.min(busyEnd.getTime(), timeMax.getTime());
      if (clampedEnd <= clampedStart) continue;
      const leftPct = ((clampedStart - timeMin.getTime()) / totalMs) * 100;
      const widthPct = ((clampedEnd - clampedStart) / totalMs) * 100;
      const tooltipText = `${formatTime(busy.start)} - ${formatTime(busy.end)}`;

      busyBlocksHtml += `
        <div class="busy-block" style="left: ${leftPct}%; width: ${widthPct}%;">
          <span class="busy-tooltip">${tooltipText}</span>
        </div>
      `;
    }

    rowsHtml += `
      <div class="calendar-row">
        <div class="calendar-label" title="${escapeHtml(calId)}">${escapeHtml(displayName)}</div>
        <div class="timeline-bar">${busyBlocksHtml}</div>
      </div>
    `;
  }

  // Compute common free slots
  const freeSlots = computeCommonFreeSlots(data, timeMin, timeMax);
  let commonHtml = "";
  if (freeSlots.length > 0) {
    let freeBlocksHtml = "";
    for (const slot of freeSlots) {
      const leftPct = ((slot.start.getTime() - timeMin.getTime()) / totalMs) * 100;
      const widthPct = ((slot.end.getTime() - slot.start.getTime()) / totalMs) * 100;
      const tooltipText = `${formatTime(slot.start.toISOString())} - ${formatTime(slot.end.toISOString())}`;
      freeBlocksHtml += `
        <div class="free-block" style="left: ${leftPct}%; width: ${widthPct}%;">
          <span class="free-tooltip">${tooltipText}</span>
        </div>
      `;
    }

    const chipsHtml = freeSlots.map((s) => {
      const duration = Math.round((s.end.getTime() - s.start.getTime()) / 60000);
      const durLabel = duration >= 60 ? `${Math.floor(duration / 60)}h${duration % 60 > 0 ? ` ${duration % 60}m` : ""}` : `${duration}m`;
      return `<span class="common-slot-chip">${formatTime(s.start.toISOString())} - ${formatTime(s.end.toISOString())} (${durLabel})</span>`;
    }).join("");

    commonHtml = `
      <div class="common-section">
        <div class="common-section-title">Common Free Slots</div>
        <div class="common-row">
          <div class="common-label">Free</div>
          <div class="common-bar">${freeBlocksHtml}</div>
        </div>
        <div class="common-slots-list">${chipsHtml}</div>
      </div>
    `;
  } else if (calendarIds.length > 1) {
    commonHtml = `
      <div class="common-section">
        <div class="common-section-title">Common Free Slots</div>
        <div style="font-size: 13px; color: #70757a;">No common free time found in this range.</div>
      </div>
    `;
  }

  // Legend
  const legendHtml = `
    <div class="legend">
      <div class="legend-item">
        <div class="legend-swatch" style="background: #e6f4ea; border: 1px solid #0b8043;"></div>
        Free
      </div>
      <div class="legend-item">
        <div class="legend-swatch" style="background: rgba(26, 115, 232, 0.7);"></div>
        Busy
      </div>
    </div>
  `;

  contentEl.innerHTML = `
    <div class="timeline-container">
      ${timeHeaderHtml}
      <div class="calendar-rows" style="position: relative;">
        ${gridLinesHtml}
        ${rowsHtml}
      </div>
    </div>
    ${commonHtml}
    ${legendHtml}
  `;
}

// ── Compute common free slots ──────────────────────────────────────────────
interface TimeSlot {
  start: Date;
  end: Date;
}

function computeCommonFreeSlots(data: FreeBusyResult, timeMin: Date, timeMax: Date): TimeSlot[] {
  const calendarIds = Object.keys(data.calendars);
  if (calendarIds.length === 0) return [];

  // Merge all busy periods across all calendars
  const allBusy: TimeSlot[] = [];
  for (const calId of calendarIds) {
    for (const busy of data.calendars[calId].busy) {
      allBusy.push({
        start: new Date(busy.start),
        end: new Date(busy.end),
      });
    }
  }

  // Sort by start time
  allBusy.sort((a, b) => a.start.getTime() - b.start.getTime());

  // Merge overlapping busy periods
  const merged: TimeSlot[] = [];
  for (const slot of allBusy) {
    if (merged.length === 0 || slot.start.getTime() > merged[merged.length - 1].end.getTime()) {
      merged.push({ start: new Date(slot.start), end: new Date(slot.end) });
    } else {
      const last = merged[merged.length - 1];
      if (slot.end.getTime() > last.end.getTime()) {
        last.end = new Date(slot.end);
      }
    }
  }

  // Invert to get free slots
  const freeSlots: TimeSlot[] = [];
  let cursor = timeMin.getTime();

  for (const busy of merged) {
    const busyStart = Math.max(busy.start.getTime(), timeMin.getTime());
    const busyEnd = Math.min(busy.end.getTime(), timeMax.getTime());

    if (cursor < busyStart) {
      freeSlots.push({ start: new Date(cursor), end: new Date(busyStart) });
    }
    cursor = Math.max(cursor, busyEnd);
  }

  if (cursor < timeMax.getTime()) {
    freeSlots.push({ start: new Date(cursor), end: new Date(timeMax) });
  }

  // Filter out very short slots (less than 15 minutes)
  return freeSlots.filter((s) => s.end.getTime() - s.start.getTime() >= 15 * 60 * 1000);
}

// ── Utilities ──────────────────────────────────────────────────────────────
function prettifyCalendarId(calId: string): string {
  // Turn calendar IDs like "user@example.com" into a readable name
  if (calId.includes("@")) {
    const local = calId.split("@")[0];
    // Capitalize and replace dots/underscores
    return local
      .replace(/[._]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return calId;
}

function escapeHtml(text: string): string {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
}

// ── MCP tool result handler ────────────────────────────────────────────────
app.ontoolresult = (result: any) => {
  try {
    const data = parseToolResult<FreeBusyResult>(result);
    lastData = data;
    renderView(data);
  } catch (err: any) {
    // Auto-fetch today's availability
    fetchToday();
  }
};

async function fetchToday(): Promise<void> {
  try {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const data = await getFreeBusy(app, {
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
    });
    lastData = data;
    renderView(data);
  } catch (err) {
    showError("Failed to fetch availability");
  }
}

// Auto-fetch if no data arrives from host
setTimeout(() => {
  if (!lastData) fetchToday();
}, 1500);
