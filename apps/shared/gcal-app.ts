import { App, PostMessageTransport } from "@modelcontextprotocol/ext-apps";

export interface GCalEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  startDayOfWeek?: string;
  status?: string;
  htmlLink?: string;
  colorId?: string;
  creator?: { email?: string; displayName?: string; self?: boolean };
  organizer?: { email?: string; displayName?: string; self?: boolean };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
    self?: boolean;
    organizer?: boolean;
  }>;
  recurrence?: string[];
  recurringEventId?: string;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string; uri?: string; label?: string }>;
    conferenceSolution?: { name?: string };
  };
  hangoutLink?: string;
  calendarId?: string;
  accountId?: string;
  eventType?: string;
}

export interface ListEventsResult {
  events: GCalEvent[];
  totalCount: number;
  calendars?: string[];
  accounts?: string[];
  warnings?: string[];
}

export interface FreeBusyResult {
  timeMin: string;
  timeMax: string;
  calendars: Record<string, { busy: Array<{ start: string; end: string }> }>;
}

export interface CalendarInfo {
  id: string;
  summary?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  primary?: boolean;
  accessRole?: string;
}

export interface ColorDefinition {
  background: string;
  foreground: string;
}

/** Apply theme from host context */
function applyTheme(theme: string | undefined): void {
  const t = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", t);
}

/** Create and connect the MCP App, with auto theme detection */
export function createGCalApp(name: string): App {
  const app = new App({ name, version: "0.1.0" });
  const transport = new PostMessageTransport(window.parent);
  app.connect(transport).then(() => {
    // Apply host theme after initialization
    const ctx = (app as any)._hostContext;
    if (ctx?.theme) applyTheme(ctx.theme);
  }).catch(() => {});

  // Listen for theme changes from host
  app.setNotificationHandler(
    { method: "ui/notifications/host-context-changed" } as any,
    async (params: any) => {
      if (params?.theme) applyTheme(params.theme);
    }
  );

  return app;
}

/** Open an external link via the host */
export async function openLink(app: App, url: string): Promise<void> {
  try {
    await app.sendOpenLink({ url });
  } catch {
    // Fallback: some hosts may not support opening links
    console.warn("Host does not support opening links");
  }
}

/** Parse tool result text content into typed data */
export function parseToolResult<T>(result: any): T {
  // Check for error responses
  if (result?.isError) throw new Error("Tool returned an error");
  const text = result?.content?.find((c: any) => c.type === "text")?.text;
  if (!text) throw new Error("No text content in tool result");
  return JSON.parse(text) as T;
}

/** Check if a tool result is an error */
export function isToolError(result: any): boolean {
  return !!(result?.isError);
}

/** Call list-events tool */
export async function listEvents(
  app: App,
  args: Record<string, any>
): Promise<ListEventsResult> {
  const result = await app.callServerTool({ name: "list-events", arguments: args });
  return parseToolResult<ListEventsResult>(result);
}

/** Call get-event tool */
export async function getEvent(
  app: App,
  eventId: string,
  calendarId?: string
): Promise<{ event: GCalEvent }> {
  const args: Record<string, any> = { eventId };
  if (calendarId) args.calendarId = calendarId;
  const result = await app.callServerTool({ name: "get-event", arguments: args });
  return parseToolResult<{ event: GCalEvent }>(result);
}

/** Call create-event tool */
export async function createEvent(
  app: App,
  args: Record<string, any>
): Promise<{ event: GCalEvent }> {
  const result = await app.callServerTool({ name: "create-event", arguments: args });
  return parseToolResult<{ event: GCalEvent }>(result);
}

/** Call update-event tool */
export async function updateEvent(
  app: App,
  args: Record<string, any>
): Promise<{ event: GCalEvent }> {
  const result = await app.callServerTool({ name: "update-event", arguments: args });
  return parseToolResult<{ event: GCalEvent }>(result);
}

/** Call delete-event tool */
export async function deleteEvent(
  app: App,
  eventId: string,
  calendarId?: string
): Promise<any> {
  const args: Record<string, any> = { eventId };
  if (calendarId) args.calendarId = calendarId;
  const result = await app.callServerTool({ name: "delete-event", arguments: args });
  return parseToolResult<any>(result);
}

/** Call respond-to-event tool */
export async function respondToEvent(
  app: App,
  eventId: string,
  response: string,
  calendarId?: string
): Promise<any> {
  const args: Record<string, any> = { eventId, response };
  if (calendarId) args.calendarId = calendarId;
  const result = await app.callServerTool({ name: "respond-to-event", arguments: args });
  return parseToolResult<any>(result);
}

/** Call search-events tool */
export async function searchEvents(
  app: App,
  query: string,
  args?: Record<string, any>
): Promise<ListEventsResult> {
  const result = await app.callServerTool({
    name: "search-events",
    arguments: { query, ...args },
  });
  return parseToolResult<ListEventsResult>(result);
}

/** Call get-freebusy tool */
export async function getFreeBusy(
  app: App,
  args: Record<string, any>
): Promise<FreeBusyResult> {
  const result = await app.callServerTool({ name: "get-freebusy", arguments: args });
  return parseToolResult<FreeBusyResult>(result);
}

/** Call list-calendars tool */
export async function listCalendars(
  app: App
): Promise<{ calendars: CalendarInfo[]; totalCount: number }> {
  const result = await app.callServerTool({ name: "list-calendars", arguments: {} });
  return parseToolResult<{ calendars: CalendarInfo[]; totalCount: number }>(result);
}

/** Call list-colors tool */
export async function listColors(
  app: App
): Promise<{ event: Record<string, ColorDefinition>; calendar: Record<string, ColorDefinition> }> {
  const result = await app.callServerTool({ name: "list-colors", arguments: {} });
  return parseToolResult<any>(result);
}

/** Get a meeting link from event data */
export function getMeetingLink(event: GCalEvent): string | null {
  if (event.hangoutLink) return event.hangoutLink;
  const videoEntry = event.conferenceData?.entryPoints?.find(
    (ep) => ep.entryPointType === "video"
  );
  return videoEntry?.uri || null;
}

/** Google Calendar event color palette */
export const EVENT_COLORS: Record<string, string> = {
  "1": "#7986cb",  // Lavender
  "2": "#33b679",  // Sage
  "3": "#8e24aa",  // Grape
  "4": "#e67c73",  // Flamingo
  "5": "#f6bf26",  // Banana
  "6": "#f4511e",  // Tangerine
  "7": "#039be5",  // Peacock
  "8": "#616161",  // Graphite
  "9": "#3f51b5",  // Blueberry
  "10": "#0b8043", // Basil
  "11": "#d50000", // Tomato
};

export function getEventColor(event: GCalEvent): string {
  if (event.colorId && EVENT_COLORS[event.colorId]) return EVENT_COLORS[event.colorId];
  return "#039be5"; // Default peacock blue
}
