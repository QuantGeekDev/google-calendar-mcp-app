import { App } from "@modelcontextprotocol/ext-apps";
import {
  createGCalApp,
  parseToolResult,
  getEventColor,
  GCalEvent,
} from "../../shared/gcal-app";
import {
  escapeHtml,
  renderBadge,
  renderEmptyState,
  renderColorSwatch,
  SHARED_COMPONENT_CSS,
} from "../../shared/components";
import {
  formatTimeRange,
  formatDateShort,
  isAllDay,
  getEventDateTime,
} from "../../shared/time-utils";

// ── Types ───────────────────────────────────────────────────────────────────

interface FailedEvent {
  index: number;
  summary: string;
  error: string;
}

interface BulkCreateResponse {
  totalRequested: number;
  totalCreated: number;
  totalFailed: number;
  created: GCalEvent[];
  failed?: FailedEvent[];
}

// ── State ───────────────────────────────────────────────────────────────────

const app: App = createGCalApp("Bulk Create Events");
const appEl = document.getElementById("app")!;
let createdExpanded = true;

// ── Inject shared CSS ───────────────────────────────────────────────────────

const sharedStyle = document.createElement("style");
sharedStyle.textContent = SHARED_COMPONENT_CSS;
document.head.appendChild(sharedStyle);

// Inject app-specific CSS
const appStyle = document.createElement("style");
appStyle.textContent = `
  .bc-header {
    padding: 0 0 14px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 0;
  }
  .bc-header h1 {
    font-size: 18px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 12px;
  }
  .bc-progress-bar {
    width: 100%;
    height: 8px;
    background: var(--bg-active);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 12px;
  }
  .bc-progress-fill {
    height: 100%;
    background: var(--green);
    border-radius: 4px;
    transition: width 0.4s ease;
  }
  .bc-stats {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .bc-section {
    margin-top: 0;
  }
  .bc-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0 8px;
    cursor: pointer;
    user-select: none;
  }
  .bc-section-header:hover {
    opacity: 0.8;
  }
  .bc-section-title {
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-secondary);
  }
  .bc-section-toggle {
    font-size: 12px;
    color: var(--text-secondary);
    transition: transform 0.2s;
  }
  .bc-section-toggle.collapsed {
    transform: rotate(-90deg);
  }
  .bc-event-list {
    border-top: 1px solid var(--border);
  }
  .bc-event-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    transition: background 0.15s;
  }
  .bc-event-item:hover {
    background: var(--bg-hover);
  }
  .bc-event-info {
    flex: 1;
    min-width: 0;
  }
  .bc-event-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .bc-event-time {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 1px;
  }
  .bc-failed-section {
    margin-top: 4px;
  }
  .bc-failed-header {
    padding: 12px 0 8px;
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--red);
    border-bottom: 1px solid var(--border);
  }
  .bc-failed-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--red-light);
  }
  .bc-failed-index {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--red);
    color: #fff;
    font-size: 11px;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .bc-failed-info {
    flex: 1;
    min-width: 0;
  }
  .bc-failed-summary {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .bc-failed-error {
    font-size: 12px;
    color: var(--red);
    margin-top: 2px;
    line-height: 1.4;
  }
`;
document.head.appendChild(appStyle);

// ── Render ──────────────────────────────────────────────────────────────────

function renderBulkCreate(data: BulkCreateResponse): void {
  const successRate = data.totalRequested > 0
    ? (data.totalCreated / data.totalRequested) * 100
    : 0;

  let html = `
    <div class="bc-header">
      <h1>Created ${data.totalCreated} of ${data.totalRequested} event${data.totalRequested !== 1 ? "s" : ""}</h1>
      <div class="bc-progress-bar">
        <div class="bc-progress-fill" style="width: ${successRate}%;"></div>
      </div>
      <div class="bc-stats">
        ${renderBadge(`${data.totalCreated} created`, "success")}
        ${data.totalFailed > 0 ? renderBadge(`${data.totalFailed} failed`, "error") : ""}
      </div>
    </div>
  `;

  // Created events section
  if (data.created.length > 0) {
    html += `
      <div class="bc-section">
        <div class="bc-section-header" id="createdToggle">
          <span class="bc-section-title">Created Events (${data.created.length})</span>
          <span class="bc-section-toggle ${createdExpanded ? "" : "collapsed"}">&#9660;</span>
        </div>
        <div class="bc-event-list" id="createdList" style="display:${createdExpanded ? "block" : "none"};">
    `;

    for (const event of data.created) {
      const color = getEventColor(event);
      const { start, end } = getEventDateTime(event);
      const allDay = isAllDay(event);
      const timeStr = allDay
        ? `${formatDateShort(start)} (All day)`
        : `${formatDateShort(start)} ${formatTimeRange(start, end)}`;
      const title = event.summary || "(No title)";

      html += `
        <div class="bc-event-item">
          ${renderColorSwatch(color, 12)}
          <div class="bc-event-info">
            <div class="bc-event-title">${escapeHtml(title)}</div>
            <div class="bc-event-time">${escapeHtml(timeStr)}</div>
          </div>
        </div>
      `;
    }

    html += `</div></div>`;
  }

  // Failed events section
  if (data.failed && data.failed.length > 0) {
    html += `
      <div class="bc-failed-section">
        <div class="bc-failed-header">Failed Events (${data.failed.length})</div>
    `;

    for (const failure of data.failed) {
      html += `
        <div class="bc-failed-item">
          <div class="bc-failed-index">${failure.index}</div>
          <div class="bc-failed-info">
            <div class="bc-failed-summary">${escapeHtml(failure.summary || "(No title)")}</div>
            <div class="bc-failed-error">${escapeHtml(failure.error)}</div>
          </div>
        </div>
      `;
    }

    html += `</div>`;
  }

  appEl.innerHTML = html;

  // Attach toggle listener for created events section
  const toggleEl = document.getElementById("createdToggle");
  const listEl = document.getElementById("createdList");
  if (toggleEl && listEl) {
    toggleEl.addEventListener("click", () => {
      createdExpanded = !createdExpanded;
      listEl.style.display = createdExpanded ? "block" : "none";
      const arrow = toggleEl.querySelector(".bc-section-toggle");
      if (arrow) {
        arrow.classList.toggle("collapsed", !createdExpanded);
      }
    });
  }
}

// ── Tool Result Handler ─────────────────────────────────────────────────────

app.ontoolresult = (result: any) => {
  try {
    const data = parseToolResult<BulkCreateResponse>(result);

    // Validate it looks like a bulk create response
    if (
      typeof data.totalRequested === "number" &&
      typeof data.totalCreated === "number" &&
      Array.isArray(data.created)
    ) {
      renderBulkCreate(data);
      return;
    }

    // Unknown response shape
    showEmptyState();
  } catch {
    showEmptyState();
  }
};

function showEmptyState(): void {
  appEl.innerHTML = renderEmptyState("No creation data", "📋");
}
