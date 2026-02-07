# CLAUDE.md - Smart Task Manager

## Project Overview

A single-page, voice-enabled task management application built with React 18. The entire app lives in one self-contained HTML file (`index.html`) with no build step, no bundler, and no package manager. All dependencies are loaded via CDN.

**Key features:** voice input (Web Speech API), AI-powered task categorization (Anthropic Claude API), drag-and-drop reordering, calendar view, custom categories, and a learning system that improves categorization from user corrections.

## Repository Structure

```
daily-task/
├── index.html          # Entire application (~950 lines)
├── CLAUDE.md           # This file
└── .git/
```

This is a **single-file application**. All HTML, CSS (Tailwind utilities), and JavaScript (React + Babel) are contained in `index.html`.

## Technology Stack

| Layer        | Technology                        | Loaded via |
|--------------|-----------------------------------|------------|
| UI Framework | React 18 + ReactDOM 18            | CDN (unpkg) |
| JSX          | Babel Standalone (in-browser)     | CDN (unpkg) |
| Styling      | Tailwind CSS                      | CDN        |
| Icons        | Inline SVG components (custom)    | Embedded   |
| AI           | Anthropic Claude API (`claude-sonnet-4-20250514`) | Fetch API  |
| Voice        | Web Speech Recognition API        | Browser native |
| Storage      | `window.storage` with localStorage fallback | Browser native |

## Architecture

### Single Component Design

The app uses one monolithic React component: `VoiceTaskManager`. It manages all state via React hooks (`useState`, `useEffect`, `useRef`).

### Key State Variables

- `items` - Array of task/idea objects (persisted to `task-items` storage key)
- `learningData` - Past user corrections for AI categorization (persisted to `tag-learning`)
- `customCategories` - User-defined categories (persisted to `custom-categories`)
- `view` - Current view mode: `'list'` or `'calendar'`
- `filter` - Type filter: `'all'`, `'tasks'`, or `'ideas'`
- `categoryFilter` - Category filter

### Data Model

```javascript
// Task/Idea item
{
  id: Number,              // timestamp + random
  text: String,
  completed: Boolean,
  createdAt: String,       // ISO timestamp
  type: 'task' | 'idea',
  category: String,        // 'work', 'personal', 'project', or custom
  priority: 'high' | 'medium' | 'low',
  dueDate: String | null,  // 'YYYY-MM-DD'
  notes: String,
  order: Number            // for drag-and-drop sorting
}
```

### Storage

The app uses an async `window.storage` API with automatic fallback to `localStorage`. Three storage keys are used:
- `task-items` - serialized items array
- `tag-learning` - serialized learning data
- `custom-categories` - serialized custom categories array

### AI Integration

Task categorization calls the Anthropic Messages API (`/v1/messages`) directly from the browser. Requires `window.ANTHROPIC_API_KEY` to be set. Falls back to default values (`type: 'task'`, `category: 'personal'`, `priority: 'medium'`) when no API key is available.

## Development Workflow

### Running Locally

No build step required. Open `index.html` directly in a browser, or serve it with any static file server:

```bash
# Option 1: Direct file open
open index.html

# Option 2: Python HTTP server
python3 -m http.server 8000

# Option 3: Node.js (npx)
npx serve .
```

### Making Changes

1. Edit `index.html` directly - all code is in a single `<script type="text/babel">` block
2. Refresh the browser to see changes (Babel compiles JSX in-browser)
3. No hot reload, no dev server, no compilation step

### Deployment

The app is designed for static hosting (e.g., GitHub Pages). A `.nojekyll` file was used historically to bypass Jekyll processing on GitHub Pages.

## Code Conventions

- **No JSX for icons** - Icon components use `React.createElement()` directly (lines 19-33)
- **Hooks only** - No class components; all state managed via `useState`, `useEffect`, `useRef`
- **Tailwind utility classes** - All styling is inline via Tailwind CSS classes
- **Async storage** - All storage operations use async/await pattern
- **Inline everything** - No external CSS files, no separate JS modules, no imports

## Testing

There is no test suite, test framework, or testing infrastructure in this project.

## Linting / Formatting

There is no linting or formatting tooling configured (no ESLint, Prettier, or similar).

## Important Notes for AI Assistants

1. **Single file** - All changes must be made in `index.html`. There are no other source files.
2. **No build system** - Do not introduce package.json, webpack, vite, or similar tooling unless explicitly requested.
3. **CDN dependencies** - Do not convert to npm packages unless explicitly requested.
4. **Browser-only** - This is a client-side app with no backend. The only external call is to the Anthropic API.
5. **Storage compatibility** - The `window.storage` abstraction exists for compatibility with Claude Artifact sandboxes. Do not remove the localStorage fallback.
6. **API key handling** - `window.ANTHROPIC_API_KEY` is expected to be set externally. Do not hardcode API keys.
7. **Voice features** - Web Speech API requires HTTPS or localhost. Voice gracefully degrades in restricted environments.
