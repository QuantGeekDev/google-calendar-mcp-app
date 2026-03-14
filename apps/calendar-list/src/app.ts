import { createGCalApp, parseToolResult, listCalendars, CalendarInfo } from "../../shared/gcal-app";
import { escapeHtml, renderBadge, renderColorSwatch, renderSpinner, renderEmptyState, SHARED_COMPONENT_CSS } from "../../shared/components";

// Inject shared CSS
const styleEl = document.createElement("style");
styleEl.textContent = SHARED_COMPONENT_CSS;
document.head.appendChild(styleEl);

const appEl = document.getElementById("app")!;

interface CalendarListResult {
  calendars: CalendarInfo[];
  totalCount: number;
}

function getRoleBadge(role: string | undefined): string {
  switch (role) {
    case "owner":
      return renderBadge("Owner", "success");
    case "writer":
      return renderBadge("Writer", "info");
    case "reader":
      return renderBadge("Reader", "neutral");
    case "freeBusyReader":
      return renderBadge("FreeBusy", "neutral");
    default:
      return role ? renderBadge(role, "neutral") : "";
  }
}

function renderCalendarItem(cal: CalendarInfo): string {
  const name = escapeHtml(cal.summary || cal.id);
  const color = cal.backgroundColor || "#039be5";
  const swatch = renderColorSwatch(color, 14);
  const roleBadge = getRoleBadge(cal.accessRole);
  const starHtml = cal.primary ? `<span class="cl-star" title="Primary calendar">&#9733;</span>` : "";

  return `
    <div class="gc-list-item">
      ${swatch}
      <div style="flex:1; min-width:0; display:flex; align-items:center; gap:6px;">
        <div style="flex:1; min-width:0;">
          <div style="font-size:14px; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${name}
          </div>
          ${cal.id !== cal.summary ? `<div style="font-size:12px; color:var(--text-secondary); margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(cal.id)}</div>` : ""}
        </div>
        ${starHtml}
      </div>
      ${roleBadge}
    </div>
  `;
}

function groupByAccount(calendars: CalendarInfo[]): Map<string, CalendarInfo[]> {
  const groups = new Map<string, CalendarInfo[]>();
  for (const cal of calendars) {
    // Use accountId or derive account from calendar ID (email portion)
    const account = (cal as any).accountAccess || (cal as any).accountId || extractAccount(cal.id);
    const list = groups.get(account) || [];
    list.push(cal);
    groups.set(account, list);
  }
  return groups;
}

function extractAccount(calId: string): string {
  // Calendar IDs that look like emails indicate the account
  if (calId.includes("@")) {
    return calId;
  }
  return "default";
}

function render(data: CalendarListResult): void {
  const count = data.totalCount || data.calendars.length;
  const groups = groupByAccount(data.calendars);
  const multiAccount = groups.size > 1;

  let html = `
    <div class="cl-header">
      <h1>Calendars</h1>
      <span class="cl-count-badge">${count}</span>
    </div>
  `;

  if (data.calendars.length === 0) {
    html += renderEmptyState("No calendars found", "📅");
    appEl.innerHTML = html;
    return;
  }

  if (multiAccount) {
    for (const [account, calendars] of groups) {
      html += `<div class="cl-group-header">${escapeHtml(account)}</div>`;
      for (const cal of calendars) {
        html += renderCalendarItem(cal);
      }
    }
  } else {
    for (const cal of data.calendars) {
      html += renderCalendarItem(cal);
    }
  }

  appEl.innerHTML = html;
}

function showLoading(): void {
  appEl.innerHTML = `
    <div class="cl-header">
      <h1>Calendars</h1>
    </div>
    ${renderSpinner("Loading calendars...")}
  `;
}

async function autoFetch(): Promise<void> {
  showLoading();
  try {
    const data = await listCalendars(app);
    render(data);
  } catch (err) {
    appEl.innerHTML = `
      <div class="cl-header">
        <h1>Calendars</h1>
      </div>
      ${renderEmptyState("Failed to load calendars", "⚠️")}
    `;
  }
}

const app = createGCalApp("Calendar List");

app.ontoolresult = (result: any) => {
  try {
    const data = parseToolResult<CalendarListResult>(result);
    render(data);
  } catch {
    autoFetch();
  }
};

autoFetch();
