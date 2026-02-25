# Migrate to Multi-File Vite Architecture

## Context

The app is a single `index.html` (~1,400 lines) with CDN-loaded React/Babel/Tailwind and no build step. Phase 1-2 of the component refactor are already done in-file (constants extracted, split contexts created, Header/FilterBar/CompletedToggle extracted as React.memo components).

The user wants to move to a proper multi-file architecture with a build step so the app can scale. This plan replaces the single-file refactoring approach — we'll split into modules AND finish extracting remaining components (Phases 3-7) as separate files.

## Approach

**Bundler**: Vite (fast, zero-config React support, built-in dev proxy)
**Auth**: `@clerk/clerk-react` npm package (replaces CDN script — gives us `<ClerkProvider>`, `<SignIn>`, `<UserButton>` components and `useAuth()` hook)
**CSS**: Tailwind v4 via `@tailwindcss/vite` plugin (replaces CDN — proper tree-shaking, faster builds)
**Structure**: Frontend in `src/`, backend stays at root (`server.js`)

## File Structure

```
daily-task/
├── index.html                    # Vite entry (minimal HTML shell)
├── server.js                     # Express backend (updated: serves dist/)
├── vite.config.js                # Vite config (proxy, build output)
├── src/
│   ├── main.jsx                  # Entry: ClerkProvider + React root
│   ├── App.jsx                   # Auth gate + VoiceTaskManager
│   ├── index.css                 # Tailwind directives + custom styles
│   ├── contexts/
│   │   ├── DataContext.jsx       # items, categories, learningData
│   │   └── DragContext.jsx       # draggedItem, dragOverGroupKey, etc.
│   ├── components/
│   │   ├── ErrorBoundary.jsx
│   │   ├── Header.jsx
│   │   ├── FilterBar.jsx
│   │   ├── CompletedToggle.jsx
│   │   ├── CategoryManager.jsx   # (Phase 3 — extract from root)
│   │   ├── VoiceTextInput.jsx    # (Phase 4 — extract from root)
│   │   ├── CustomDateDropZone.jsx # (Phase 5 — extract from root)
│   │   ├── TaskGroup.jsx         # (Phase 6 — extract from root)
│   │   ├── TaskItemCard.jsx      # (Phase 7 — extract from root)
│   │   └── Icons.jsx             # All SVG icon components
│   └── utils/
│       ├── constants.js          # API_BASE, DEFAULT_CATEGORIES, CONFETTI_COLORS, etc.
│       ├── dates.js              # toLocalDateString, getEndOfWeek, weekday helpers
│       ├── styles.js             # getCategoryStyle, getPriorityStyle, getCardBackground
│       └── confetti.js           # fireConfetti
├── src/db.js                     # (existing — backend only, not bundled)
├── src/schema.js                 # (existing — backend only, not bundled)
├── package.json                  # Updated deps + scripts
├── .gitignore                    # Add dist/
└── drizzle.config.js             # (existing — unchanged)
```

## Implementation Phases

### Phase 1: Set Up Vite + Tailwind + Clerk React

**New dependencies:**
```
# Dev
vite @vitejs/plugin-react @tailwindcss/vite tailwindcss

# Runtime
react react-dom @clerk/clerk-react
```

**Note:** React and ReactDOM will be installed as npm packages (replacing CDN). `@clerk/clerk-react` replaces the CDN-loaded `@clerk/clerk-js`.

**Files to create:**

**`vite.config.js`** — Vite config with React plugin, Tailwind plugin, and API proxy:
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { '/api': 'http://localhost:3000' }
  }
});
```

**`index.html`** — Minimal Vite entry (replaces current monolith):
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Task</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cedarville+Cursive&family=Source+Sans+3:ital,wght@0,200..900;1,200..900&display=swap" rel="stylesheet">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

**`src/index.css`** — Tailwind + custom styles (animations, fonts):
```css
@import "tailwindcss";
/* Move all @keyframes and custom CSS from old index.html <style> block */
```

**`src/main.jsx`** — Entry point with ClerkProvider only (App.jsx imports SignIn, useAuth, UserButton for the auth gate):
```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';
import './index.css';

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

ReactDOM.createRoot(document.getElementById('root')).render(
  <ClerkProvider publishableKey={CLERK_KEY}>
    <App />
  </ClerkProvider>
);
```

**Update `.env`** — Add: `VITE_CLERK_PUBLISHABLE_KEY=pk_test_...`

**Update `server.js`** — Serve `dist/` instead of root:
```js
// Replace: app.use(express.static(path.join(__dirname)));
// With:
app.use(express.static(path.join(__dirname, 'dist')));

