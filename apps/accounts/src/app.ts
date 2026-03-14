import { App } from "@modelcontextprotocol/ext-apps";
import { createGCalApp, parseToolResult } from "../../shared/gcal-app";
import {
  escapeHtml,
  renderBadge,
  renderEmptyState,
  SHARED_COMPONENT_CSS,
} from "../../shared/components";

// ── Types ───────────────────────────────────────────────────────────────────

interface AccountInfo {
  account_id: string;
  status: string;
  email?: string;
  calendar_count?: number;
  primary_calendar?: string;
  token_expiry?: string;
}

interface ListAccountsResponse {
  accounts: AccountInfo[];
  total_accounts: number;
  message?: string;
}

interface AddAccountResponse {
  status: "awaiting_authentication" | "already_authenticated" | "error";
  account_id: string;
  auth_url?: string;
  instructions?: string;
  message?: string;
}

interface RemoveAccountResponse {
  success: boolean;
  account_id: string;
  message: string;
  remaining_accounts: number;
}

type AccountResponse = ListAccountsResponse | AddAccountResponse | RemoveAccountResponse;

// ── State ───────────────────────────────────────────────────────────────────

const app: App = createGCalApp("Account Manager");
const appEl = document.getElementById("app")!;

// ── Inject shared CSS ───────────────────────────────────────────────────────

const sharedStyle = document.createElement("style");
sharedStyle.textContent = SHARED_COMPONENT_CSS;
document.head.appendChild(sharedStyle);

// Inject app-specific CSS
const appStyle = document.createElement("style");
appStyle.textContent = `
  .am-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 0 14px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 4px;
  }
  .am-header h1 {
    font-size: 18px;
    font-weight: 500;
    color: var(--text-primary);
  }
  .am-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border-radius: 11px;
    font-size: 12px;
    font-weight: 500;
    background: var(--accent-light);
    color: var(--accent);
  }
  .am-card {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
    transition: background 0.15s;
  }
  .am-card:hover {
    background: var(--bg-hover);
  }
  .am-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--accent-light);
    color: var(--accent);
    font-size: 18px;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    text-transform: uppercase;
  }
  .am-info {
    flex: 1;
    min-width: 0;
  }
  .am-account-id {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .am-email {
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 1px;
  }
  .am-details {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 6px;
    align-items: center;
  }
  .am-detail-item {
    font-size: 12px;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .am-token-expiry {
    font-size: 11px;
    color: var(--text-secondary);
    margin-top: 4px;
  }
  .am-status-col {
    flex-shrink: 0;
    display: flex;
    align-items: flex-start;
    padding-top: 2px;
  }
  .am-message-box {
    padding: 16px;
    border-radius: 8px;
    margin-top: 12px;
  }
  .am-message-box.info {
    background: var(--accent-light);
    border: 1px solid var(--accent);
  }
  .am-message-box.success {
    background: var(--green-light);
    border: 1px solid var(--green);
  }
  .am-message-box.error {
    background: var(--red-light);
    border: 1px solid var(--red);
  }
  .am-message-title {
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 8px;
  }
  .am-message-text {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.6;
  }
  .am-auth-link {
    display: inline-block;
    margin-top: 8px;
    color: var(--accent);
    font-size: 13px;
    font-weight: 500;
    text-decoration: none;
    word-break: break-all;
  }
  .am-auth-link:hover {
    text-decoration: underline;
  }
  .am-instructions {
    font-size: 13px;
    color: var(--text-secondary);
    margin-top: 8px;
    line-height: 1.6;
    white-space: pre-wrap;
  }
  .am-remaining {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 6px;
  }
`;
document.head.appendChild(appStyle);

// ── Detect response type ────────────────────────────────────────────────────

function isListResponse(data: any): data is ListAccountsResponse {
  return Array.isArray(data.accounts) && typeof data.total_accounts === "number";
}

function isAddResponse(data: any): data is AddAccountResponse {
  return (
    typeof data.status === "string" &&
    typeof data.account_id === "string" &&
    !("success" in data) &&
    !("accounts" in data)
  );
}

function isRemoveResponse(data: any): data is RemoveAccountResponse {
  return typeof data.success === "boolean" && typeof data.remaining_accounts === "number";
}

// ── Render: List Accounts ───────────────────────────────────────────────────

function getStatusBadge(status: string): string {
  const s = status.toLowerCase();
  if (s === "active" || s === "authenticated") {
    return renderBadge("Active", "success");
  }
  if (s === "expired" || s === "token_expired") {
    return renderBadge("Expired", "warning");
  }
  return renderBadge("Error", "error");
}

function getInitial(account: AccountInfo): string {
  if (account.email && account.email.length > 0) {
    return account.email[0].toUpperCase();
  }
  if (account.account_id && account.account_id.length > 0) {
    return account.account_id[0].toUpperCase();
  }
  return "?";
}

