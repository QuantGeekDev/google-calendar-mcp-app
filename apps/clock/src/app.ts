import { createGCalApp, parseToolResult } from "../../shared/gcal-app";
import { escapeHtml, renderBadge, renderSpinner, renderEmptyState, SHARED_COMPONENT_CSS } from "../../shared/components";

// Inject shared CSS
const styleEl = document.createElement("style");
styleEl.textContent = SHARED_COMPONENT_CSS;
document.head.appendChild(styleEl);

const appEl = document.getElementById("app")!;

interface CurrentTimeResult {
  currentTime: string;
  timezone: string;
  offset: string;
  isDST?: boolean;
  dayOfWeek: string;
}

let clockInterval: ReturnType<typeof setInterval> | null = null;
let currentTimezone: string | null = null;
let currentOffset: string | null = null;
let currentIsDST: boolean | undefined = undefined;

function getTimezoneAbbreviation(timezone: string, date: Date): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    return tzPart?.value || "";
  } catch {
    return "";
  }
}

function formatClockTime(timezone: string): string {
  const now = new Date();
  try {
    return now.toLocaleTimeString("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }
}

function formatClockDate(timezone: string): string {
  const now = new Date();
  try {
    return now.toLocaleDateString("en-US", {
      timeZone: timezone,
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
}

function formatOffsetDisplay(offset: string): string {
  if (offset === "Z") return "UTC+00:00";
  return `UTC${offset}`;
}

function updateClockDisplay(): void {
  if (!currentTimezone) return;

  const timeEl = document.getElementById("ck-time");
  const dateEl = document.getElementById("ck-date");

  if (timeEl) {
    timeEl.textContent = formatClockTime(currentTimezone);
  }
  if (dateEl) {
    dateEl.textContent = formatClockDate(currentTimezone);
  }
}

function render(data: CurrentTimeResult): void {
  // Stop previous interval
  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
  }

  currentTimezone = data.timezone;
  currentOffset = data.offset;
  currentIsDST = data.isDST;

  const now = new Date();
  const timeDisplay = formatClockTime(data.timezone);
  const dateDisplay = formatClockDate(data.timezone);
  const abbrev = getTimezoneAbbreviation(data.timezone, now);
  const offsetDisplay = formatOffsetDisplay(data.offset);
  const tzInfo = abbrev ? `${abbrev}, ${offsetDisplay}` : offsetDisplay;

  const dstBadge = data.isDST
    ? renderBadge("DST Active", "success")
    : renderBadge("Standard Time", "neutral");

  appEl.innerHTML = `
    <div class="ck-card">
      <div class="ck-time" id="ck-time">${escapeHtml(timeDisplay)}</div>
      <div class="ck-date" id="ck-date">${escapeHtml(dateDisplay)}</div>
      <div class="ck-divider"></div>
      <div class="ck-tz-name">${escapeHtml(data.timezone)}</div>
      <div class="ck-tz-detail">${escapeHtml(tzInfo)}</div>
      <div class="ck-dst">${dstBadge}</div>
    </div>
  `;

  // Start auto-updating clock every second
  clockInterval = setInterval(updateClockDisplay, 1000);
}

function showLoading(): void {
  appEl.innerHTML = `
    <div class="ck-card">
      ${renderSpinner("Loading time...")}
    </div>
  `;
}

async function autoFetch(): Promise<void> {
  showLoading();
  try {
    const result = await app.callServerTool({ name: "get-current-time", arguments: {} });
    const data = parseToolResult<CurrentTimeResult>(result);
    render(data);
  } catch (err) {
    appEl.innerHTML = `
      <div class="ck-card">
        ${renderEmptyState("Failed to load time", "⏰")}
      </div>
    `;
  }
}

const app = createGCalApp("Clock");

app.ontoolresult = (result: any) => {
  try {
    const data = parseToolResult<CurrentTimeResult>(result);
    render(data);
  } catch {
    autoFetch();
  }
};

autoFetch();
