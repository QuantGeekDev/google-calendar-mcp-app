#!/usr/bin/env node
/**
 * Generates static HTML mockups of each UI screen and captures screenshots.
 * No MCP protocol needed — renders pre-built HTML with sample content.
 */

import puppeteer from "puppeteer";
import { writeFileSync, mkdirSync, existsSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import http from "http";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = join(__dirname, "..", "screenshots");
const PORT = 9555;

if (!existsSync(SCREENSHOTS_DIR)) mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const THEME = `
:root{--bg:#fff;--bg-secondary:#f8f9fa;--bg-hover:#f1f3f4;--text-primary:#3c4043;--text-secondary:#70757a;--text-icon:#5f6368;--border:#dadce0;--accent:#1a73e8;--accent-light:#e8f0fe;--red:#d93025;--green:#0b8043;--green-light:#e6f4ea;--yellow:#f9ab00;--shadow-md:0 1px 3px 0 rgba(60,64,67,.3),0 4px 8px 3px rgba(60,64,67,.15);--card-bg:#fff;--font-stack:'Google Sans',Roboto,Arial,sans-serif;}
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:var(--font-stack);background:var(--bg);color:var(--text-primary);-webkit-font-smoothing:antialiased;padding:16px;line-height:1.5;}
`;

function page(title, content, extraCss = "") {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>${THEME}${extraCss}</style></head><body>${content}</body></html>`;
}

// ── Static mockups ────────────────────────────────────────────────────

const SCREENS = {
  "upcoming": page("Upcoming Events", `
    <div style="font-size:20px;font-weight:400;padding:12px 0;border-bottom:1px solid var(--border);">Upcoming Events</div>
    <div style="padding:10px 0 6px;font-size:14px;font-weight:500;color:var(--accent);">Today</div>
    ${eventCard("#039be5", "9:00 AM - 9:30 AM", "Team Standup", "Google Meet")}
    ${eventCard("#5484ed", "2:00 PM - 3:30 PM", "Product Review", "Room 4B - Barcelona Office")}
    <div style="padding:14px 0 6px;font-size:14px;font-weight:500;color:var(--text-primary);border-top:1px solid var(--border);margin-top:8px;">Wed, Mar 18</div>
    ${eventCard("#ff887c", "12:30 PM - 1:30 PM", "Lunch with Maria", "Café Central, Carrer de València")}
    <div style="padding:14px 0 6px;font-size:14px;font-weight:500;color:var(--text-primary);border-top:1px solid var(--border);margin-top:8px;">Thu, Mar 19</div>
    ${eventCard("#7ae7bf", "10:00 AM - 11:00 AM", "Sprint Planning", null, true)}
    <div style="padding:14px 0 6px;font-size:14px;font-weight:500;color:var(--text-primary);border-top:1px solid var(--border);margin-top:8px;">Fri, Mar 20</div>
    ${eventCard("#dbadff", "4:00 PM - 5:00 PM", "Design Review", "Figma")}
    <div style="padding:14px 0 6px;font-size:14px;font-weight:500;color:var(--text-primary);border-top:1px solid var(--border);margin-top:8px;">Sat, Mar 21</div>
    ${eventCard("#fbd75b", "All day", "Birthday Party - Max", null)}
    <div style="text-align:center;padding:16px;"><span style="color:var(--accent);font-size:14px;font-weight:500;cursor:pointer;">Load more</span></div>
  `),

  "event-detail": page("Event Detail", `
    <div style="background:var(--card-bg);border-radius:8px;box-shadow:var(--shadow-md);overflow:hidden;max-width:600px;">
      <div style="display:flex;">
        <div style="width:4px;background:#5484ed;flex-shrink:0;"></div>
        <div style="padding:24px;flex:1;">
          <div style="font-size:22px;font-weight:400;margin-bottom:4px;">Product Review</div>
          <div style="font-size:13px;color:var(--text-secondary);margin-bottom:20px;">Work Calendar</div>
          <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--border);">
            <span style="font-size:18px;color:var(--text-icon);">🕐</span>
            <div><div style="font-size:14px;">Tuesday, March 17, 2026</div><div style="font-size:13px;color:var(--text-secondary);">2:00 PM – 3:30 PM</div></div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--border);">
            <span style="font-size:18px;color:var(--text-icon);">📍</span>
            <div style="font-size:14px;color:var(--accent);">Room 4B - Barcelona Office</div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--border);">
            <span style="font-size:18px;color:var(--text-icon);">🔁</span>
            <div style="font-size:14px;">Weekly on Tuesday</div>
          </div>
          <div style="padding:10px 0;border-top:1px solid var(--border);">
            <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;">👥 4 attendees</div>
            ${attendee("A", "Alex", "accepted")}
            ${attendee("L", "Lisa Park", "accepted")}
            ${attendee("C", "Carlos Ruiz", "declined")}
            ${attendee("P", "Priya Sharma", "needsAction")}
          </div>
          <div style="display:flex;gap:8px;padding-top:16px;border-top:1px solid var(--border);margin-top:8px;">
            <button style="padding:0 16px;height:36px;border:none;background:var(--accent);color:#fff;border-radius:4px;font-size:14px;font-weight:500;font-family:inherit;">Accept</button>
            <button style="padding:0 16px;height:36px;border:none;background:none;color:var(--accent);border-radius:4px;font-size:14px;font-weight:500;font-family:inherit;">Decline</button>
            <button style="padding:0 16px;height:36px;border:none;background:none;color:var(--accent);border-radius:4px;font-size:14px;font-weight:500;font-family:inherit;">Maybe</button>
            <div style="flex:1;"></div>
            <button style="padding:0 16px;height:36px;border:none;background:none;color:var(--red);border-radius:4px;font-size:14px;font-weight:500;font-family:inherit;">Delete</button>
          </div>
        </div>
      </div>
    </div>
  `),

  "event-form": page("Event Form", `
    <div style="max-width:600px;">
      <input style="width:100%;font-size:22px;font-family:inherit;border:none;border-bottom:2px solid var(--border);padding:12px 4px;outline:none;color:var(--text-primary);background:transparent;" value="Team Sync Meeting" />
      <div style="display:flex;align-items:center;gap:16px;padding:14px 0;">
        <span style="font-size:18px;color:var(--text-icon);">🕐</span>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <input type="date" value="2026-03-18" style="height:36px;border:1px solid var(--border);border-radius:4px;padding:0 12px;font-family:inherit;font-size:14px;" />
          <input type="time" value="15:00" style="height:36px;border:1px solid var(--border);border-radius:4px;padding:0 12px;font-family:inherit;font-size:14px;" />
          <span style="color:var(--text-secondary);">–</span>
          <input type="date" value="2026-03-18" style="height:36px;border:1px solid var(--border);border-radius:4px;padding:0 12px;font-family:inherit;font-size:14px;" />
          <input type="time" value="16:00" style="height:36px;border:1px solid var(--border);border-radius:4px;padding:0 12px;font-family:inherit;font-size:14px;" />
        </div>
      </div>
      <div style="height:1px;background:var(--border);margin:4px 0 4px 36px;"></div>
      <div style="display:flex;align-items:center;gap:16px;padding:10px 0;"><span style="font-size:18px;color:var(--text-icon);">📍</span><input style="flex:1;font-size:14px;font-family:inherit;border:none;border-bottom:1px solid transparent;padding:8px 0;outline:none;color:var(--text-primary);background:transparent;" value="Conference Room A" /></div>
      <div style="height:1px;background:var(--border);margin:4px 0 4px 36px;"></div>
      <div style="display:flex;align-items:flex-start;gap:16px;padding:10px 0;"><span style="font-size:18px;color:var(--text-icon);">☰</span><textarea style="flex:1;font-size:14px;font-family:inherit;border:none;padding:8px 0;outline:none;color:var(--text-primary);background:transparent;resize:none;" rows="2">Weekly team sync to discuss progress and blockers</textarea></div>
      <div style="height:1px;background:var(--border);margin:4px 0 4px 36px;"></div>
      <div style="display:flex;align-items:center;gap:16px;padding:10px 0;"><span style="font-size:18px;color:var(--text-icon);">📅</span><span style="width:10px;height:10px;border-radius:50%;background:#039be5;"></span><select style="flex:1;height:36px;border:1px solid var(--border);border-radius:4px;padding:0 12px;font-family:inherit;font-size:14px;"><option>Alex's Calendar</option></select></div>
      <div style="display:flex;align-items:center;gap:16px;padding:10px 0;"><span style="font-size:18px;color:var(--text-icon);">🎨</span><div style="display:flex;gap:8px;">${colorDots()}</div></div>
      <div style="height:1px;background:var(--border);margin:4px 0 4px 36px;"></div>
      <div style="display:flex;align-items:center;gap:16px;padding:10px 0;">
        <span style="font-size:18px;color:var(--text-icon);">👥</span>
        <div style="flex:1;">
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
            ${chip("sarah@example.com")}${chip("mike@example.com")}
          </div>
          <div style="display:flex;gap:8px;"><input style="flex:1;height:36px;border:1px solid var(--border);border-radius:4px;padding:0 12px;font-family:inherit;font-size:14px;" placeholder="Add guests" /><button style="height:36px;padding:0 16px;border:none;background:none;color:var(--accent);font-size:14px;font-weight:500;font-family:inherit;">Add</button></div>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;padding-top:20px;">
        <button style="height:36px;padding:0 24px;border:none;background:none;color:var(--text-icon);font-size:14px;font-weight:500;font-family:inherit;border-radius:4px;">Cancel</button>
        <button style="height:36px;padding:0 24px;border:none;background:var(--accent);color:#fff;font-size:14px;font-weight:500;font-family:inherit;border-radius:4px;">Save</button>
      </div>
    </div>
  `),

  "calendar-list": page("Calendars", `
    <div style="display:flex;align-items:center;gap:8px;padding:12px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:18px;">📅</span>
      <span style="font-size:20px;font-weight:400;">Calendars</span>
      <span style="background:var(--bg-secondary);color:var(--text-secondary);padding:2px 8px;border-radius:12px;font-size:11px;font-weight:500;">5</span>
    </div>
    ${calendarItem("#039be5", "Alex's Calendar", "Owner", true)}
    ${calendarItem("#7986cb", "Work Calendar", "Writer", false)}
    ${calendarItem("#f6bf26", "Team Shared", "Writer", false)}
    ${calendarItem("#0b8043", "Holidays in Spain", "Reader", false)}
    ${calendarItem("#e67c73", "Birthdays", "Reader", false)}
  `),

  "colors": page("Colors", `
    <div style="font-size:20px;font-weight:400;padding:12px 0;border-bottom:1px solid var(--border);">Event Colors</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:16px 0;">
      ${colorCard("1", "Lavender", "#a4bdfc")}${colorCard("2", "Sage", "#7ae7bf")}${colorCard("3", "Grape", "#dbadff")}
      ${colorCard("4", "Flamingo", "#ff887c")}${colorCard("5", "Banana", "#fbd75b")}${colorCard("6", "Tangerine", "#ffb878")}
      ${colorCard("7", "Peacock", "#46d6db")}${colorCard("8", "Graphite", "#e1e1e1")}${colorCard("9", "Blueberry", "#5484ed")}
      ${colorCard("10", "Basil", "#51b749")}${colorCard("11", "Tomato", "#dc2127")}
    </div>
  `),

  "clock": page("Clock", `
    <div style="display:flex;align-items:center;justify-content:center;min-height:300px;">
      <div style="text-align:center;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:40px 60px;">
        <div style="font-size:48px;font-weight:400;letter-spacing:-1px;">2:32 PM</div>
        <div style="font-size:18px;color:var(--text-secondary);margin-top:8px;">Tuesday, March 17, 2026</div>
        <div style="font-size:14px;color:var(--text-secondary);margin-top:12px;">Europe/Madrid (CET, UTC+01:00)</div>
        <div style="margin-top:12px;"><span style="display:inline-flex;align-items:center;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:500;background:var(--bg-secondary);color:var(--text-secondary);">Standard Time</span></div>
      </div>
    </div>
  `),

  "freebusy": page("Availability", `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:20px;font-weight:400;">Availability</span>
      <div style="display:flex;gap:8px;">
        <button style="height:32px;padding:0 16px;border:1px solid var(--accent);background:var(--accent-light);color:var(--accent);border-radius:100px;font-size:13px;font-weight:500;font-family:inherit;">Today</button>
        <button style="height:32px;padding:0 16px;border:1px solid var(--border);background:none;color:var(--text-primary);border-radius:100px;font-size:13px;font-weight:500;font-family:inherit;">This Week</button>
      </div>
    </div>
    <div style="font-size:10px;color:var(--text-secondary);display:flex;justify-content:space-between;padding:8px 150px 4px 150px;">
      <span>8 AM</span><span>10 AM</span><span>12 PM</span><span>2 PM</span><span>4 PM</span><span>6 PM</span><span>8 PM</span>
    </div>
    ${freebusyRow("alex@example.com", [{start:8.3,end:9.8},{start:50,end:62.5}])}
    ${freebusyRow("work@example.com", [{start:16.6,end:29.2},{start:50,end:66.6}])}
    ${freebusyRow("team@example.com", [{start:8.3,end:16.6},{start:41.6,end:50}])}
    <div style="padding:14px 0 6px;font-size:13px;font-weight:500;color:var(--green);border-top:1px solid var(--border);margin-top:12px;">Common Free Slots</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;padding:8px 0;">
      <span style="padding:4px 12px;border-radius:100px;font-size:12px;background:#e6f4ea;color:var(--green);font-weight:500;">9:30 AM – 10:00 AM (30min)</span>
      <span style="padding:4px 12px;border-radius:100px;font-size:12px;background:#e6f4ea;color:var(--green);font-weight:500;">11:30 AM – 1:00 PM (1h 30min)</span>
      <span style="padding:4px 12px;border-radius:100px;font-size:12px;background:#e6f4ea;color:var(--green);font-weight:500;">4:00 PM – 8:00 PM (4h)</span>
    </div>
  `),

  "delete-confirm": page("Deleted", `
    <div style="display:flex;align-items:center;justify-content:center;min-height:300px;">
      <div style="text-align:center;max-width:360px;">
        <div style="width:64px;height:64px;border-radius:50%;background:var(--green-light);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:32px;color:var(--green);">✓</div>
        <div style="font-size:18px;font-weight:500;margin-bottom:8px;">Event deleted</div>
        <div style="font-size:14px;color:var(--text-secondary);">Event 'Team Standup' has been deleted</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:12px;font-family:monospace;">ID: evt1</div>
      </div>
    </div>
  `),

  "rsvp-confirm": page("RSVP", `
    <div style="display:flex;align-items:center;justify-content:center;min-height:350px;">
      <div style="text-align:center;max-width:400px;">
        <div style="width:64px;height:64px;border-radius:50%;background:var(--green-light);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:32px;color:var(--green);">✓</div>
        <div style="font-size:18px;font-weight:500;margin-bottom:4px;">You accepted</div>
        <div style="font-size:14px;color:var(--text-secondary);margin-bottom:20px;">Updates sent to all attendees</div>
        <div style="text-align:left;border:1px solid var(--border);border-radius:8px;overflow:hidden;">
          <div style="display:flex;"><div style="width:4px;background:#5484ed;flex-shrink:0;"></div>
          <div style="padding:16px;">
            <div style="font-size:14px;font-weight:500;">Product Review</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">Tue, Mar 17 · 2:00 PM – 3:30 PM</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">📍 Room 4B - Barcelona Office</div>
          </div></div>
        </div>
      </div>
    </div>
  `),

  "bulk-create": page("Bulk Create", `
    <div style="max-width:600px;">
      <div style="font-size:20px;font-weight:400;margin-bottom:16px;">Created 4 of 5 events</div>
      <div style="width:100%;height:8px;background:var(--border);border-radius:4px;overflow:hidden;margin-bottom:12px;">
        <div style="width:80%;height:100%;background:var(--green);border-radius:4px;"></div>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:20px;">
        <span style="padding:2px 8px;border-radius:12px;font-size:11px;font-weight:500;background:var(--green-light);color:var(--green);">4 created</span>
        <span style="padding:2px 8px;border-radius:12px;font-size:11px;font-weight:500;background:#fce8e6;color:var(--red);">1 failed</span>
      </div>
      <div style="font-size:13px;font-weight:500;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;padding:8px 0;border-bottom:1px solid var(--border);">Created</div>
      ${bulkItem("#039be5", "Team Standup", "Tue, Mar 17 · 9:00 AM")}
      ${bulkItem("#5484ed", "Product Review", "Tue, Mar 17 · 2:00 PM")}
      ${bulkItem("#ff887c", "Lunch with Maria", "Wed, Mar 18 · 12:30 PM")}
      ${bulkItem("#7ae7bf", "Sprint Planning", "Thu, Mar 19 · 10:00 AM")}
      <div style="font-size:13px;font-weight:500;color:var(--red);text-transform:uppercase;letter-spacing:0.5px;padding:8px 0;border-bottom:1px solid var(--border);margin-top:12px;">Failed</div>
      <div style="padding:10px 0;border-bottom:1px solid var(--border);background:#fce8e610;">
        <div style="font-size:14px;font-weight:500;">Duplicate Meeting</div>
        <div style="font-size:12px;color:var(--red);margin-top:2px;">Conflict detected with existing event</div>
      </div>
    </div>
  `),

  "accounts": page("Accounts", `
    <div style="display:flex;align-items:center;gap:8px;padding:12px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:20px;font-weight:400;">Connected Accounts</span>
      <span style="padding:2px 8px;border-radius:12px;font-size:11px;font-weight:500;background:var(--bg-secondary);color:var(--text-secondary);">2</span>
    </div>
    ${accountCard("A", "personal", "alex@example.com", "Active", 4, "Alex's Calendar")}
    ${accountCard("A", "work", "alex@company.com", "Active", 3, "Work")}
  `),

  "agenda": page("Agenda", `
    <div style="max-width:700px;">
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <div style="flex:1;height:40px;border:1px solid var(--border);border-radius:20px;display:flex;align-items:center;padding:0 16px;gap:8px;">
          <span style="color:var(--text-icon);">🔍</span>
          <span style="color:var(--text-secondary);font-size:14px;">Search events...</span>
        </div>
      </div>
      <div style="background:var(--bg-secondary);padding:6px 16px;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;color:var(--accent);border-bottom:1px solid var(--border);">Today · Tue, Mar 17</div>
      ${agendaRow("9:00 – 9:30 AM", "Team Standup", "Google Meet", "#039be5")}
      ${agendaRow("2:00 – 3:30 PM", "Product Review", "Room 4B", "#5484ed")}
      <div style="background:var(--bg-secondary);padding:6px 16px;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary);border-bottom:1px solid var(--border);">Wed, Mar 18</div>
      ${agendaRow("12:30 – 1:30 PM", "Lunch with Maria", "Café Central", "#ff887c")}
      <div style="background:var(--bg-secondary);padding:6px 16px;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary);border-bottom:1px solid var(--border);">Thu, Mar 19</div>
      ${agendaRow("10:00 – 11:00 AM", "Sprint Planning", null, "#7ae7bf")}
      <div style="background:var(--bg-secondary);padding:6px 16px;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary);border-bottom:1px solid var(--border);">Fri, Mar 20</div>
      ${agendaRow("4:00 – 5:00 PM", "Design Review", "Figma", "#dbadff")}
      <div style="background:var(--bg-secondary);padding:6px 16px;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary);border-bottom:1px solid var(--border);">Sat, Mar 21</div>
      ${agendaRow("All day", "Birthday Party - Max", null, "#fbd75b")}
    </div>
  `),
};

// ── Component helpers ─────────────────────────────────────────────────

function eventCard(color, time, title, location, hasJoin = false) {
  const loc = location ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:2px;"><span style="font-size:10px;">📍</span> ${location}</div>` : "";
  const join = hasJoin ? `<button style="margin-top:6px;padding:0 12px;height:24px;border-radius:12px;border:1px solid var(--accent);background:none;color:var(--accent);font-size:12px;font-weight:500;font-family:inherit;">Join</button>` : "";
  return `<div style="border-left:4px solid ${color};padding:12px 16px;border-bottom:1px solid var(--border);">
    <div style="font-size:12px;color:var(--text-secondary);">${time}</div>
    <div style="font-size:14px;font-weight:500;margin-top:2px;">${title}</div>
    ${loc}${join}
  </div>`;
}

