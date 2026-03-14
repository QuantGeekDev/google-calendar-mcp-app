import { App } from "@modelcontextprotocol/ext-apps";
import {
  createGCalApp,
  parseToolResult,
  getEvent,
  deleteEvent,
  respondToEvent,
  getEventColor,
  getMeetingLink,
  GCalEvent,
  ListEventsResult,
} from "../../shared/gcal-app";
import {
  formatTimeRange,
  formatDate,
  formatDateShort,
  isAllDay,
  getEventDateTime,
} from "../../shared/time-utils";

// ---- State ----
let currentEvent: GCalEvent | null = null;
let app: App;

// ---- DOM refs ----
const cardContainer = document.getElementById("card-container") as HTMLDivElement;
const overlayContainer = document.getElementById("overlay-container") as HTMLDivElement;

// ---- Helpers ----

/** Get status indicator for an attendee */
function getStatusIndicator(responseStatus: string | undefined): { symbol: string; color: string } {
  switch (responseStatus) {
    case "accepted":
      return { symbol: "\u2713", color: "#34a853" };
    case "declined":
      return { symbol: "\u2717", color: "#ea4335" };
    case "tentative":
      return { symbol: "?", color: "#fbbc04" };
    case "needsAction":
    default:
      return { symbol: "\u2022", color: "#9e9e9e" };
  }
}

/** Get first letter for avatar */
function getInitial(name: string | undefined, email: string): string {
  if (name && name.length > 0) return name[0].toUpperCase();
  return email[0].toUpperCase();
}

/** Format recurrence rule for display */
function formatRecurrence(recurrence: string[]): string {
  const rule = recurrence.find((r) => r.startsWith("RRULE:"));
  if (!rule) return recurrence.join(", ");

  const parts = rule.replace("RRULE:", "").split(";");
  const freq = parts.find((p) => p.startsWith("FREQ="))?.replace("FREQ=", "");
  const interval = parts.find((p) => p.startsWith("INTERVAL="))?.replace("INTERVAL=", "");
  const count = parts.find((p) => p.startsWith("COUNT="))?.replace("COUNT=", "");
  const until = parts.find((p) => p.startsWith("UNTIL="))?.replace("UNTIL=", "");
  const byDay = parts.find((p) => p.startsWith("BYDAY="))?.replace("BYDAY=", "");

  let text = "";
  const n = interval ? parseInt(interval, 10) : 1;

  switch (freq) {
    case "DAILY":
      text = n === 1 ? "Every day" : `Every ${n} days`;
      break;
    case "WEEKLY":
      text = n === 1 ? "Every week" : `Every ${n} weeks`;
      if (byDay) {
        const dayMap: Record<string, string> = {
          MO: "Mon",
          TU: "Tue",
          WE: "Wed",
          TH: "Thu",
          FR: "Fri",
          SA: "Sat",
          SU: "Sun",
        };
        const days = byDay.split(",").map((d) => dayMap[d] || d).join(", ");
        text += ` on ${days}`;
      }
      break;
    case "MONTHLY":
      text = n === 1 ? "Every month" : `Every ${n} months`;
      break;
    case "YEARLY":
      text = n === 1 ? "Every year" : `Every ${n} years`;
      break;
    default:
      text = `Repeats ${freq?.toLowerCase() || ""}`;
  }

  if (count) {
    text += `, ${count} times`;
  } else if (until) {
    const y = until.substring(0, 4);
    const m = until.substring(4, 6);
    const d = until.substring(6, 8);
    text += `, until ${m}/${d}/${y}`;
  }

  return text;
}

