import { App } from "@modelcontextprotocol/ext-apps";
import {
  createGCalApp,
  parseToolResult,
  createEvent,
  updateEvent,
  listCalendars,
  listColors,
  GCalEvent,
  CalendarInfo,
  ColorDefinition,
  EVENT_COLORS,
} from "../../shared/gcal-app";
import {
  isAllDay,
  toISODate,
} from "../../shared/time-utils";

// ---- State ----
let editMode = false;
let editEventId: string | null = null;
let editCalendarId: string | null = null;
let selectedColorId: string | null = null;
let attendees: string[] = [];
let calendars: CalendarInfo[] = [];
let colorMap: Record<string, ColorDefinition> = {};

// ---- DOM Elements ----
const formTitle = document.getElementById("formTitle") as HTMLHeadingElement;
const eventTitle = document.getElementById("eventTitle") as HTMLInputElement;
const startDate = document.getElementById("startDate") as HTMLInputElement;
const startTime = document.getElementById("startTime") as HTMLInputElement;
const endDate = document.getElementById("endDate") as HTMLInputElement;
const endTime = document.getElementById("endTime") as HTMLInputElement;
const allDayToggle = document.getElementById("allDayToggle") as HTMLInputElement;
const eventLocation = document.getElementById("eventLocation") as HTMLInputElement;
const eventDescription = document.getElementById("eventDescription") as HTMLTextAreaElement;
const calendarSelect = document.getElementById("calendarSelect") as HTMLSelectElement;
const colorPicker = document.getElementById("colorPicker") as HTMLDivElement;
const attendeeInput = document.getElementById("attendeeInput") as HTMLInputElement;
const addAttendeeBtn = document.getElementById("addAttendeeBtn") as HTMLButtonElement;
const attendeeChips = document.getElementById("attendeeChips") as HTMLDivElement;
const recurrenceSelect = document.getElementById("recurrenceSelect") as HTMLSelectElement;
const cancelBtn = document.getElementById("cancelBtn") as HTMLButtonElement;
const saveBtn = document.getElementById("saveBtn") as HTMLButtonElement;
const statusMessage = document.getElementById("statusMessage") as HTMLDivElement;
const loadingOverlay = document.getElementById("loadingOverlay") as HTMLDivElement;

// ---- App Init ----
const app = createGCalApp("Event Form");

app.ontoolresult = (result: any) => {
  try {
    const data = parseToolResult<any>(result);
    if (data && data.event && data.event.id) {
      enterEditMode(data.event as GCalEvent);
    }
  } catch {
    // No event data in result, stay in create mode
  }
};

// ---- Helpers ----

function roundToNextHalfHour(d: Date): Date {
  const result = new Date(d);
  const minutes = result.getMinutes();
  if (minutes <= 30) {
    result.setMinutes(30, 0, 0);
  } else {
    result.setHours(result.getHours() + 1, 0, 0, 0);
  }
  return result;
}