function attendee(initial, name, status) {
  const colors = { accepted: "var(--green)", declined: "var(--red)", tentative: "var(--yellow)", needsAction: "var(--text-secondary)" };
  const icons = { accepted: "✓", declined: "✗", tentative: "?", needsAction: "·" };
  const c = colors[status]; const i = icons[status];
  return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;">
    <div style="width:32px;height:32px;border-radius:50%;background:${c}20;color:${c};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:500;">${initial}</div>
    <span style="flex:1;font-size:13px;">${name}</span>
    <span style="color:${c};font-weight:700;">${i}</span>
  </div>`;
}

function calendarItem(color, name, role, primary) {
  const roleBg = role === "Owner" ? "var(--green-light)" : role === "Writer" ? "var(--accent-light)" : "var(--bg-secondary)";
  const roleFg = role === "Owner" ? "var(--green)" : role === "Writer" ? "var(--accent)" : "var(--text-secondary)";
  const star = primary ? `<span style="color:#f9ab00;font-size:14px;">★</span>` : "";
  return `<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);">
    <span style="width:14px;height:14px;border-radius:50%;background:${color};flex-shrink:0;"></span>
    <span style="flex:1;font-size:14px;">${name}</span>
    ${star}
    <span style="padding:2px 8px;border-radius:12px;font-size:11px;font-weight:500;background:${roleBg};color:${roleFg};">${role}</span>
  </div>`;
}

function colorCard(id, name, hex) {
  return `<div style="border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center;cursor:pointer;">
    <div style="width:32px;height:32px;border-radius:50%;background:${hex};margin:0 auto 8px;"></div>
    <div style="font-size:13px;font-weight:500;">${name}</div>
    <div style="font-size:11px;color:var(--text-secondary);">${hex}</div>
    <div style="font-size:10px;color:var(--text-secondary);margin-top:2px;">ID: ${id}</div>
  </div>`;
}

function colorDots() {
  const colors = ["#a4bdfc","#7ae7bf","#dbadff","#ff887c","#fbd75b","#ffb878","#46d6db","#e1e1e1","#5484ed","#51b749","#dc2127"];
  return colors.map((c, i) => `<span style="width:18px;height:18px;border-radius:50%;background:${c};display:inline-block;border:${i===6?'2px solid var(--text-primary)':'2px solid transparent'};cursor:pointer;"></span>`).join("");
}

function chip(email) {
  return `<span style="display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 4px 0 10px;background:#e8eaed;border-radius:12px;font-size:13px;">${email}<span style="width:18px;height:18px;display:flex;align-items:center;justify-content:center;border-radius:50%;cursor:pointer;font-size:13px;color:var(--text-icon);">×</span></span>`;
}

function freebusyRow(label, blocks) {
  const name = label.split("@")[0];
  const busyHtml = blocks.map(b => `<div style="position:absolute;left:${b.start}%;width:${b.end-b.start}%;height:100%;background:rgba(26,115,232,0.7);border-radius:4px;"></div>`).join("");
  return `<div style="display:flex;align-items:center;gap:0;margin:4px 0;">
    <div style="width:150px;font-size:13px;color:var(--text-primary);padding-right:12px;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${name}</div>
    <div style="flex:1;height:36px;background:#e6f4ea;border-radius:4px;position:relative;border:1px solid var(--border);">${busyHtml}</div>
  </div>`;
}

function bulkItem(color, title, date) {
  return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
    <span style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;"></span>
    <span style="font-size:14px;flex:1;">${title}</span>
    <span style="font-size:12px;color:var(--text-secondary);">${date}</span>
  </div>`;
}

