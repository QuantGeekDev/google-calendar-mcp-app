# Theming

All 15 UI screens support light and dark mode via CSS custom properties.

## How Theme Detection Works

### 1. Host Theme (MCP Apps Protocol)

When the app connects, the host sends its theme in the `ui/initialize` response:

```json
{
  "hostContext": {
    "theme": "dark",
    "platform": "web"
  }
}
```

Our `createGCalApp()` function reads this and sets `data-theme` on the document:

```typescript
// apps/shared/gcal-app.ts
app.connect(transport).then(() => {
  const ctx = (app as any)._hostContext;
  if (ctx?.theme) {
    document.documentElement.setAttribute("data-theme", ctx.theme);
  }
});
```

### 2. System Preference Fallback

If the host doesn't send a theme (or the app isn't in an MCP Apps host), CSS `prefers-color-scheme` media query kicks in:

```css
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #1f1f1f;
    /* ... dark theme tokens */
  }
}
```

### 3. Live Theme Changes

The app listens for `ui/notifications/host-context-changed` to update the theme when the host switches:

```typescript
app.setNotificationHandler(
  { method: "ui/notifications/host-context-changed" },
  async (params) => {
    if (params?.theme) applyTheme(params.theme);
  }
);
```

## CSS Custom Properties

### Light Theme (Default)

```css
:root {
  --bg: #ffffff;
  --bg-secondary: #f8f9fa;
  --bg-hover: #f1f3f4;
  --bg-active: #e8eaed;
  --text-primary: #3c4043;
  --text-secondary: #70757a;
  --text-icon: #5f6368;
  --border: #dadce0;
  --border-light: #e8eaed;
  --accent: #1a73e8;
  --accent-hover: #1765cc;
  --accent-light: #e8f0fe;
  --red: #d93025;
  --red-light: #fce8e6;
  --green: #0b8043;
  --green-light: #e6f4ea;
  --yellow: #f9ab00;
  --current-time: #ea4335;
  --shadow-sm: 0 1px 2px 0 rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15);
  --shadow-md: 0 1px 3px 0 rgba(60,64,67,.3), 0 4px 8px 3px rgba(60,64,67,.15);
  --card-bg: #ffffff;
}
```

### Dark Theme

```css
[data-theme="dark"] {
  --bg: #1f1f1f;
  --bg-secondary: #2d2d2d;
  --bg-hover: #3c3c3c;
  --bg-active: #4a4a4a;
  --text-primary: #e8eaed;
  --text-secondary: #9aa0a6;
  --text-icon: #9aa0a6;
  --border: #3c4043;
  --border-light: #3c4043;
  --accent: #8ab4f8;
  --accent-hover: #aecbfa;
  --accent-light: #1a3a5c;
  --red: #f28b82;
  --red-light: #5c2b29;
  --green: #81c995;
  --green-light: #1e3a2c;
  --yellow: #fdd663;
  --current-time: #f28b82;
  --shadow-sm: 0 1px 3px 0 rgba(0,0,0,.5), 0 1px 2px 0 rgba(0,0,0,.3);
  --shadow-md: 0 2px 6px 2px rgba(0,0,0,.5), 0 1px 2px 0 rgba(0,0,0,.3);
  --card-bg: #2d2d2d;
}
```

These follow Google Calendar's official color palette — the same values used in Google's dark mode redesign (Material Design 3).

## Event Colors

Event colors come from the Google Calendar API and are NOT affected by the theme. They're the same in light and dark mode:

| ID | Name | Hex |
|----|------|-----|
| 1 | Lavender | `#a4bdfc` |
| 2 | Sage | `#7ae7bf` |
| 3 | Grape | `#dbadff` |
| 4 | Flamingo | `#ff887c` |
| 5 | Banana | `#fbd75b` |
| 6 | Tangerine | `#ffb878` |
| 7 | Peacock | `#46d6db` |
| 8 | Graphite | `#e1e1e1` |
| 9 | Blueberry | `#5484ed` |
| 10 | Basil | `#51b749` |
| 11 | Tomato | `#dc2127` |

Default event color (when no colorId is set): `#039be5` (Peacock blue).

## Adding a New Themed Component

Use CSS variables for all colors:

```css
.my-component {
  background: var(--bg);           /* NOT #ffffff */
  color: var(--text-primary);      /* NOT #3c4043 */
  border: 1px solid var(--border); /* NOT #dadce0 */
  box-shadow: var(--shadow-sm);    /* NOT hardcoded rgba */
}
```

Reference files:
- `apps/shared/theme.css` — Complete token reference
- `apps/shared/base-styles.ts` — Theme tokens as a TypeScript string for injection
