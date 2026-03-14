import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Search order: built files first (inlined JS/CSS), then dist, then source (fallback)
const APPS_DIST_DIRS = [
  join(__dirname, "apps"),              // build/apps/ (when running from build/)
  join(__dirname, "..", "dist", "apps"), // dist/apps/ (when running from build/)
  join(__dirname, "..", "..", "dist", "apps"), // dist/apps/ (when running from src/)
];

/** MIME type for MCP Apps HTML resources */
const RESOURCE_MIME_TYPE = "text/html;profile=mcp-app";

/** Mapping of tool names to their UI resource URIs */
export const TOOL_UI_MAP: Record<string, string> = {
  "list-events": "ui://gcal/upcoming",
  "search-events": "ui://gcal/agenda",
  "get-event": "ui://gcal/event-detail",
  "create-event": "ui://gcal/event-form",
  "update-event": "ui://gcal/event-form",
  "get-freebusy": "ui://gcal/freebusy",
};

/** All UI resources with their corresponding HTML file names */
const UI_RESOURCES: Array<{ uri: string; file: string }> = [
  { uri: "ui://gcal/day-view", file: "day-view" },
  { uri: "ui://gcal/week-view", file: "week-view" },
  { uri: "ui://gcal/month-view", file: "month-view" },
  { uri: "ui://gcal/event-detail", file: "event-detail" },
  { uri: "ui://gcal/event-form", file: "event-form" },
  { uri: "ui://gcal/upcoming", file: "upcoming" },
  { uri: "ui://gcal/freebusy", file: "freebusy" },
  { uri: "ui://gcal/agenda", file: "agenda" },
];

/** Load an HTML file from the apps directories */
function loadAppHtml(fileName: string): string | null {
  for (const dir of APPS_DIST_DIRS) {
    const possiblePaths = [
      join(dir, `${fileName}.html`),
      join(dir, fileName, "index.html"),
    ];

    for (const filePath of possiblePaths) {
      if (existsSync(filePath)) {
        return readFileSync(filePath, "utf-8");
      }
    }
  }

  return null;
}

/**
 * Register all MCP Apps UI resources on the server.
 * Each resource serves a bundled HTML file that renders in a sandboxed iframe.
 */
export function registerUIResources(server: McpServer): void {
  // Guard: server.resource may not exist in test environments with mock servers
  if (typeof server.resource !== "function") {
    return;
  }

  let loadedCount = 0;

  for (const resource of UI_RESOURCES) {
    const html = loadAppHtml(resource.file);

    if (!html) {
      continue;
    }

    // Register as a resource using the MCP SDK's resource API
    server.resource(
      resource.file, // resource name
      resource.uri,  // URI
      {
        description: `MCP App UI: ${resource.file}`,
        mimeType: RESOURCE_MIME_TYPE,
      },
      async () => ({
        contents: [
          {
            uri: resource.uri,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
          },
        ],
      })
    );

    loadedCount++;
  }

  if (loadedCount > 0) {
    process.stderr.write(
      `MCP Apps: ${loadedCount}/${UI_RESOURCES.length} UI resources registered.\n`
    );
  } else {
    process.stderr.write(
      `MCP Apps: No UI resources found. Run 'npm run build:apps' to build.\n`
    );
  }
}

/**
 * Get the _meta.ui object for a tool, if it has a UI resource.
 * Returns undefined if the tool has no associated UI.
 */
export function getToolUIMeta(toolName: string): { ui: { resourceUri: string; csp?: Record<string, string[]> } } | undefined {
  const uri = TOOL_UI_MAP[toolName];
  if (!uri) return undefined;
  return {
    ui: {
      resourceUri: uri,
      // Declare CSP: our apps are self-contained, no external resources needed
      csp: {
        resourceDomains: [],
        connectDomains: [],
      },
    },
  };
}