function toDateInputValue(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTimeInputValue(d: Date): string {
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function showStatus(message: string, type: "error" | "success") {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
}

function clearStatus() {
  statusMessage.className = "status-message";
  statusMessage.textContent = "";
}

function showLoading(show: boolean) {
  loadingOverlay.classList.toggle("visible", show);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ---- Default values for Create mode ----

function setCreateDefaults() {
  formTitle.textContent = "New Event";
  editMode = false;
  editEventId = null;
  editCalendarId = null;
  selectedColorId = null;
  attendees = [];

  const now = new Date();
  const start = roundToNextHalfHour(now);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  startDate.value = toDateInputValue(start);
  startTime.value = toTimeInputValue(start);
  endDate.value = toDateInputValue(end);
  endTime.value = toTimeInputValue(end);
  allDayToggle.checked = false;
  toggleTimeInputs(true);

  eventTitle.value = "";
  eventLocation.value = "";
  eventDescription.value = "";
  recurrenceSelect.value = "";

  renderAttendeeChips();
  renderColorPicker();
}

// ---- Edit Mode ----

function enterEditMode(event: GCalEvent) {
  formTitle.textContent = "Edit Event";
  editMode = true;
  editEventId = event.id;
  editCalendarId = event.calendarId || null;

  eventTitle.value = event.summary || "";
  eventLocation.value = event.location || "";
  eventDescription.value = event.description || "";

  const allDay = isAllDay(event);
  allDayToggle.checked = allDay;
  toggleTimeInputs(!allDay);

  if (allDay) {
    startDate.value = event.start.date || "";
    endDate.value = event.end.date || "";
    startTime.value = "";
    endTime.value = "";
  } else {
    const startDt = event.start.dateTime ? new Date(event.start.dateTime) : new Date();
    const endDt = event.end.dateTime ? new Date(event.end.dateTime) : new Date();
    startDate.value = toDateInputValue(startDt);
    startTime.value = toTimeInputValue(startDt);
    endDate.value = toDateInputValue(endDt);
    endTime.value = toTimeInputValue(endDt);
  }

  // Calendar
  if (event.calendarId) {
    calendarSelect.value = event.calendarId;
  }

  // Color
  selectedColorId = event.colorId || null;
  renderColorPicker();

  // Attendees
  attendees = (event.attendees || [])
    .filter((a) => !a.self)
    .map((a) => a.email);
  renderAttendeeChips();

  // Recurrence
  if (event.recurrence && event.recurrence.length > 0) {
    const rrule = event.recurrence[0];
    if (rrule.includes("FREQ=DAILY")) recurrenceSelect.value = "RRULE:FREQ=DAILY";
    else if (rrule.includes("FREQ=WEEKLY")) recurrenceSelect.value = "RRULE:FREQ=WEEKLY";
    else if (rrule.includes("FREQ=MONTHLY")) recurrenceSelect.value = "RRULE:FREQ=MONTHLY";
    else if (rrule.includes("FREQ=YEARLY")) recurrenceSelect.value = "RRULE:FREQ=YEARLY";
    else recurrenceSelect.value = "";
  } else {
    recurrenceSelect.value = "";
  }
}

// ---- All-day toggle ----

function toggleTimeInputs(showTime: boolean) {
  const timeInputs = document.querySelectorAll<HTMLInputElement>(".time-input");
  timeInputs.forEach((input) => {
    input.style.display = showTime ? "" : "none";
  });
  // Also hide/show the separators adjacent to time inputs
  const separators = document.querySelectorAll<HTMLSpanElement>(".datetime-separator");
  separators.forEach((sep) => {
    sep.style.display = showTime ? "" : "none";
  });
}

allDayToggle.addEventListener("change", () => {
  toggleTimeInputs(!allDayToggle.checked);
});

// ---- Calendar dropdown ----

async function loadCalendars() {
  try {
    const result = await listCalendars(app);
    calendars = result.calendars || [];
    calendarSelect.innerHTML = "";

    if (calendars.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No calendars available";
      calendarSelect.appendChild(opt);
      return;
    }

    calendars.forEach((cal) => {
      const opt = document.createElement("option");
      opt.value = cal.id;
      opt.textContent = cal.summary || cal.id;
      if (cal.primary) opt.selected = true;
      calendarSelect.appendChild(opt);
    });
  } catch (err) {
    calendarSelect.innerHTML = '<option value="">Failed to load calendars</option>';
  }
}

// ---- Color picker ----

async function loadColors() {
  try {
    const result = await listColors(app);
    colorMap = result.event || {};
    renderColorPicker();
  } catch {
    // Fall back to built-in color palette
    colorMap = {};
    Object.entries(EVENT_COLORS).forEach(([id, bg]) => {
      colorMap[id] = { background: bg, foreground: "#ffffff" };
    });
    renderColorPicker();
  }
}

function renderColorPicker() {
  colorPicker.innerHTML = "";

  const colors = Object.keys(colorMap).length > 0 ? colorMap : null;
  const palette: Record<string, string> = colors
    ? Object.fromEntries(Object.entries(colors).map(([id, c]) => [id, c.background]))
    : EVENT_COLORS;

  // Add "default" (no color) dot
  const defaultDot = document.createElement("div");
  defaultDot.className = `color-dot${selectedColorId === null ? " selected" : ""}`;
  defaultDot.style.backgroundColor = "#039be5";
  defaultDot.title = "Default";
  defaultDot.addEventListener("click", () => {
    selectedColorId = null;
    renderColorPicker();
  });
  colorPicker.appendChild(defaultDot);

  Object.entries(palette).forEach(([id, bg]) => {
    const dot = document.createElement("div");
    dot.className = `color-dot${selectedColorId === id ? " selected" : ""}`;
    dot.style.backgroundColor = bg;
    dot.title = `Color ${id}`;
    dot.addEventListener("click", () => {
      selectedColorId = id;
      renderColorPicker();
    });
    colorPicker.appendChild(dot);
  });
}

// ---- Attendees ----

function renderAttendeeChips() {
  attendeeChips.innerHTML = "";
  attendees.forEach((email, index) => {
    const chip = document.createElement("div");
    chip.className = "attendee-chip";

    const emailSpan = document.createElement("span");
    emailSpan.textContent = email;
    chip.appendChild(emailSpan);

    const removeBtn = document.createElement("button");
    removeBtn.className = "attendee-chip-remove";
    removeBtn.innerHTML = "&#215;";
    removeBtn.title = "Remove";
    removeBtn.addEventListener("click", () => {
      attendees.splice(index, 1);
      renderAttendeeChips();
    });
    chip.appendChild(removeBtn);

    attendeeChips.appendChild(chip);
  });
}

function addAttendee() {
  const email = attendeeInput.value.trim();
  if (!email) return;

  if (!isValidEmail(email)) {
    showStatus("Please enter a valid email address.", "error");
    return;
  }

  if (attendees.includes(email)) {
    showStatus("This attendee has already been added.", "error");
    return;
  }

  clearStatus();
  attendees.push(email);
  attendeeInput.value = "";
  renderAttendeeChips();
}

attendeeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addAttendee();
  }
});

