import { createGCalApp, parseToolResult, GCalEvent } from "../../shared/gcal-app";
import { escapeHtml, renderEventCard, renderBadge, renderButton, showToast, SHARED_COMPONENT_CSS } from "../../shared/components";
import { formatTime, formatTimeRange, formatDate, isAllDay, getEventDateTime } from "../../shared/time-utils";

// ── Inject shared component CSS ───────────────────────────────────────────
const styleEl = document.createElement("style");
styleEl.textContent = SHARED_COMPONENT_CSS + `
  .dc-container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: calc(100vh - 32px);
  }

  .dc-card {
    background: var(--card-bg);
    border-radius: 12px;
    box-shadow: var(--shadow-md);
    padding: 40px 32px;
    max-width: 400px;
    width: 100%;
    text-align: center;
  }

  .dc-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 20px;
    font-size: 32px;
    font-weight: 700;
    animation: dc-scale-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    transform: scale(0);
  }

  .dc-icon--success {
    background: var(--green-light);
    color: var(--green);
  }

  .dc-icon--error {
    background: var(--red-light);
    color: var(--red);
  }

  .dc-heading {
    font-size: 20px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 8px;
  }

  .dc-event-id {
    font-size: 12px;
    color: var(--text-secondary);
    word-break: break-all;
    margin-bottom: 8px;
    font-family: 'Roboto Mono', monospace;
    opacity: 0.7;
  }

  .dc-message {
    font-size: 14px;
    color: var(--text-secondary);
    margin-top: 12px;
    line-height: 1.5;
  }

  .dc-card--success {
    border-top: 3px solid var(--green);
  }

  .dc-card--error {
    border-top: 3px solid var(--red);
  }

  @keyframes dc-scale-in {
    0% { transform: scale(0); }
    100% { transform: scale(1); }
  }
`;
document.head.appendChild(styleEl);

// ── Types ─────────────────────────────────────────────────────────────────

interface DeleteResult {
  success: boolean;
  eventId: string;
  calendarId: string;
  message?: string;
}

// ── DOM ───────────────────────────────────────────────────────────────────

const appEl = document.getElementById("app") as HTMLDivElement;

// ── Render functions ──────────────────────────────────────────────────────

function renderSuccess(data: DeleteResult): string {
  const eventIdHtml = data.eventId
    ? `<div class="dc-event-id">${escapeHtml(data.eventId)}</div>`
    : "";

  const messageHtml = data.message
    ? `<div class="dc-message">${escapeHtml(data.message)}</div>`
    : "";

  return `
    <div class="dc-container">
      <div class="dc-card dc-card--success">
        <div class="dc-icon dc-icon--success">\u2713</div>
        <div class="dc-heading">Event deleted</div>
        ${eventIdHtml}
        ${messageHtml}
      </div>
    </div>
  `;
}

function renderError(message: string, eventId?: string): string {
  const eventIdHtml = eventId
    ? `<div class="dc-event-id">${escapeHtml(eventId)}</div>`
    : "";

  return `
    <div class="dc-container">
      <div class="dc-card dc-card--error">
        <div class="dc-icon dc-icon--error">\u2717</div>
        <div class="dc-heading">Failed to delete event</div>
        ${eventIdHtml}
        <div class="dc-message">${escapeHtml(message)}</div>
      </div>
    </div>
  `;
}

// ── App Init ──────────────────────────────────────────────────────────────

const app = createGCalApp("Delete Confirmation");

app.ontoolresult = (result: any) => {
  try {
    const data = parseToolResult<DeleteResult>(result);

    if (data && data.success) {
      appEl.innerHTML = renderSuccess(data);
    } else {
      const msg = data?.message || "The event could not be deleted.";
      appEl.innerHTML = renderError(msg, data?.eventId);
    }
  } catch {
    appEl.innerHTML = renderError("No deletion data received");
  }
};
