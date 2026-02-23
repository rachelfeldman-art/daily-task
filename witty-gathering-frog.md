# Plan: Get rid of Calendar View and Adjust List View with a date-group 

## Context
The calendar view is being removed entirely. The date-grouping concept (items organized by due date) will be integrated directly into the main list view, replacing the current flat list. This gives a cleaner single-view experience while keeping the organizational benefits of seeing items grouped by date.

**Only file modified:** [index.html](index.html)

---

## Clarifications / Decisions

- **Within-group sort:** Use `order` field (user's last set arrangement, including priority-based order).
- **Overdue placement:** Single "Overdue" group at the top — all overdue items in one group (no per-date groups for overdue).
- **Date formatting:** Keep a small date-formatting helper for group headers (e.g. "Tue, Feb 17"); inline in `getGroupLabel` or minimal helper.
- **Collapsed state:** In-memory only — no localStorage persistence (resets on refresh).
- **todayStr / isToday:** `todayStr` = today as `YYYY-MM-DD`; `isToday` = boolean on each group (`group.dueDate === todayStr`). Use consistently.

---

## Changes

### 1. Remove calendar-related code

**State to delete:**
- `view` state (~line 116) — no longer needed, only one view

**Icon components to delete:**
- `CalendarDays` (line 95) — only used in view toggle
- `List` (line 94) — only used in view toggle

**Functions to delete:**
- `handleCalendarDragOver` (lines 588-595)
- `handleCalendarDragLeave` (lines 597-602)
- `handleCalendarDrop` (lines 604-627)
- `getCalendarDays` (lines 668-679)
- `getItemsForDate` (lines 681-684)
- `isToday` (lines 686-689)
- `formatDate` (lines 650-665) — per-card date badge removed (redundant with group headers). Keep a minimal date-formatting helper for `getGroupLabel` (e.g. "Tue, Feb 17")

**JSX to delete:**
- View toggle pill buttons in header (lines ~760-776)
- Calendar view JSX block (lines 975-1054)
- Per-card date badge (lines ~1197-1208) — redundant with group headers

**Fix existing bug:**
- `handleDragEnd` (lines 583-586) references `setCalendarDragOverDate` which was never declared — remove that reference

---

### 2. Add new state variables

```js
const [collapsedGroups, setCollapsedGroups] = useState(new Set());  // tracks collapsed date sections
const [dragOverGroupKey, setDragOverGroupKey] = useState(null);      // drag-over highlight for group headers
```

---

### 3. Add date-grouping logic (after `filteredItems`)

- **`todayStr`** — today's date as `'YYYY-MM-DD'`
- **`getGroupLabel(dateStr)`** — returns human-readable header: "Today", "Tomorrow", "Overdue", or weekday + date
- **`groupedItems`** — computed from `filteredItems`, produces array of `{ key, label, isToday, isOverdue, items[] }`. Order: Overdue (single group at top) → then distinct future `dueDate` groups ascending → "No Date" at bottom. Items within each group keep `order` (user's last arrangement).

---

### 4. Add group interaction handlers

- **`toggleGroup(key)`** — collapse/expand a date section
- **`handleGroupDragOver(e, groupKey)`** — highlight group header when dragging over it
- **`handleGroupDragLeave(e)`** — clear highlight (with `contains` check to prevent flicker)
- **`handleGroupDrop(e, groupKey)`** — reschedule item: updates `dueDate` via `PUT /api/items/:id`, updates state

---

### 5. Update existing `handleDragOver` for within-group reordering

Add early return guard: `if (draggedItem.dueDate !== targetItem.dueDate) return;`
This prevents cross-group reorder — cross-group moves use the group header drop instead.

---

### 6. Replace flat list JSX with grouped list

**Structure:**
```
<div space-y-6>
  {groupedItems.map(group => (
    <div>
      <!-- Group header: clickable to collapse, drop target for rescheduling -->
      <div onClick=toggleGroup onDragOver/Leave/Drop=groupHandlers>
        ▾ "Today · Tue, Feb 17"                    3 items
      </div>

      <!-- Collapsible item list -->
      {!collapsed && group.items.map(item => (
        <!-- Existing card markup (grip, checkbox, content, delete) -->
      ))}
    </div>
  ))}
</div>
```

**Group header styling (earthy theme):**
- **Today:** golden moss tint (`rgba(194,168,62,0.22)`)
- **Overdue:** terracotta tint (`rgba(198,93,59,0.12)`)
- **No Date:** slate tint (`rgba(94,107,115,0.12)`)
- **Normal dates:** warm tan (`#E6D8C3`)
- **Drag-over:** lake blue ring highlight + "Drop to reschedule" text

**Drag-and-drop behavior:**
- Drag card over another card in same group → reorder (existing behavior)
- Drag card onto a different group's header → reschedule (changes `dueDate`)
- Dragging to "No Date" group sets `dueDate: null`

---