function formatTokenExpiry(expiry: string): string {
  try {
    const d = new Date(expiry);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return expiry;
  }
}

function renderListAccounts(data: ListAccountsResponse): void {
  let html = `
    <div class="am-header">
      <h1>Connected Accounts</h1>
      <span class="am-count">${data.total_accounts}</span>
    </div>
  `;

  if (data.message) {
    html += `<div style="padding:8px 0;font-size:13px;color:var(--text-secondary);">${escapeHtml(data.message)}</div>`;
  }

  if (data.accounts.length === 0) {
    html += renderEmptyState("No accounts connected", "👤");
    appEl.innerHTML = html;
    return;
  }

  for (const account of data.accounts) {
    const initial = getInitial(account);
    const statusBadge = getStatusBadge(account.status);

    let detailsHtml = "";
    if (account.calendar_count !== undefined) {
      detailsHtml += `<span class="am-detail-item">📅 ${account.calendar_count} calendar${account.calendar_count !== 1 ? "s" : ""}</span>`;
    }
    if (account.primary_calendar) {
      detailsHtml += `<span class="am-detail-item">⭐ ${escapeHtml(account.primary_calendar)}</span>`;
    }

    let tokenHtml = "";
    if (account.token_expiry) {
      tokenHtml = `<div class="am-token-expiry">Token expires: ${escapeHtml(formatTokenExpiry(account.token_expiry))}</div>`;
    }

    html += `
      <div class="am-card">
        <div class="am-avatar">${escapeHtml(initial)}</div>
        <div class="am-info">
          <div class="am-account-id">${escapeHtml(account.account_id)}</div>
          ${account.email ? `<div class="am-email">${escapeHtml(account.email)}</div>` : ""}
          ${detailsHtml ? `<div class="am-details">${detailsHtml}</div>` : ""}
          ${tokenHtml}
        </div>
        <div class="am-status-col">${statusBadge}</div>
      </div>
    `;
  }

  appEl.innerHTML = html;
}

// ── Render: Add Account ─────────────────────────────────────────────────────

function renderAddAccount(data: AddAccountResponse): void {
  const statusMap: Record<string, { variant: string; label: string }> = {
    awaiting_authentication: { variant: "info", label: "Awaiting Authentication" },
    already_authenticated: { variant: "success", label: "Already Authenticated" },
    error: { variant: "error", label: "Error" },
  };

  const info = statusMap[data.status] || { variant: "info", label: data.status };

  let html = `
    <div class="am-header">
      <h1>Add Account</h1>
      ${renderBadge(info.label, info.variant as any)}
    </div>
    <div class="am-message-box ${info.variant}">
      <div class="am-message-title" style="color:var(--text-primary);">Account: ${escapeHtml(data.account_id)}</div>
  `;

  if (data.message) {
    html += `<div class="am-message-text">${escapeHtml(data.message)}</div>`;
  }

  if (data.auth_url) {
    html += `<a class="am-auth-link" href="${escapeHtml(data.auth_url)}" target="_blank" rel="noopener noreferrer">Open authentication link</a>`;
  }

  if (data.instructions) {
    html += `<div class="am-instructions">${escapeHtml(data.instructions)}</div>`;
  }

  html += `</div>`;
  appEl.innerHTML = html;
}

// ── Render: Remove Account ──────────────────────────────────────────────────

function renderRemoveAccount(data: RemoveAccountResponse): void {
  const variant = data.success ? "success" : "error";
  const label = data.success ? "Removed" : "Failed";

  let html = `
    <div class="am-header">
      <h1>Remove Account</h1>
      ${renderBadge(label, variant as any)}
    </div>
    <div class="am-message-box ${variant}">
      <div class="am-message-title" style="color:var(--text-primary);">Account: ${escapeHtml(data.account_id)}</div>
      <div class="am-message-text">${escapeHtml(data.message)}</div>
      <div class="am-remaining">Remaining accounts: ${data.remaining_accounts}</div>
    </div>
  `;

  appEl.innerHTML = html;
}

// ── Tool Result Handler ─────────────────────────────────────────────────────

app.ontoolresult = (result: any) => {
  try {
    const data = parseToolResult<AccountResponse>(result);

    if (isListResponse(data)) {
      renderListAccounts(data);
      return;
    }

    if (isAddResponse(data)) {
      renderAddAccount(data);
      return;
    }

    if (isRemoveResponse(data)) {
      renderRemoveAccount(data);
      return;
    }

    // Fallback: try to render as list if there's an accounts array
    if (Array.isArray((data as any).accounts)) {
      renderListAccounts(data as ListAccountsResponse);
      return;
    }

    // Unknown response shape
    showEmptyState();
  } catch {
    showEmptyState();
  }
};

function showEmptyState(): void {
  appEl.innerHTML = `
    <div class="am-header">
      <h1>Connected Accounts</h1>
    </div>
    ${renderEmptyState("No account data", "👤")}
  `;
}
