/**
 * Shared reusable UI components for gcal-mcpui MCP Apps.
 * All components return HTML strings and use CSS variables for theming.
 */

import { GCalEvent, getEventColor, getMeetingLink, EVENT_COLORS } from "./gcal-app";
import { formatTime, formatTimeRange, formatDate, formatDateShort, isAllDay, getEventDateTime, getRelativeDateLabel } from "./time-utils";

// ── Escape Helpers ─────────────────────────────────────────────────────

export function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ── Event Card ─────────────────────────────────────────────────────────

export interface EventCardOptions {
  showDate?: boolean;
  showLocation?: boolean;
  showJoinButton?: boolean;
  compact?: boolean;
  onClick?: string; // onclick handler as string
}

export function renderEventCard(event: GCalEvent, opts: EventCardOptions = {}): string {
  const { start, end } = getEventDateTime(event);
  const color = getEventColor(event);
  const allDay = isAllDay(event);
  const timeStr = allDay ? "All day" : formatTimeRange(start, end);
  const title = escapeHtml(event.summary || "(No title)");
  const meetingLink = getMeetingLink(event);
  const clickAttr = opts.onClick ? `onclick="${opts.onClick}"` : "";
  const cursorStyle = opts.onClick ? "cursor:pointer;" : "";

  let dateHtml = "";
  if (opts.showDate) {
    dateHtml = `<div class="gc-card-date">${escapeHtml(formatDateShort(start))}</div>`;
  }

  let locationHtml = "";
  if (opts.showLocation && event.location) {
    locationHtml = `<div class="gc-card-location"><span class="gc-card-loc-icon">📍</span> ${escapeHtml(event.location)}</div>`;
  }

  let joinHtml = "";
  if (opts.showJoinButton && meetingLink) {
    joinHtml = `<button class="gc-join-btn" data-url="${escapeHtml(meetingLink)}">Join</button>`;
  }

  const padding = opts.compact ? "8px 12px" : "12px 16px";

  return `
    <div class="gc-event-card" style="border-left: 4px solid ${color}; padding: ${padding}; ${cursorStyle}" ${clickAttr}>
      ${dateHtml}
      <div class="gc-card-time">${timeStr}</div>
      <div class="gc-card-title">${title}</div>
      ${locationHtml}
      ${joinHtml}
    </div>
  `;
}

// ── Attendee Chip ──────────────────────────────────────────────────────

export function renderAttendeeChip(attendee: { email: string; displayName?: string; responseStatus?: string }): string {
  const name = escapeHtml(attendee.displayName || attendee.email);
  const initial = (attendee.displayName || attendee.email).charAt(0).toUpperCase();
  const statusColor = getStatusColor(attendee.responseStatus);
  const statusIcon = getStatusIcon(attendee.responseStatus);

  return `
    <div class="gc-attendee-chip">
      <div class="gc-avatar" style="background: ${statusColor}20; color: ${statusColor};">${initial}</div>
      <div class="gc-attendee-info">
        <span class="gc-attendee-name">${name}</span>
      </div>
      <span class="gc-status-icon" style="color: ${statusColor};" title="${attendee.responseStatus || 'pending'}">${statusIcon}</span>
    </div>
  `;
}

export function getStatusColor(status?: string): string {
  switch (status) {
    case "accepted": return "var(--green, #0b8043)";
    case "declined": return "var(--red, #d93025)";
    case "tentative": return "var(--yellow, #f9ab00)";
    default: return "var(--text-secondary, #70757a)";
  }
}

export function getStatusIcon(status?: string): string {
  switch (status) {
    case "accepted": return "✓";
    case "declined": return "✗";
    case "tentative": return "?";
    default: return "·";
  }
}

// ── Color Swatch ───────────────────────────────────────────────────────

export function renderColorSwatch(color: string, size = 12, selected = false): string {
  const border = selected ? "2px solid var(--text-primary)" : "2px solid transparent";
  return `<span class="gc-color-swatch" style="
    display: inline-block;
    width: ${size}px;
    height: ${size}px;
    border-radius: 50%;
    background: ${color};
    border: ${border};
    flex-shrink: 0;
  "></span>`;
}

// ── Status Badge ───────────────────────────────────────────────────────

export type BadgeVariant = "success" | "error" | "warning" | "info" | "neutral";

export function renderBadge(text: string, variant: BadgeVariant = "neutral"): string {
  const colors: Record<BadgeVariant, { bg: string; fg: string }> = {
    success: { bg: "var(--green-light, #e6f4ea)", fg: "var(--green, #0b8043)" },
    error: { bg: "var(--red-light, #fce8e6)", fg: "var(--red, #d93025)" },
    warning: { bg: "#fef7e0", fg: "#e37400" },
    info: { bg: "var(--accent-light, #e8f0fe)", fg: "var(--accent, #1a73e8)" },
    neutral: { bg: "var(--bg-secondary, #f8f9fa)", fg: "var(--text-secondary, #70757a)" },
  };
  const c = colors[variant];
  return `<span class="gc-badge" style="
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 500;
    background: ${c.bg};
    color: ${c.fg};
    white-space: nowrap;
  ">${escapeHtml(text)}</span>`;
}

