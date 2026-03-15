# Hosting & Testing Guide

How to run and test google-calendar-mcp-app with different MCP Apps hosts.

## MCPJam Inspector (Recommended for Development)

[MCPJam](https://www.mcpjam.com/) is a local inspector that renders MCP Apps UIs in your browser. No subscription needed.

```bash
# Terminal 1: Start the MCP server
export GOOGLE_OAUTH_CREDENTIALS=./gcp-oauth.keys.json
node build/index.js --transport http --port 3001 --host 0.0.0.0

# Terminal 2: Launch MCPJam
npx @mcpjam/inspector@latest
```

Open http://localhost:6274, click **Add Server → HTTP**, enter `http://127.0.0.1:3001`. Select any tool and call it — the interactive UI renders in the inspector.

### Known Issues with MCPJam

- **CSP violations**: If you see CSP warnings, they're usually cosmetic and don't affect rendering
- **Free LLM tier**: MCPJam's built-in Haiku model may fail on complex tool calls. Use the "Tools" page for direct tool testing

## Claude Desktop

Claude Desktop (macOS/Windows) has native MCP Apps support via stdio transport.

Add to your Claude Desktop config:

**Linux:** `~/.config/Claude/claude_desktop_config.json`
**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "google-calendar": {
      "command": "node",
      "args": ["/absolute/path/to/google-calendar-mcp-app/build/index.js"],
      "env": {
        "GOOGLE_OAUTH_CREDENTIALS": "/absolute/path/to/gcp-oauth.keys.json"
      }
    }
  }
}
```

Restart Claude Desktop after editing. Ask: *"What's on my calendar this week?"*

**Note:** The Linux Claude Desktop app is an Electron wrapper and does NOT support MCP Apps rendering. Use MCPJam or Goose on Linux.

## Claude.ai (Web — Text Only)

Claude.ai web shows text responses only (no UI rendering). To connect:

```bash
# Terminal 1: Start HTTP server
node build/index.js --transport http --port 3001 --host 0.0.0.0

# Terminal 2: Create a tunnel
npx cloudflared tunnel --url http://localhost:3001
```

Copy the tunnel URL → claude.ai → Settings → Connectors → Add custom connector.

## Cloudflare Tunnel Notes

Free tunnels (`trycloudflare.com`) are ephemeral — the URL changes every time you restart cloudflared. For persistent tunnels, use a named tunnel with a Cloudflare account.

**Troubleshooting:**
- If tunnel returns 404, kill cloudflared (`pkill -f cloudflared`), delete `~/.cloudflared/`, and restart
- Our server sets `Access-Control-Allow-Origin: *` for tunnel compatibility
- Session IDs pass through cloudflare correctly

## Device Deployment (Jihn HoloBox / Raspberry Pi)

For deploying as an MCP server on a device running the [Jihn](https://github.com/QuantGeekDev/jihn) agent platform:

### Option A: Run on Laptop, Device Connects via Tunnel

```bash
# On laptop
export GOOGLE_OAUTH_CREDENTIALS=./gcp-oauth.keys.json
node build/index.js --transport http --port 3001 --host 0.0.0.0
npx cloudflared tunnel --url http://localhost:3001

# On device (SSH)
cat > /opt/jihn/.jihn/mcp-servers.json << 'EOF'
{
  "servers": [{
    "id": "gcal",
    "url": "https://your-tunnel-url.trycloudflare.com",
    "name": "Google Calendar",
    "enabled": true,
    "transport": "streamable-http"
  }]
}
EOF
```

The Jihn runtime-worker hot-reloads `mcp-servers.json` within 500ms.

### Option B: Run on the Device Itself

```bash
# On laptop: rsync to device
rsync -az --exclude node_modules --exclude .git \
  . holobox:/opt/jihn/gcal-mcp/

# On device: install and run
ssh holobox
cd /opt/jihn/gcal-mcp
npm install --production
npm run build
node build/index.js --transport http --port 3001
```

Then add `http://127.0.0.1:3001` to the device's MCP config.

### OAuth Tokens on Headless Devices

The device needs Google Calendar OAuth tokens. Options:

1. **Authenticate on laptop, copy tokens:**
   ```bash
   scp ~/.config/google-calendar-mcp/tokens.json holobox:/home/jihn/.config/google-calendar-mcp/tokens.json
   ```

2. **Authenticate via the device's web UI** — use the `manage-accounts` tool through Jihn's chat interface

### MCP Apps Rendering on Jihn

Jihn's `McpUiModal` component renders MCP App UIs in sandboxed iframes. It implements the full MCP Apps protocol:

- Responds to `ui/initialize` with host capabilities
- Sends `ui/notifications/tool-result` with real calendar data
- Proxies `tools/call` requests back to the MCP server
- Handles `ui/open-link`, `ui/notifications/size-changed`
- Supports `ui/resource-teardown` for clean dismissal
- Auto-dismiss timer with activity reset

The UI renders as a modal overlay on both `/avatar` and `/kiosk` pages. TTS audio continues uninterrupted while the UI is displayed.

## VS Code (GitHub Copilot)

VS Code with GitHub Copilot supports MCP Apps. Add the server in VS Code's MCP settings.

## Goose

[Goose](https://block.github.io/goose/) supports MCP Apps on all platforms including Linux.

## Transport Modes

| Mode | Command | Use Case |
|------|---------|----------|
| stdio | `npm start` | Claude Desktop (direct process communication) |
| HTTP | `npm run start:http` | MCPJam, tunnels, device deployment |
| HTTP (public) | `npm run start:http:public` | Accessible from other machines on the network |

The HTTP transport uses session-based connections with `mcp-session-id` headers for multi-request handshakes.
