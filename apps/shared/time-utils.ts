/** Format a datetime string for display */
export function formatTime(dt: string | undefined): string {
  if (!dt) return "";
  const d = new Date(dt);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function formatTimeRange(start: string | undefined, end: string | undefined): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

export function formatDate(dt: string | undefined): string {
  if (!dt) return "";
  const d = new Date(dt);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export function formatDateShort(dt: string | undefined): string {
  if (!dt) return "";
  const d = new Date(dt);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function formatMonthYear(dt: Date): string {
  return dt.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function isToday(dt: string): boolean {
  const d = new Date(dt);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export function isTomorrow(dt: string): boolean {
  const d = new Date(dt);
  const tom = new Date();
  tom.setDate(tom.getDate() + 1);
  return d.toDateString() === tom.toDateString();
}

export function isAllDay(event: any): boolean {
  return !!(event.start?.date && !event.start?.dateTime);
}

export function getEventDateTime(event: any): { start: string; end: string } {
  return {
    start: event.start?.dateTime || event.start?.date || "",
    end: event.end?.dateTime || event.end?.date || "",
  };
}

/** Get fractional hour (0-24) for positioning */
export function getHourFraction(dt: string): number {
  const d = new Date(dt);
  return d.getHours() + d.getMinutes() / 60;
}

/** Get duration in minutes between two datetime strings */
export function getDurationMinutes(start: string, end: string): number {
  return (new Date(end).getTime() - new Date(start).getTime()) / 60000;
}

/** Get relative date label ("Today", "Tomorrow", or formatted date) */
export function getRelativeDateLabel(dt: string): string {
  if (isToday(dt)) return "Today";
  if (isTomorrow(dt)) return "Tomorrow";
  return formatDateShort(dt);
}

/** Format ISO date string as YYYY-MM-DD */
export function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

/** Get start of day ISO string */
export function startOfDay(d: Date): string {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s.toISOString();
}

/** Get end of day ISO string */
export function endOfDay(d: Date): string {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e.toISOString();
}

/** Get start of week (Sunday) */
export function startOfWeek(d: Date): Date {
  const s = new Date(d);
  s.setDate(s.getDate() - s.getDay());
  s.setHours(0, 0, 0, 0);
  return s;
}

/** Get start of month */
export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Get end of month */
export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

/** Add days to a date */
export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