/** Show a toast notification */
function showToast(message: string): void {
  const existing = document.querySelector(".status-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "status-toast";
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

/** Show confirm dialog for deletion */
function showDeleteConfirm(event: GCalEvent): void {
  overlayContainer.innerHTML = "";

  const overlay = document.createElement("div");
  overlay.className = "confirm-overlay";
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlayContainer.innerHTML = "";
    }
  });

  const dialog = document.createElement("div");
  dialog.className = "confirm-dialog";

  const title = document.createElement("h3");
  title.textContent = "Delete Event";
  dialog.appendChild(title);

  const desc = document.createElement("p");
  const eventName = event.summary || "(No title)";
  desc.textContent = "Are you sure you want to delete \"" + eventName + "\"? This action cannot be undone.";
  dialog.appendChild(desc);

  const actions = document.createElement("div");
  actions.className = "confirm-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "confirm-cancel-btn";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () => {
    overlayContainer.innerHTML = "";
  });
  actions.appendChild(cancelBtn);

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "confirm-delete-btn";
  deleteBtn.textContent = "Delete";
  deleteBtn.addEventListener("click", async () => {
    overlayContainer.innerHTML = "";
    try {
      await deleteEvent(app, event.id, event.calendarId);
      showToast("Event deleted successfully");
      cardContainer.innerHTML = '<div class="loading">Event has been deleted.</div>';
      currentEvent = null;
    } catch (err) {
      console.error("Failed to delete event:", err);
      showToast("Failed to delete event");
    }
  });
  actions.appendChild(deleteBtn);

  dialog.appendChild(actions);
  overlay.appendChild(dialog);
  overlayContainer.appendChild(overlay);
}

/** Handle RSVP response */
async function handleRsvp(event: GCalEvent, response: string): Promise<void> {
  const labels: Record<string, string> = {
    accepted: "Accepted",
    declined: "Declined",
    tentative: "Maybe",
  };

  try {
    await respondToEvent(app, event.id, response, event.calendarId);
    showToast(`Response: ${labels[response] || response}`);

    // Refresh event data
    try {
      const result = await getEvent(app, event.id, event.calendarId);
      currentEvent = result.event;
      renderEventCard(currentEvent);
    } catch {
      // Update local state at minimum
      if (currentEvent?.attendees) {
        for (const att of currentEvent.attendees) {
          if (att.self) {
            att.responseStatus = response;
          }
        }
        renderEventCard(currentEvent);
      }
    }
  } catch (err) {
    console.error("Failed to respond to event:", err);
    showToast("Failed to send response");
  }
}