// ── Action Button ──────────────────────────────────────────────────────

export type ButtonVariant = "primary" | "secondary" | "danger" | "text";

export function renderButton(text: string, opts: { variant?: ButtonVariant; id?: string; disabled?: boolean; icon?: string } = {}): string {
  const { variant = "text", id, disabled, icon } = opts;
  const idAttr = id ? `id="${id}"` : "";
  const disAttr = disabled ? "disabled" : "";
  const iconHtml = icon ? `<span style="margin-right:4px;">${icon}</span>` : "";

  const styles: Record<ButtonVariant, string> = {
    primary: "background: var(--accent); color: #fff; border: none;",
    secondary: "background: transparent; color: var(--accent); border: 1px solid var(--border);",
    danger: "background: transparent; color: var(--red); border: none;",
    text: "background: transparent; color: var(--accent); border: none;",
  };

  return `<button class="gc-btn gc-btn-${variant}" ${idAttr} ${disAttr} style="
    font-family: var(--font-stack, 'Google Sans', Roboto, Arial, sans-serif);
    font-size: 14px;
    font-weight: 500;
    height: 36px;
    padding: 0 16px;
    border-radius: 4px;
    cursor: ${disabled ? "not-allowed" : "pointer"};
    ${styles[variant]}
    opacity: ${disabled ? "0.5" : "1"};
    transition: background 0.15s;
    display: inline-flex;
    align-items: center;
  ">${iconHtml}${escapeHtml(text)}</button>`;
}

// ── Empty State ────────────────────────────────────────────────────────

export function renderEmptyState(message: string, icon = "📅"): string {
  return `
    <div class="gc-empty-state" style="
      text-align: center;
      padding: 48px 24px;
      color: var(--text-secondary);
    ">
      <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">${icon}</div>
      <div style="font-size: 14px;">${escapeHtml(message)}</div>
    </div>
  `;
}

// ── Loading Spinner ────────────────────────────────────────────────────

export function renderSpinner(message = "Loading..."): string {
  return `
    <div class="gc-spinner-container" style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      gap: 12px;
    ">
      <div class="gc-spinner" style="
        width: 28px;
        height: 28px;
        border: 3px solid var(--border);
        border-top-color: var(--accent);
        border-radius: 50%;
        animation: gc-spin 0.8s linear infinite;
      "></div>
      <div style="font-size: 13px; color: var(--text-secondary);">${escapeHtml(message)}</div>
    </div>
  `;
}

// ── Toast / Notification ───────────────────────────────────────────────

let toastTimeout: ReturnType<typeof setTimeout> | null = null;

export function showToast(message: string, variant: BadgeVariant = "info", duration = 3000): void {
  let container = document.getElementById("gc-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "gc-toast-container";
    container.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:1000;";
    document.body.appendChild(container);
  }

  const colors: Record<BadgeVariant, { bg: string; fg: string }> = {
    success: { bg: "#0b8043", fg: "#fff" },
    error: { bg: "#d93025", fg: "#fff" },
    warning: { bg: "#e37400", fg: "#fff" },
    info: { bg: "#323232", fg: "#fff" },
    neutral: { bg: "#323232", fg: "#fff" },
  };
  const c = colors[variant];

  container.innerHTML = `<div style="
    background: ${c.bg};
    color: ${c.fg};
    padding: 10px 24px;
    border-radius: 4px;
    font-size: 14px;
    box-shadow: var(--shadow-md, 0 2px 6px rgba(0,0,0,.3));
    animation: gc-toast-in 0.2s ease-out;
    font-family: var(--font-stack, 'Google Sans', Roboto, Arial, sans-serif);
  ">${escapeHtml(message)}</div>`;

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    if (container) container.innerHTML = "";
  }, duration);
}

// ── Confirm Dialog ─────────────────────────────────────────────────────