// Update root route:
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});
```

**Update `package.json` scripts:**
```json
{
  "scripts": {
    "dev": "vite",
    "dev:server": "node server.js",
    "build": "vite build",
    "start": "node server.js",
    ...
  }
}
```

**Update `.gitignore`** — Add `dist/`

**Test**: `npm run dev` opens Vite dev server, API calls proxy to Express on :3000

---

### Phase 2: Split Existing Code into Files

Move already-extracted code from index.html into separate files:

- `src/utils/constants.js` — API_BASE, DEFAULT_CATEGORIES, CONFETTI_COLORS, NEW_TASK_MINUTES, CUSTOM_CATEGORY_COLORS, WEEKDAY_INDEX
- `src/utils/dates.js` — toLocalDateString, getEndOfWeek, getEndOfMonth, getDateForWeekday, getWeekdaysFromInput, applyWeekdayDueDateFromInput, applyDefaultDueDate
- `src/utils/styles.js` — hexToRgba, getCategoryStyle, getPriorityStyle, getCardBackground
- `src/utils/confetti.js` — fireConfetti
- `src/components/Icons.jsx` — Icon, Mic, MicOff, Plus, Filter, Trash2, Check, Calendar, FileText, GripVertical, Settings, X, Pencil
- `src/components/ErrorBoundary.jsx` — ErrorBoundary class
- `src/contexts/DataContext.jsx` — DataContext, useDataContext
- `src/contexts/DragContext.jsx` — DragContext, useDragContext
- `src/components/Header.jsx` — Header (already extracted, React.memo)
- `src/components/FilterBar.jsx` — FilterBar (already extracted, React.memo)
- `src/components/CompletedToggle.jsx` — CompletedToggle (already extracted, React.memo)
- `src/App.jsx` — Auth gate (SignIn/UserButton from @clerk/clerk-react) + VoiceTaskManager (remaining root code)

Each file uses `import`/`export`. Add proper imports to each.

**Test**: App loads identically to before. All features work.

---

### Phase 3: Extract CategoryManager Component

Move category manager JSX + handlers from App.jsx into `src/components/CategoryManager.jsx`.

- Reads from `useDataContext()` for customCategories, setCustomCategories, items, setItems
- Own local state: newCategory, newCategoryEmoji, editingCategory, error
- Own API calls: POST/PUT/DELETE `/api/custom-categories`
- React.memo wrapped

---

### Phase 4: Extract VoiceTextInput Component ✓

Move voice/text input JSX + categorizeWithClaude + addItem from App.jsx into `src/components/VoiceTextInput.jsx`.

- Props: `onAddItems` callback
- Reads from `useDataContext()` for learningData, allCategories
- Own local state: textInput, isListening, loading, error, recognitionRef
- Own API calls: POST `/api/categorize`, POST `/api/items`
- React.memo wrapped

---

### Phase 5: Extract CustomDateDropZone Component ✓

Move custom date drop zone JSX from App.jsx into `src/components/CustomDateDropZone.jsx`.

- Reads from `useDragContext()` and `useDataContext()`
- Own drag event handlers
- React.memo wrapped

---

### Phase 6: Extract TaskGroup Component

Move group header + collapsed logic from App.jsx into `src/components/TaskGroup.jsx`.

- Props: group, collapsed, onToggle, children or renders TaskItemCard internally
- Reads from `useDragContext()` for drag-over-group highlighting
- React.memo wrapped

---

### Phase 7: Extract TaskItemCard Component ✓

Move individual card JSX from App.jsx into `src/components/TaskItemCard.jsx`.

- Props: item, onToggleComplete, onDelete, onSave
- Own local state: isEditing, editValues, isNotesExpanded, justCompleted
- Reads from `useDragContext()` for drag state, `useDataContext()` for allCategories
- React.memo with custom comparator
- Drag handlers (handleDragStart, handleDragOver, handleDrop, handleDragEnd)

---

### Phase 8: Cleanup + Update Docs ✓

- App.jsx should be ~150-200 lines (state, data loading, computed values, layout)
- No component over 200 lines
- Update CLAUDE.md with new architecture, file structure, dev workflow
- `npm run build` produces working production build
- Verify Vercel deployment works (may need vercel.json)

## Critical Files

| File | Action |
|------|--------|
| `index.html` | Rewrite to minimal Vite shell |
| `server.js` | Update static serving to `dist/` |
| `package.json` | Add Vite/React/Tailwind/Clerk deps + scripts |
| `vite.config.js` | New — Vite config |
| `src/main.jsx` | New — entry point |
| `src/App.jsx` | New — auth gate + VoiceTaskManager |
| `src/index.css` | New — Tailwind + animations |
| `src/components/*.jsx` | New — 10 component files |
| `src/contexts/*.jsx` | New — 2 context files |
| `src/utils/*.js` | New — 4 utility files |
| `.env` | Add VITE_CLERK_PUBLISHABLE_KEY |
| `.gitignore` | Add dist/ |
| `CLAUDE.md` | Update after complete |

## Verification

1. `npm run dev` — Vite dev server starts, app loads, API proxy works
2. `npm run build && npm start` — Production build serves correctly
3. All features work: voice input, AI categorization, drag-and-drop, categories, filters, confetti
4. Clerk auth: sign in/out, data scoped per user, UserButton renders
5. No console errors
6. `npm run build` output is reasonable size (no massive bundles)

## Dev Workflow (after migration)

```bash
# Development (two terminals):
npm run dev:server    # Express on :3000
npm run dev           # Vite on :5173, proxies /api to :3000

# Production:
npm run build         # Outputs to dist/
npm start             # Express serves dist/ + handles /api
```