function accountCard(initial, id, email, status, count, primary) {
  return `<div style="display:flex;align-items:center;gap:12px;padding:16px;border-bottom:1px solid var(--border);">
    <div style="width:40px;height:40px;border-radius:50%;background:var(--accent-light);color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:500;">${initial}</div>
    <div style="flex:1;">
      <div style="font-size:14px;font-weight:500;">${id}</div>
      <div style="font-size:12px;color:var(--text-secondary);">${email}</div>
      <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">${count} calendars · ${primary}</div>
    </div>
    <span style="padding:2px 8px;border-radius:12px;font-size:11px;font-weight:500;background:var(--green-light);color:var(--green);">${status}</span>
  </div>`;
}

function agendaRow(time, title, location, color) {
  const loc = location ? `<span style="font-size:12px;color:var(--text-secondary);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${location}</span>` : "";
  return `<div style="display:flex;align-items:center;padding:8px 16px;border-bottom:1px solid var(--border);gap:12px;">
    <span style="width:130px;font-size:12px;color:var(--text-secondary);flex-shrink:0;">${time}</span>
    <span style="flex:1;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${title}</span>
    ${loc}
    <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;"></span>
  </div>`;
}

// ── Capture ───────────────────────────────────────────────────────────

async function main() {
  const pages = new Map();
  const server = http.createServer((req, res) => {
    const html = pages.get(req.url);
    if (html) { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(html); }
    else { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(PORT, r));

  for (const [name, html] of Object.entries(SCREENS)) {
    pages.set(`/${name}`, html);
  }

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });

  console.log(`\nCapturing ${Object.keys(SCREENS).length} screenshots...\n`);

  for (const name of Object.keys(SCREENS)) {
    const p = await browser.newPage();
    const h = ["freebusy", "agenda", "event-form"].includes(name) ? 700 : 600;
    await p.setViewport({ width: 800, height: h });
    await p.goto(`http://localhost:${PORT}/${name}`, { waitUntil: "networkidle0" });
    await new Promise(r => setTimeout(r, 200));
    const path = join(SCREENSHOTS_DIR, `${name}.png`);
    await p.screenshot({ path });
    const size = statSync(path).size;
    console.log(`  ✓ ${name}.png (${Math.round(size/1024)}KB)`);
    await p.close();
  }

  await browser.close();
  server.close();
  console.log(`\nDone!`);
}

main().catch(console.error);