addAttendeeBtn.addEventListener("click", () => {
  addAttendee();
});

// ---- Cancel ----

cancelBtn.addEventListener("click", () => {
  clearStatus();
  setCreateDefaults();
});

// ---- Save ----

saveBtn.addEventListener("click", async () => {
  clearStatus();

  const title = eventTitle.value.trim();
  if (!title) {
    showStatus("Title is required.", "error");
    eventTitle.focus();
    return;
  }

  const isAllDayEvent = allDayToggle.checked;

  // Build start/end
  let startVal: string;
  let endVal: string;

  if (isAllDayEvent) {
    startVal = startDate.value;
    endVal = endDate.value;

    if (!startVal) {
      showStatus("Start date is required.", "error");
      return;
    }
    if (!endVal) {
      endVal = startVal;
    }

    // For all-day events, end date in Google Calendar API should be the day AFTER the last day
    const endDateObj = new Date(endVal + "T00:00:00");
    endDateObj.setDate(endDateObj.getDate() + 1);
    endVal = toDateInputValue(endDateObj);
  } else {
    if (!startDate.value || !startTime.value) {
      showStatus("Start date and time are required.", "error");
      return;
    }
    if (!endDate.value || !endTime.value) {
      showStatus("End date and time are required.", "error");
      return;
    }

    startVal = `${startDate.value}T${startTime.value}:00`;
    endVal = `${endDate.value}T${endTime.value}:00`;

    if (new Date(endVal) <= new Date(startVal)) {
      showStatus("End time must be after start time.", "error");
      return;
    }
  }

  const args: Record<string, any> = {
    summary: title,
  };

  if (isAllDayEvent) {
    args.startDate = startDate.value;
    args.endDate = endVal;
  } else {
    args.startDateTime = startVal;
    args.endDateTime = endVal;
  }

  if (eventLocation.value.trim()) {
    args.location = eventLocation.value.trim();
  }

  if (eventDescription.value.trim()) {
    args.description = eventDescription.value.trim();
  }

  const calId = calendarSelect.value;
  if (calId) {
    args.calendarId = calId;
  }

  if (selectedColorId) {
    args.colorId = selectedColorId;
  }

  if (attendees.length > 0) {
    args.attendees = attendees;
  }

  const recurrence = recurrenceSelect.value;
  if (recurrence) {
    args.recurrence = [recurrence];
  }

  showLoading(true);
  saveBtn.disabled = true;

  try {
    if (editMode && editEventId) {
      args.eventId = editEventId;
      if (editCalendarId) {
        args.calendarId = editCalendarId;
      }
      await updateEvent(app, args);
      showStatus("Event updated successfully.", "success");
    } else {
      await createEvent(app, args);
      showStatus("Event created successfully.", "success");
    }
  } catch (err: any) {
    const message = err?.message || "An error occurred while saving the event.";
    showStatus(message, "error");
  } finally {
    showLoading(false);
    saveBtn.disabled = false;
  }
});

// ---- Sync start/end dates ----
startDate.addEventListener("change", () => {
  if (!endDate.value || endDate.value < startDate.value) {
    endDate.value = startDate.value;
  }
});

startTime.addEventListener("change", () => {
  if (startDate.value === endDate.value && endTime.value && endTime.value <= startTime.value) {
    // Push end time to 1 hour after start time
    const [h, m] = startTime.value.split(":").map(Number);
    const endH = h + 1;
    if (endH < 24) {
      endTime.value = `${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }
});

// ---- Init ----

setCreateDefaults();
loadCalendars();
loadColors();
