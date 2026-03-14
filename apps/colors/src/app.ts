import { createGCalApp, parseToolResult, listColors, ColorDefinition, EVENT_COLORS } from "../../shared/gcal-app";
import { escapeHtml, renderColorSwatch, renderSpinner, renderEmptyState, showToast, SHARED_COMPONENT_CSS } from "../../shared/components";

// Inject shared CSS
const styleEl = document.createElement("style");
styleEl.textContent = SHARED_COMPONENT_CSS;
document.head.appendChild(styleEl);

const appEl = document.getElementById("app")!;

const EVENT_COLOR_NAMES: Record<string, string> = {
  "1": "Lavender",
  "2": "Sage",
  "3": "Grape",
  "4": "Flamingo",
  "5": "Banana",
  "6": "Tangerine",
  "7": "Peacock",
  "8": "Graphite",
  "9": "Blueberry",
  "10": "Basil",
  "11": "Tomato",
};

interface ColorsResult {
  event: Record<string, ColorDefinition>;
  calendar: Record<string, ColorDefinition>;
}

function copyColorId(id: string): void {
  navigator.clipboard.writeText(id).then(() => {
    showToast(`Copied color ID: ${id}`, "success");
  }).catch(() => {
    // Fallback for environments without clipboard API
    showToast(`Color ID: ${id}`, "info");
  });
}

// Expose to global scope for onclick handlers
(window as any).__copyColorId = copyColorId;

function renderColorCard(id: string, color: ColorDefinition, name: string): string {
  const bgColor = color.background;
  const hexDisplay = escapeHtml(bgColor);
  const safeName = escapeHtml(name);

  return `
    <div class="cp-color-card" onclick="__copyColorId('${escapeHtml(id)}')" title="Click to copy ID: ${escapeHtml(id)}">
      <div class="cp-swatch-lg" style="background:${bgColor};"></div>
      <div class="cp-color-name">${safeName}</div>
      <div class="cp-color-hex">${hexDisplay}</div>
      <div class="cp-color-id">ID: ${escapeHtml(id)}</div>
    </div>
  `;
}

function render(data: ColorsResult): void {
  let html = "";

  // Event Colors section
  const eventKeys = Object.keys(data.event || {}).sort((a, b) => parseInt(a) - parseInt(b));
  if (eventKeys.length > 0) {
    html += `<div class="cp-section-title">Event Colors</div>`;
    html += `<div class="cp-grid">`;
    for (const id of eventKeys) {
      const colorDef = data.event[id];
      const name = EVENT_COLOR_NAMES[id] || `Color ${id}`;
      html += renderColorCard(id, colorDef, name);
    }
    html += `</div>`;
  }

  // Calendar Colors section
  const calKeys = Object.keys(data.calendar || {}).sort((a, b) => parseInt(a) - parseInt(b));
  if (calKeys.length > 0) {
    html += `<div class="cp-section-title">Calendar Colors</div>`;
    html += `<div class="cp-grid">`;
    for (const id of calKeys) {
      const colorDef = data.calendar[id];
      const name = `Color ${id}`;
      html += renderColorCard(id, colorDef, name);
    }
    html += `</div>`;
  }

  if (!eventKeys.length && !calKeys.length) {
    html = renderEmptyState("No colors available", "🎨");
  }

  appEl.innerHTML = html;
}

function showLoading(): void {
  appEl.innerHTML = renderSpinner("Loading colors...");
}

async function autoFetch(): Promise<void> {
  showLoading();
  try {
    const data = await listColors(app);
    render(data);
  } catch (err) {
    appEl.innerHTML = renderEmptyState("Failed to load colors", "⚠️");
  }
}

const app = createGCalApp("Color Palette");

app.ontoolresult = (result: any) => {
  try {
    const data = parseToolResult<ColorsResult>(result);
    render(data);
  } catch {
    autoFetch();
  }
};

autoFetch();
