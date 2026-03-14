import puppeteer from "puppeteer";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import http from "http";

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, "..", "dist", "apps", "clock", "index.html"), "utf-8");

// Intercept postMessage at the lowest level
const mockScript = `<script>
const _origPostMessage = window.postMessage.bind(window);
window.postMessage = function(msg, targetOrigin) {
  // Let the message go through normally (transport receives its own messages)
  _origPostMessage(msg, targetOrigin || '*');

  // Also intercept and respond
  if (!msg || !msg.jsonrpc) return;

  if (msg.method === 'ui/initialize') {
    setTimeout(() => _origPostMessage({
      jsonrpc: '2.0', id: msg.id,
      result: {
        hostCapabilities: { tools: {}, openLinks: {} },
        hostInfo: { name: 'ss', version: '1.0' },
        hostContext: { theme: 'light', platform: 'web' },
        protocolVersion: '2026-01-26'
      }
    }, '*'), 20);
  }

  if (msg.method === 'ui/notifications/initialized') {
    console.log('[HOST] App initialized, sending tool result');
    setTimeout(() => _origPostMessage({
      jsonrpc: '2.0',
      method: 'ui/notifications/tool-result',
      params: { content: [{ type: 'text', text: JSON.stringify({
        currentTime: "2026-03-17T14:32:45+01:00",
        timezone: "Europe/Madrid",
        offset: "+01:00",
        isDST: false,
        dayOfWeek: "Tuesday"
      }) }] }
    }, '*'), 50);
    window.__screenshotReady = true;
  }

  if (msg.method === 'tools/call') {
    console.log('[HOST] Tool call intercepted');
    setTimeout(() => _origPostMessage({
      jsonrpc: '2.0', id: msg.id,
      result: { content: [{ type: 'text', text: JSON.stringify({
        currentTime: "2026-03-17T14:32:45+01:00",
        timezone: "Europe/Madrid", offset: "+01:00",
        isDST: false, dayOfWeek: "Tuesday"
      }) }] }
    }, '*'), 50);
  }
};
console.log('[HOST] postMessage interceptor installed');
</script>`;

const patched = html.replace(/<script type="module">/, mockScript + '\n<script type="module">');

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(patched);
});
server.listen(9444);

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
page.on("console", msg => {
  if (msg.type() !== "debug") console.log(`[${msg.type()}]`, msg.text());
});
page.on("pageerror", err => console.log("[ERROR]", err.message));

await page.goto("http://localhost:9444/", { waitUntil: "networkidle0", timeout: 10000 });
await new Promise(r => setTimeout(r, 3000));

await page.screenshot({ path: "screenshots/debug-clock.png" });
console.log("Done — check screenshots/debug-clock.png");

await browser.close();
server.close();
