import { createGCalApp, parseToolResult, GCalEvent } from "../../shared/gcal-app";
import { escapeHtml, renderEventCard, renderBadge, renderButton, showToast, SHARED_COMPONENT_CSS } from "../../shared/components";
import { formatTime, formatTimeRange, formatDate, isAllDay, getEventDateTime } from "../../shared/time-utils";

// ── Inject shared component CSS ───────────────────────────────────────────
const styleEl = document.createElement("style");
styleEl.textContent = SHARED_COMPONENT_CSS + `
  .rsvp-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: calc(100vh - 32px);
    gap: 16px;
    max-width: 480px;
    margin: 0 auto;
  }

  .rsvp-card {
    background: var(--card-bg);
    border-radius: 12px;
    box-shadow: var(--shadow-md);
    padding: 32px 28px;
    width: 100%;
    text-align: center;
  }

  .rsvp-icon {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px;
    font-size: 28px;
    font-weight: 700;
    animation: rsvp-scale-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    transform: scale(0);
  }

  .rsvp-icon--accepted {
    background: var(--green-light);
    color: var(--green);
  }

  .rsvp-icon--declined {
    background: var(--red-light);
    color: var(--red);
  }

  .rsvp-icon--tentative {
    background: #fef7e0;
    color: var(--yellow);
  }

  .rsvp-response-text {
    font-size: 18px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  .rsvp-event-title {
    font-size: 15px;
    color: var(--text-secondary);
    margin-bottom: 4px;
    word-break: break-word;
  }

  .rsvp-event-time {
    font-size: 13px;
    color: var(--text-secondary);
    margin-bottom: 12px;
  }

  .rsvp-updates {
    font-size: 12px;
    color: var(--text-secondary);
    padding-top: 12px;
    border-top: 1px solid var(--border-light);
  }

  .rsvp-message {
    font-size: 13px;
    color: var(--text-secondary);
    margin-top: 12px;
    line-height: 1.5;
  }

  .rsvp-summary-card {
    background: var(--card-bg);
    border-radius: 12px;
    box-shadow: var(--shadow-sm);
    width: 100%;
    overflow: hidden;
  }

  .rsvp-summary-header {
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-secondary);
    padding: 12px 16px 8px;
  }

  .rsvp-attendee-count {
    font-size: 12px;
    color: var(--text-secondary);
    padding: 8px 16px 12px;
    border-top: 1px solid var(--border-light);
  }

  .rsvp-error {
    background: var(--card-bg);
    border-radius: 12px;
    box-shadow: var(--shadow-md);
    padding: 32px 28px;
    width: 100%;
    max-width: 400px;
    text-align: center;
    border-top: 3px solid var(--red);
  }

  .rsvp-error-icon {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px;
    font-size: 28px;
    font-weight: 700;
    background: var(--red-light);
    color: var(--red);
  }

  .rsvp-error-heading {
    font-size: 18px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 8px;
  }

  .rsvp-error-message {
    font-size: 14px;
    color: var(--text-secondary);
  }

  @keyframes rsvp-scale-in {
    0% { transform: scale(0); }
    100% { transform: scale(1); }
  }
`;
document.head.appendChild(styleEl);

// ── Types ─────────────────────────────────────────────────────────────────

interface RsvpResult {
  event: GCalEvent;
  responseStatus: string;
  sendUpdates: string;
  message: string;
}

// ── DOM ───────────────────────────────────────────────────────────────────

const appEl = document.getElementById("app") as HTMLDivElement;

// ── Helpers ───────────────────────────────────────────────────────────────

function getResponseIcon(status: string): { icon: string; cssClass: string } {
  switch (status) {
    case "accepted":
      return { icon: "\u2713", cssClass: "rsvp-icon--accepted" };
    case "declined":
      return { icon: "\u2717", cssClass: "rsvp-icon--declined" };
    case "tentative":
      return { icon: "?", cssClass: "rsvp-icon--tentative" };
    default:
      return { icon: "\u2713", cssClass: "rsvp-icon--accepted" };
  }
}

function getResponseText(status: string): string {
  switch (status) {
    case "accepted":
      return "You accepted";
    case "declined":
      return "You declined";
    case "tentative":
      return "You responded tentatively";
    default:
      return "Response sent";
  }
}

function formatSendUpdates(value: string): string {
  switch (value) {
    case "all":
      return "all attendees";
    case "externalOnly":
      return "external attendees";
    case "none":
      return "no one";
    default:
      return value;
  }
}

// ── Render functions ──────────────────────────────────────────────────────

function renderRsvpConfirmation(data: RsvpResult): string {
  const { icon, cssClass } = getResponseIcon(data.responseStatus);
  const responseText = getResponseText(data.responseStatus);
  const event = data.event;

  // Event time
  const { start, end } = getEventDateTime(event);
  const allDay = isAllDay(event);
  const timeStr = allDay ? "All day" : formatTimeRange(start, end);
  const dateStr = formatDate(start);
  const eventTitle = event.summary || "(No title)";

  // Updates sent line
  const updatesHtml = data.sendUpdates
    ? `<div class="rsvp-updates">Updates sent to: ${escapeHtml(formatSendUpdates(data.sendUpdates))}</div>`
    : "";

  // Message from response
  const messageHtml = data.message
    ? `<div class="rsvp-message">${escapeHtml(data.message)}</div>`
    : "";

  // Attendee count
  const attendeeCount = event.attendees ? event.attendees.length : 0;
  const attendeeHtml = attendeeCount > 0
    ? `<div class="rsvp-attendee-count">${attendeeCount} attendee${attendeeCount !== 1 ? "s" : ""}</div>`
    : "";

  // Event summary card using renderEventCard
  const eventCardHtml = renderEventCard(event, {
    showDate: true,
    showLocation: true,
    compact: false,
  });

  return `
    <div class="rsvp-container">
      <div class="rsvp-card">
        <div class="rsvp-icon ${cssClass}">${icon}</div>
        <div class="rsvp-response-text">${escapeHtml(responseText)}</div>
        <div class="rsvp-event-title">${escapeHtml(eventTitle)}</div>
        <div class="rsvp-event-time">${escapeHtml(dateStr)} &middot; ${escapeHtml(timeStr)}</div>
        ${updatesHtml}
        ${messageHtml}
      </div>

      <div class="rsvp-summary-card">
        <div class="rsvp-summary-header">Event details</div>
        ${eventCardHtml}
        ${attendeeHtml}
      </div>
    </div>
  `;
}

function renderError(message: string): string {
  return `
    <div class="rsvp-container">
      <div class="rsvp-error">
        <div class="rsvp-error-icon">\u2717</div>
        <div class="rsvp-error-heading">No RSVP data</div>
        <div class="rsvp-error-message">${escapeHtml(message)}</div>
      </div>
    </div>
  `;
}

// ── App Init ──────────────────────────────────────────────────────────────

const app = createGCalApp("RSVP Confirmation");

app.ontoolresult = (result: any) => {
  try {
    const data = parseToolResult<RsvpResult>(result);

    if (data && data.event) {
      appEl.innerHTML = renderRsvpConfirmation(data);
    } else {
      appEl.innerHTML = renderError("No RSVP data received");
    }
  } catch {
    appEl.innerHTML = renderError("No RSVP data received");
  }
};
