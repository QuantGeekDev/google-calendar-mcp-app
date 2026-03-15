# How MCP Apps Works

## What Are MCP Apps?

[MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview) is an official extension to the Model Context Protocol that lets MCP servers return interactive HTML interfaces alongside their normal text responses. Instead of plain JSON, users see calendar views, forms, and visualizations rendered directly in the conversation.

The extension was announced in January 2026 and is supported by Claude Desktop, ChatGPT, VS Code GitHub Copilot, Goose, Postman, and MCPJam.

## How This Server Uses MCP Apps

### 1. Tool Registration with UI Metadata

Each tool declares a `_meta.ui.resourceUri` field pointing to a `ui://` resource:

```typescript
// In src/tools/registry.ts
server.registerTool("list-events", {
  description: "List events from calendars",
  inputSchema: { /* ... */ },
  _meta: {
    ui: {
      resourceUri: "ui://gcal/upcoming",  // ← Points to the UI resource
      csp: { resourceDomains: [], connectDomains: [] }
    }
  }
}, handler);
```

The mapping of tool → UI is defined in `src/apps/ui-resources.ts`:

```typescript
export const TOOL_UI_MAP = {
  "list-events": "ui://gcal/upcoming",
  "search-events": "ui://gcal/agenda",
  "get-event": "ui://gcal/event-detail",
  "create-event": "ui://gcal/event-form",
  // ... 13 tools, 15 UI resources
};
```

### 2. UI Resource Registration

The server registers each UI as a `ui://` resource with MIME type `text/html;profile=mcp-app`:

```typescript
server.resource(
  "upcoming",              // Resource name
  "ui://gcal/upcoming",    // URI
  { mimeType: "text/html;profile=mcp-app" },
  async () => ({
    contents: [{
      uri: "ui://gcal/upcoming",
      mimeType: "text/html;profile=mcp-app",
      text: readFileSync("dist/apps/upcoming/index.html", "utf-8")
    }]
  })
);
```

Each HTML file is a self-contained single-file app (bundled by Vite + vite-plugin-singlefile) with all CSS and JS inlined.

### 3. The Protocol Flow

```
User: "What's on my calendar this week?"

1. Host (Claude/MCPJam) calls tools/list
   → Server returns tool definitions with _meta.ui.resourceUri

2. LLM decides to call list-events tool
   → Host sends tools/call request
   → Server returns event data as text content

3. Host sees _meta.ui.resourceUri on the tool
   → Host sends resources/read for ui://gcal/upcoming
   → Server returns the bundled HTML

4. Host renders the HTML in a sandboxed iframe

5. Inside the iframe, the App class initiates:
   → App sends ui/initialize via postMessage
   → Host responds with capabilities + theme
   → App sends ui/notifications/initialized
   → Host sends ui/notifications/tool-result with the event data
   → App renders the Upcoming Events UI

6. User interacts with the UI:
   → Click "Load more" → App calls tools/call via postMessage
   → Host proxies to server → Server returns more events
   → App updates the display
```

### 4. The PostMessage Protocol

The iframe communicates with the host via `window.parent.postMessage()`. The protocol is JSON-RPC 2.0:

**App → Host:**
- `ui/initialize` — Request initialization handshake
- `ui/notifications/initialized` — Confirm initialization complete
- `ui/notifications/size-changed` — Report content size changes
- `tools/call` — Call a tool on the MCP server
- `ui/open-link` — Request to open a URL in the browser
- `ui/message` — Send a message to trigger agent follow-up
- `logging/message` — Send log messages

**Host → App:**
- Initialize response — Host capabilities, theme, display mode
- `ui/notifications/tool-result` — The tool's execution result data
- `ui/notifications/tool-input` — The tool's input arguments
- `ui/notifications/host-context-changed` — Theme or viewport changes
- `ui/notifications/tool-cancelled` — Tool execution was cancelled
- `ui/resource-teardown` — Host is closing the app

### 5. How the UI Apps Are Built

Each UI is a standalone HTML+TypeScript app in `apps/<name>/`:

```
apps/upcoming/
  index.html       ← HTML with inline <style> (CSS variables for theming)
  src/app.ts       ← TypeScript using App class from @modelcontextprotocol/ext-apps
```

The shared code in `apps/shared/` provides:
- `gcal-app.ts` — `createGCalApp()` factory, typed tool call wrappers, theme detection
- `time-utils.ts` — Date/time formatting helpers
- `components.ts` — Reusable UI components (cards, badges, buttons, toasts)

During build, Vite bundles each app into a single HTML file with all JS/CSS inlined:
```bash
npm run build:apps  # → dist/apps/<name>/index.html (~270KB each)
```

The server build (`npm run build:server`) copies these to `build/apps/` where the running server reads them.

### 6. Auto-Fetch Fallback

When a tool is called with empty or invalid arguments, the UI catches the error and auto-fetches data:

```typescript
app.ontoolresult = (result) => {
  try {
    const data = parseToolResult(result);
    renderEvents(data);
  } catch {
    // Tool returned error — auto-fetch with defaults
    fetchUpcoming();
  }
};
```

This means UIs work even when called with `{}` input in test harnesses like MCPJam.

## Key Files

| File | Purpose |
|------|---------|
| `src/apps/ui-resources.ts` | Tool → UI mapping, resource registration |
| `src/tools/registry.ts` | Tool definitions with `_meta.ui` |
| `apps/shared/gcal-app.ts` | App factory, PostMessageTransport, theme detection |
| `apps/shared/components.ts` | Reusable UI components |
| `apps/shared/time-utils.ts` | Date/time formatting |
| `apps/<name>/index.html` | UI HTML with inline styles |
| `apps/<name>/src/app.ts` | UI logic |
| `vite.apps.config.ts` | Vite config for single-file bundling |
| `scripts/build-apps.js` | Build script for all 15 apps |

## Compatibility

- **MCP Apps hosts** (Claude Desktop, MCPJam, Goose, VS Code) — Full interactive UI
- **Text-only hosts** (Claude Code, Claude.ai web) — Normal text responses (backward compatible)
- **MCP clients without Apps support** — `_meta.ui` is ignored, tools work normally