export function showConfirmDialog(
  title: string,
  message: string,
  confirmText: string,
  onConfirm: () => void,
  opts: { variant?: ButtonVariant; cancelText?: string } = {}
): void {
  const { variant = "danger", cancelText = "Cancel" } = opts;
  const overlay = document.createElement("div");
  overlay.className = "gc-dialog-overlay";
  overlay.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.4);
    display: flex; align-items: center; justify-content: center; z-index: 1000;
  `;

  const confirmStyle = variant === "danger"
    ? "background: var(--red); color: #fff;"
    : "background: var(--accent); color: #fff;";

  overlay.innerHTML = `
    <div style="
      background: var(--bg, #fff); border-radius: 8px; padding: 24px;
      max-width: 400px; width: 90%; box-shadow: var(--shadow-md);
      font-family: var(--font-stack, 'Google Sans', Roboto, Arial, sans-serif);
    ">
      <div style="font-size: 16px; font-weight: 500; color: var(--text-primary); margin-bottom: 12px;">${escapeHtml(title)}</div>
      <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 24px;">${escapeHtml(message)}</div>
      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <button class="gc-dialog-cancel" style="
          font-family: inherit; font-size: 14px; font-weight: 500;
          padding: 0 16px; height: 36px; border-radius: 4px;
          border: none; background: none; color: var(--text-icon);
          cursor: pointer;
        ">${escapeHtml(cancelText)}</button>
        <button class="gc-dialog-confirm" style="
          font-family: inherit; font-size: 14px; font-weight: 500;
          padding: 0 16px; height: 36px; border-radius: 4px;
          border: none; ${confirmStyle} cursor: pointer;
        ">${escapeHtml(confirmText)}</button>
      </div>
    </div>
  `;

  overlay.querySelector(".gc-dialog-cancel")!.addEventListener("click", () => overlay.remove());
  overlay.querySelector(".gc-dialog-confirm")!.addEventListener("click", () => {
    overlay.remove();
    onConfirm();
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  document.body.appendChild(overlay);
}

// ── Section Header ─────────────────────────────────────────────────────

export function renderSectionHeader(title: string, subtitle?: string): string {
  const sub = subtitle ? `<span style="font-weight:400; color:var(--text-secondary); margin-left:8px; font-size:12px;">${escapeHtml(subtitle)}</span>` : "";
  return `
    <div class="gc-section-header" style="
      padding: 12px 0 8px;
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-secondary);
      border-bottom: 1px solid var(--border);
    ">${escapeHtml(title)}${sub}</div>
  `;
}

// ── List Item ──────────────────────────────────────────────────────────

export function renderListItem(opts: {
  icon?: string;
  color?: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: BadgeVariant;
  rightContent?: string;
  onClick?: string;
}): string {
  const iconHtml = opts.icon
    ? `<div style="font-size:20px; width:24px; text-align:center; flex-shrink:0;">${opts.icon}</div>`
    : opts.color
    ? renderColorSwatch(opts.color, 14)
    : "";

  const badgeHtml = opts.badge ? renderBadge(opts.badge, opts.badgeVariant) : "";
  const rightHtml = opts.rightContent || "";
  const clickAttr = opts.onClick ? `onclick="${opts.onClick}" style="cursor:pointer;"` : "";

  return `
    <div class="gc-list-item" ${clickAttr}>
      ${iconHtml}
      <div style="flex:1; min-width:0;">
        <div style="font-size:14px; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${escapeHtml(opts.title)}
        </div>
        ${opts.subtitle ? `<div style="font-size:12px; color:var(--text-secondary); margin-top:1px;">${escapeHtml(opts.subtitle)}</div>` : ""}
      </div>
      ${badgeHtml}
      ${rightHtml}
    </div>
  `;
}

// ── Shared CSS (inject into any app) ───────────────────────────────────

export const SHARED_COMPONENT_CSS = `
  .gc-event-card {
    background: var(--bg, #fff);
    border-bottom: 1px solid var(--border, #dadce0);
    transition: background 0.15s;
  }
  .gc-event-card:hover { background: var(--bg-hover, #f1f3f4); }
  .gc-card-date { font-size: 11px; color: var(--text-secondary); margin-bottom: 2px; }
  .gc-card-time { font-size: 12px; color: var(--text-secondary); }
  .gc-card-title { font-size: 14px; font-weight: 500; color: var(--text-primary); margin-top: 2px; }
  .gc-card-location { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
  .gc-card-loc-icon { font-size: 10px; }
  .gc-join-btn {
    margin-top: 6px; padding: 0 12px; height: 24px; border-radius: 12px;
    border: 1px solid var(--accent); background: transparent; color: var(--accent);
    font-size: 12px; font-weight: 500; cursor: pointer; font-family: inherit;
  }
  .gc-join-btn:hover { background: var(--accent-light); }

  .gc-attendee-chip {
    display: flex; align-items: center; gap: 8px; padding: 6px 0;
  }
  .gc-avatar {
    width: 32px; height: 32px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 500; flex-shrink: 0;
  }
  .gc-attendee-info { flex: 1; min-width: 0; }
  .gc-attendee-name { font-size: 13px; color: var(--text-primary); }
  .gc-status-icon { font-size: 14px; font-weight: 700; flex-shrink: 0; }

  .gc-list-item {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 16px; border-bottom: 1px solid var(--border);
    transition: background 0.15s;
  }
  .gc-list-item:hover { background: var(--bg-hover, #f1f3f4); }

  @keyframes gc-spin { to { transform: rotate(360deg); } }
  @keyframes gc-toast-in { from { opacity: 0; transform: translateY(10px); } }
`;