/** Render the complete event detail card */
function renderEventCard(event: GCalEvent): void {
  currentEvent = event;
  const color = getEventColor(event);
  const meetingLink = getMeetingLink(event);
  const { start, end } = getEventDateTime(event);
  const allDay = isAllDay(event);

  cardContainer.innerHTML = "";

  const card = document.createElement("div");
  card.className = "card";

  // Color strip
  const strip = document.createElement("div");
  strip.className = "color-strip";
  strip.style.backgroundColor = color;
  card.appendChild(strip);

  // Card body
  const body = document.createElement("div");
  body.className = "card-body";

  // ---- Title Section ----
  const titleSection = document.createElement("div");
  titleSection.className = "title-section";

  const titleEl = document.createElement("div");
  titleEl.className = "event-title";
  titleEl.textContent = event.summary || "(No title)";
  titleSection.appendChild(titleEl);

  if (event.calendarId) {
    const calName = document.createElement("div");
    calName.className = "calendar-name";
    calName.textContent = event.calendarId;
    titleSection.appendChild(calName);
  }

  body.appendChild(titleSection);

  // ---- Date/Time Section ----
  const timeSection = document.createElement("div");
  timeSection.className = "section";
  const timeRow = document.createElement("div");
  timeRow.className = "section-row";

  const timeIcon = document.createElement("div");
  timeIcon.className = "section-icon";
  timeIcon.textContent = "\uD83D\uDD50"; // clock emoji

  const timeContent = document.createElement("div");
  timeContent.className = "section-content";

  const timeLabel = document.createElement("div");
  timeLabel.className = "section-label";
  timeLabel.textContent = "Date & Time";
  timeContent.appendChild(timeLabel);

  const timeValue = document.createElement("div");
  timeValue.className = "section-value";
  if (allDay) {
    timeValue.textContent = formatDate(start);
    // Check if multi-day all-day event
    if (start && end) {
      const startD = new Date(start);
      const endD = new Date(end);
      endD.setDate(endD.getDate() - 1); // All-day end is exclusive
      if (startD.toDateString() !== endD.toDateString()) {
        timeValue.textContent = `${formatDateShort(start)} \u2013 ${formatDateShort(endD.toISOString())}`;
      }
    }
    const allDayBadge = document.createElement("span");
    allDayBadge.textContent = " (All day)";
    allDayBadge.style.color = "#70757a";
    allDayBadge.style.fontSize = "13px";
    timeValue.appendChild(allDayBadge);
  } else {
    const datePart = formatDate(start);
    const timePart = formatTimeRange(start, end);
    timeValue.textContent = `${datePart}`;
    const timeLine = document.createElement("div");
    timeLine.style.color = "#3c4043";
    timeLine.style.marginTop = "2px";
    timeLine.textContent = timePart;
    timeContent.appendChild(timeValue);
    timeContent.appendChild(timeLine);
  }
  if (!allDay) {
    // timeValue already appended via the branch above
  } else {
    timeContent.appendChild(timeValue);
  }

  timeRow.appendChild(timeIcon);
  timeRow.appendChild(timeContent);
  timeSection.appendChild(timeRow);
  body.appendChild(timeSection);

  // ---- Location Section ----
  if (event.location) {
    const locSection = document.createElement("div");
    locSection.className = "section";
    const locRow = document.createElement("div");
    locRow.className = "section-row";

    const locIcon = document.createElement("div");
    locIcon.className = "section-icon";
    locIcon.textContent = "\uD83D\uDCCD"; // pin emoji

    const locContent = document.createElement("div");
    locContent.className = "section-content";

    const locLabel = document.createElement("div");
    locLabel.className = "section-label";
    locLabel.textContent = "Location";
    locContent.appendChild(locLabel);

    const locValue = document.createElement("div");
    locValue.className = "section-value location-link";
    locValue.textContent = event.location;
    locValue.addEventListener("click", () => {
      app.sendOpenLink({ url: `https://maps.google.com/?q=${encodeURIComponent(event.location!)}` });
    });
    locContent.appendChild(locValue);

    locRow.appendChild(locIcon);
    locRow.appendChild(locContent);
    locSection.appendChild(locRow);
    body.appendChild(locSection);
  }

  // ---- Description Section ----
  if (event.description) {
    const descSection = document.createElement("div");
    descSection.className = "section";
    const descRow = document.createElement("div");
    descRow.className = "section-row";

    const descIcon = document.createElement("div");
    descIcon.className = "section-icon";
    descIcon.textContent = "\uD83D\uDCC4"; // document emoji

    const descContent = document.createElement("div");
    descContent.className = "section-content";

    const descLabel = document.createElement("div");
    descLabel.className = "section-label";
    descLabel.textContent = "Description";
    descContent.appendChild(descLabel);

    const descText = document.createElement("div");
    descText.className = "description-text";
    // Strip HTML tags from description for safe display
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = event.description;
    descText.textContent = tempDiv.textContent || tempDiv.innerText || event.description;
    descContent.appendChild(descText);

    descRow.appendChild(descIcon);
    descRow.appendChild(descContent);
    descSection.appendChild(descRow);
    body.appendChild(descSection);
  }

  // ---- Video Meeting Section ----
  if (meetingLink) {
    const meetSection = document.createElement("div");
    meetSection.className = "section";
    const meetRow = document.createElement("div");
    meetRow.className = "section-row";

    const meetIcon = document.createElement("div");
    meetIcon.className = "section-icon";
    meetIcon.textContent = "\uD83D\uDCF9"; // video camera emoji

    const meetContent = document.createElement("div");
    meetContent.className = "section-content";

    const meetLabel = document.createElement("div");
    meetLabel.className = "section-label";
    meetLabel.textContent = "Video Meeting";
    meetContent.appendChild(meetLabel);

    const joinBtn = document.createElement("button");
    joinBtn.className = "join-meeting-btn";
    joinBtn.textContent = "Join Meeting";
    joinBtn.addEventListener("click", () => {
      app.sendOpenLink({ url: meetingLink });
    });
    meetContent.appendChild(joinBtn);

    if (event.conferenceData?.conferenceSolution?.name) {
      const provider = document.createElement("div");
      provider.className = "meeting-provider";
      provider.textContent = event.conferenceData.conferenceSolution.name;
      meetContent.appendChild(provider);
    }

    meetRow.appendChild(meetIcon);
    meetRow.appendChild(meetContent);
    meetSection.appendChild(meetRow);
    body.appendChild(meetSection);
  }

  // ---- Attendees Section ----
  if (event.attendees && event.attendees.length > 0) {
    const attSection = document.createElement("div");
    attSection.className = "section";
    const attRow = document.createElement("div");
    attRow.className = "section-row";

    const attIcon = document.createElement("div");
    attIcon.className = "section-icon";
    attIcon.textContent = "\uD83D\uDC65"; // people emoji

    const attContent = document.createElement("div");
    attContent.className = "section-content";

    const attLabel = document.createElement("div");
    attLabel.className = "section-label";
    attLabel.textContent = `Attendees (${event.attendees.length})`;
    attContent.appendChild(attLabel);

    const attList = document.createElement("div");
    attList.className = "attendees-list";

    for (const att of event.attendees) {
      const chip = document.createElement("div");
      chip.className = "attendee-chip";

      // Avatar
      const avatar = document.createElement("div");
      avatar.className = "attendee-avatar";
      avatar.textContent = getInitial(att.displayName, att.email);
      chip.appendChild(avatar);

      // Info
      const info = document.createElement("div");
      info.className = "attendee-info";

      const nameEl = document.createElement("div");
      nameEl.className = "attendee-name";
      let nameText = att.displayName || att.email;
      if (att.organizer) nameText += " (organizer)";
      if (att.self) nameText += " (you)";
      nameEl.textContent = nameText;
      info.appendChild(nameEl);

      if (att.displayName && att.email) {
        const emailEl = document.createElement("div");
        emailEl.className = "attendee-email";
        emailEl.textContent = att.email;
        info.appendChild(emailEl);
      }

      chip.appendChild(info);

      // Status indicator
      const status = getStatusIndicator(att.responseStatus);
      const statusEl = document.createElement("div");
      statusEl.className = "attendee-status";
      statusEl.textContent = status.symbol;
      statusEl.style.color = status.color;
      statusEl.style.fontWeight = "700";
      statusEl.title = att.responseStatus || "No response";
      chip.appendChild(statusEl);

      attList.appendChild(chip);
    }

    attContent.appendChild(attList);
    attRow.appendChild(attIcon);
    attRow.appendChild(attContent);
    attSection.appendChild(attRow);
    body.appendChild(attSection);
  }

  // ---- Organizer Section ----
  if (event.organizer && (!event.attendees || event.attendees.length === 0)) {
    const orgSection = document.createElement("div");
    orgSection.className = "section";
    const orgRow = document.createElement("div");
    orgRow.className = "section-row";

    const orgIcon = document.createElement("div");
    orgIcon.className = "section-icon";
    orgIcon.textContent = "\uD83D\uDC64"; // person emoji

    const orgContent = document.createElement("div");
    orgContent.className = "section-content";

    const orgLabel = document.createElement("div");
    orgLabel.className = "section-label";
    orgLabel.textContent = "Organizer";
    orgContent.appendChild(orgLabel);

    const orgValue = document.createElement("div");
    orgValue.className = "section-value organizer-section";
    const orgName = document.createElement("span");
    orgName.className = "organizer-name";
    orgName.textContent = event.organizer.displayName || event.organizer.email || "";
    orgValue.appendChild(orgName);
    if (event.organizer.displayName && event.organizer.email) {
      const orgEmail = document.createElement("span");
      orgEmail.textContent = ` (${event.organizer.email})`;
      orgEmail.style.color = "#70757a";
      orgValue.appendChild(orgEmail);
    }
    orgContent.appendChild(orgValue);

    orgRow.appendChild(orgIcon);
    orgRow.appendChild(orgContent);
    orgSection.appendChild(orgRow);
    body.appendChild(orgSection);
  }

  // ---- Recurrence Section ----
  if (event.recurrence && event.recurrence.length > 0) {
    const recSection = document.createElement("div");
    recSection.className = "section";
    const recRow = document.createElement("div");
    recRow.className = "section-row";

    const recIcon = document.createElement("div");
    recIcon.className = "section-icon";
    recIcon.textContent = "\uD83D\uDD01"; // repeat emoji

    const recContent = document.createElement("div");
    recContent.className = "section-content";

    const recLabel = document.createElement("div");
    recLabel.className = "section-label";
    recLabel.textContent = "Recurrence";
    recContent.appendChild(recLabel);

    const recValue = document.createElement("div");
    recValue.className = "section-value recurrence-text";
    recValue.textContent = formatRecurrence(event.recurrence);
    recContent.appendChild(recValue);

    recRow.appendChild(recIcon);
    recRow.appendChild(recContent);
    recSection.appendChild(recRow);
    body.appendChild(recSection);
  } else if (event.recurringEventId) {
    // This is an instance of a recurring event
    const recSection = document.createElement("div");
    recSection.className = "section";
    const recRow = document.createElement("div");
    recRow.className = "section-row";

    const recIcon = document.createElement("div");
    recIcon.className = "section-icon";
    recIcon.textContent = "\uD83D\uDD01"; // repeat emoji

    const recContent = document.createElement("div");
    recContent.className = "section-content";

    const recLabel = document.createElement("div");
    recLabel.className = "section-label";
    recLabel.textContent = "Recurrence";
    recContent.appendChild(recLabel);

    const recValue = document.createElement("div");
    recValue.className = "section-value recurrence-text";
    recValue.textContent = "This is part of a recurring event";
    recContent.appendChild(recValue);

    recRow.appendChild(recIcon);
    recRow.appendChild(recContent);
    recSection.appendChild(recRow);
    body.appendChild(recSection);
  }

  // ---- Action Bar ----
  const actionBar = document.createElement("div");
  actionBar.className = "action-bar";

  // Accept button
  const acceptBtn = document.createElement("button");
  acceptBtn.className = "action-btn accept";
  acceptBtn.textContent = "Accept";
  acceptBtn.addEventListener("click", () => handleRsvp(event, "accepted"));
  actionBar.appendChild(acceptBtn);

  // Decline button
  const declineBtn = document.createElement("button");
  declineBtn.className = "action-btn decline";
  declineBtn.textContent = "Decline";
  declineBtn.addEventListener("click", () => handleRsvp(event, "declined"));
  actionBar.appendChild(declineBtn);

  // Maybe button
  const maybeBtn = document.createElement("button");
  maybeBtn.className = "action-btn maybe";
  maybeBtn.textContent = "Maybe";
  maybeBtn.addEventListener("click", () => handleRsvp(event, "tentative"));
  actionBar.appendChild(maybeBtn);

  // Edit button (disabled)
  const editBtn = document.createElement("button");
  editBtn.className = "action-btn edit";
  editBtn.textContent = "Edit";
  editBtn.disabled = true;
  editBtn.title = "Editing is not available yet";
  actionBar.appendChild(editBtn);

  // Delete button
  const delBtn = document.createElement("button");
  delBtn.className = "action-btn delete";
  delBtn.textContent = "Delete";
  delBtn.addEventListener("click", () => showDeleteConfirm(event));
  actionBar.appendChild(delBtn);

  body.appendChild(actionBar);

  card.appendChild(body);
  cardContainer.appendChild(card);
}

