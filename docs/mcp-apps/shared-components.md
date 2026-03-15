# Shared Component Library

Reusable UI components at `apps/shared/components.ts`. All components return HTML strings and use CSS variables for theming.

## Components

### renderEventCard(event, options?)

Event card with left color bar, time, title, location.

```typescript
import { renderEventCard } from "../../shared/components";

const html = renderEventCard(event, {
  showDate: true,       // Show date above time
  showLocation: true,   // Show location with pin icon
  showJoinButton: true, // Show "Join" button for meetings
  compact: false,       // Compact padding
  onClick: "handleClick()" // onclick attribute
});
```

### renderAttendeeChip(attendee)

Avatar circle + name + RSVP status indicator.

```typescript
const html = renderAttendeeChip({
  email: "sarah@example.com",
  displayName: "Sarah Chen",
  responseStatus: "accepted" // → green ✓
});
```

Status colors: accepted (green ✓), declined (red ✗), tentative (yellow ?), needsAction (gray ·).

### renderColorSwatch(color, size?, selected?)

Themed color circle.

```typescript
renderColorSwatch("#039be5", 14, false);  // 14px blue circle
renderColorSwatch("#ff887c", 18, true);   // 18px selected (border ring)
```

### renderBadge(text, variant?)

Status badge with 5 variants.

```typescript
renderBadge("Active", "success");  // Green background
renderBadge("Failed", "error");    // Red background
renderBadge("Pending", "warning"); // Yellow background
renderBadge("3 tools", "info");    // Blue background
renderBadge("Reader", "neutral");  // Gray background
```

### renderButton(text, options?)

Themed button with 4 variants.

```typescript
renderButton("Save", { variant: "primary", id: "saveBtn" });
renderButton("Cancel", { variant: "secondary" });
renderButton("Delete", { variant: "danger", icon: "🗑" });
renderButton("More", { variant: "text", disabled: true });
```

### renderListItem(options)

List row with icon/color + title + subtitle + badge.

```typescript
renderListItem({
  color: "#039be5",         // or icon: "📅"
  title: "Work Calendar",
  subtitle: "alex@company.com",
  badge: "Owner",
  badgeVariant: "success",
  onClick: "selectCalendar('work')"
});
```

### renderEmptyState(message, icon?)

Centered placeholder with icon and message.

```typescript
renderEmptyState("No upcoming events", "📅");
renderEmptyState("No results found", "🔍");
```

### renderSpinner(message?)

Loading spinner with message.

```typescript
renderSpinner("Loading events...");
```

### renderSectionHeader(title, subtitle?)

Uppercase label divider.

```typescript
renderSectionHeader("Event Colors", "11 colors");
```

### showToast(message, variant?, duration?)

Animated notification popup. Auto-dismisses.

```typescript
showToast("Event created", "success");
showToast("Failed to delete", "error", 5000);
showToast("Copied to clipboard", "info");
```

### showConfirmDialog(title, message, confirmText, onConfirm, options?)

Modal dialog with confirm/cancel.

```typescript
showConfirmDialog(
  "Delete Event",
  "This action cannot be undone.",
  "Delete",
  () => deleteEvent(id),
  { variant: "danger", cancelText: "Keep" }
);
```

### escapeHtml(str)

XSS-safe HTML escaping.

```typescript
const safe = escapeHtml(userInput); // Escapes <, >, &, ", '
```

## Shared CSS

Inject `SHARED_COMPONENT_CSS` into the page to style all components:

```typescript
import { SHARED_COMPONENT_CSS } from "../../shared/components";

const style = document.createElement("style");
style.textContent = SHARED_COMPONENT_CSS;
document.head.appendChild(style);
```

This adds styles for `.gc-event-card`, `.gc-attendee-chip`, `.gc-list-item`, `.gc-join-btn`, `.gc-spinner`, and keyframe animations.

## Creating a New UI App

1. Create `apps/<name>/index.html` — copy the theme CSS block from any existing app
2. Create `apps/<name>/src/app.ts`:

```typescript
import { createGCalApp, parseToolResult } from "../../shared/gcal-app";
import { escapeHtml, renderSpinner, SHARED_COMPONENT_CSS } from "../../shared/components";

// Inject shared styles
const style = document.createElement("style");
style.textContent = SHARED_COMPONENT_CSS;
document.head.appendChild(style);

// Create app
const app = createGCalApp("My App");

// Handle tool result
app.ontoolresult = (result) => {
  try {
    const data = parseToolResult<MyDataType>(result);
    render(data);
  } catch {
    autoFetch(); // Fallback
  }
};

// Auto-fetch if no data arrives
setTimeout(() => {
  if (!hasData) autoFetch();
}, 1500);
```

3. Register in `src/apps/ui-resources.ts`
4. `npm run build`