// ---- Init ----
app = createGCalApp("Event Detail");

app.ontoolresult = (result: any) => {
  try {
    // Try parsing as { event: GCalEvent }
    const data = parseToolResult<{ event: GCalEvent }>(result);
    if (data.event) {
      renderEventCard(data.event);
      return;
    }
  } catch {
    // Not an event result
  }

  try {
    // Maybe it's a direct GCalEvent
    const data = parseToolResult<GCalEvent>(result);
    if (data.id && (data.start || data.summary)) {
      renderEventCard(data);
      return;
    }
  } catch {
    // Not a direct event either
  }

  try {
    // Maybe it's a ListEventsResult with a single event
    const data = parseToolResult<ListEventsResult>(result);
    if (data.events && data.events.length > 0) {
      renderEventCard(data.events[0]);
      return;
    }
  } catch {
    // Unrecognized result
  }

  // Show a helpful message instead of infinite loading
  cardContainer.innerHTML = `
    <div style="text-align:center;padding:48px 24px;color:#70757a;">
      <div style="font-size:48px;margin-bottom:16px;">📅</div>
      <div style="font-size:16px;font-weight:500;color:#3c4043;margin-bottom:8px;">No event data</div>
      <div style="font-size:13px;">Provide an <code>eventId</code> in the tool input, e.g.:<br>
      <code style="background:#f1f3f4;padding:2px 6px;border-radius:4px;">{"eventId": "abc123"}</code></div>
    </div>
  `;
};
