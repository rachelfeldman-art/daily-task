# CLAUDE.md - Smart Task Manager

## Project Overview

A simple, voice-enabled task management application and note taker built with React 18 and an Express.js backend.

**Key features:**
  - User authentication via Clerk (sign-in/sign-up, per-user data isolation)
  - Voice input (Web Speech API)
  - AI-powered task categorization (Anthropic Claude API), spell checks, and multi-task breakdown
  - Drag-and-drop reordering (list + calendar date rescheduling), calendar view, custom categories with emoji
  - Editable custom categories (name + emoji) with cascade updates to items/learning data
  - Confetti animation on task completion
  - A learning system that improves categorization from user corrections
  - Earthy/warm UI theme (Source Sans 3, Cedarville Cursive header, color-coded task cards)

## Repository Structure

```
daily-task/
├── index.html          # Frontend application (React + Babel + Tailwind via CDN)
├── server.js           # Express backend (API routes, DB init, static serving)
├── src/
│   ├── schema.js       # Drizzle ORM schema definitions (used for migrations)
│   └── db.js           # Neon serverless database connection
├── drizzle.config.js   # Drizzle Kit migration config
├── package.json        # Node.js dependencies and scripts
├── .env                # Environment variables (DATABASE_URL, ANTHROPIC_API_KEY, CLERK_*)
├── .gitignore          # Ignores node_modules, .env
└── CLAUDE.md           # This file
```

## Technology Stack

| Layer        | Technology                        | Loaded via |
|--------------|-----------------------------------|------------|
| UI Framework | React 18 + ReactDOM 18            | CDN (unpkg) |
| JSX          | Babel Standalone (in-browser)     | CDN (unpkg) |
| Styling      | Tailwind CSS                      | CDN        |
| Fonts        | Source Sans 3 + Cedarville Cursive | Google Fonts CDN |
| Icons        | Inline SVG components (custom)    | Embedded   |
| Backend      | Express 5                         | npm        |
| Database     | PostgreSQL (Neon serverless)      | npm (pg, @neondatabase/serverless) |
| ORM          | Drizzle ORM (migrations only)     | npm        |
| AI           | Anthropic Claude API (`claude-sonnet-4-20250514`) | Server-side proxy (`/api/categorize`) |
| Auth         | Clerk (`@clerk/clerk-js`, `@clerk/express`) | CDN (frontend), npm (backend) |
| Voice        | Web Speech Recognition API        | Browser native |
| Env Config   | dotenv                            | npm        |

## Architecture

### Client-Server Split

- **Frontend** (`index.html`): Single-page React app loaded via CDN. All UI logic in one `<script type="text/babel">` block. Communicates with backend via REST API.
- **Backend** (`server.js`): Express server handling authentication (Clerk), database operations, AI proxy, and static file serving.

### Frontend Component

The app uses one React component: `VoiceTaskManager`. It manages all state via React hooks (`useState`, `useEffect`, `useRef`).

### Key State Variables

- `items` — Array of task/idea objects (fetched from `/api/items`)
- `learningData` — Past user corrections for AI categorization (fetched from `/api/learning-data`)
- `customCategories` — User-defined categories as `[{ name, emoji }]` (fetched from `/api/custom-categories`)
- `view` — Current view mode: `'list'` or `'calendar'`
- `filter` — Type filter: `'all'`, `'task'`, or `'idea'`
- `categoryFilter` — Category filter
- `showCompleted` — Toggle visibility of completed items (default: hidden)
- `showCategoryManager` — Toggle the category management panel
- `editingCategory` — Tracks in-progress category edit `{ oldName, name, emoji }`
- `draggedItem` — Currently dragged item for reordering / calendar rescheduling
- `calendarDragOverDate` — Date string of the calendar cell being dragged over

### API Endpoints

All `/api/*` routes require Clerk authentication (`requireAuth()` middleware). Requests without a valid session receive a 401 response.

```
GET    /api/items              # Fetch all items (scoped to user)
POST   /api/items              # Create item(s) (scoped to user)
PUT    /api/items/:id          # Update single item (scoped to user)
PUT    /api/items              # Bulk update/reordering (scoped to user)
DELETE /api/items/:id          # Delete item (scoped to user)

GET    /api/learning-data      # Fetch learning corrections (scoped to user)
POST   /api/learning-data      # Save a correction (scoped to user)

GET    /api/custom-categories           # Fetch custom categories as [{ name, emoji }] (scoped to user)
POST   /api/custom-categories           # Add a category with name + emoji (scoped to user)
PUT    /api/custom-categories/:name     # Update category name/emoji, cascades to items + learning_data (scoped to user)
DELETE /api/custom-categories/:name     # Remove a category (scoped to user)

POST   /api/categorize         # Proxy to Anthropic Claude API (server validates model + max_tokens)
```

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

### Database

PostgreSQL (Neon serverless) with three tables:

- **`items`** — Tasks and ideas with all fields from the data model, scoped by `user_id`
- **`learning_data`** — Past user corrections (text, type, category, priority), scoped by `user_id`
- **`custom_categories`** — User-defined category names + emoji, scoped by `user_id`. Has a unique index on `(name, user_id)`.

All tables include a `user_id TEXT` column that stores the Clerk user ID. Every query filters by the authenticated user's ID to ensure data isolation between users.

Tables are auto-created on server startup via `initDB()` in `server.js`. Schema is also defined in `src/schema.js` using Drizzle ORM for migration tooling.

A one-time migration middleware in `server.js` claims any rows with `user_id IS NULL` (pre-auth legacy data) for the first authenticated user who hits the API.

### AI Integration

The frontend sends categorization requests to `POST /api/categorize`. The server validates the request (restricts model to an allowlist, caps `max_tokens`) and proxies to the Anthropic Messages API using `ANTHROPIC_API_KEY` from `.env`. Falls back to default values (`type: 'task'`, `category: 'personal'`, `priority: 'medium'`) when the API is unavailable or returns an error. The AI prompt also applies default due dates (work tasks → today, other tasks → end of week, ideas → end of month) and spell/grammar corrections.

## Development Workflow

### Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
# Create .env with:
#   DATABASE_URL=postgresql://...
#   ANTHROPIC_API_KEY=sk-ant-...
#   CLERK_PUBLISHABLE_KEY=pk_test_...
#   CLERK_SECRET_KEY=sk_test_...

# 3. Start the server
npm start
# Server runs on http://localhost:3000
```

### Making Changes

- **Frontend**: Edit `index.html`, refresh browser (Babel compiles JSX in-browser)
- **Backend**: Edit `server.js`, restart server
- **Schema changes**: Edit `src/schema.js`, run `npm run db:generate` then `npm run db:migrate`

### Deployment

Deployed on Vercel. Configuration in `.vercel/` directory.

## UI Design

The frontend uses an earthy/warm light theme:
- **Background**: `#F5F0E8` (warm cream), cards: `#FFFBF7` (warm white)
- **Fonts**: Source Sans 3 (body), Cedarville Cursive (header title)
- **Category color system**: Each category gets a color that tints the card background (~18% opacity) with a 4px left border. Default categories: work (Storm Indigo `#4B4F73`), personal (Fern Green `#4F7C59`), project (Terracotta `#C65D3B`). Custom categories cycle through Muted Berry, Lake Blue, Golden Moss, River Slate.
- **Animations**: Confetti on task completion (30 particles, 800ms), mic pulse when listening, checkbox pop on complete, priority dot pulse for high-priority items.
- **Conditional card backgrounds**: Pale green for new tasks (<5 min), pale red for overdue, pale yellow for due today.

## Code Conventions

- **No JSX for icons** — Icon components use `React.createElement()` directly
- **Hooks only** — No class components; all state managed via `useState`, `useEffect`, `useRef`
- **Tailwind utility classes + inline styles** — Styling is primarily Tailwind classes with CSS custom properties and inline `style` for dynamic color theming
- **Async/await** — All API calls and storage operations use async/await
- **Raw SQL** — Backend uses `pg` Pool with raw SQL queries (not the Drizzle query builder)

## Testing

There is no test suite, test framework, or testing infrastructure in this project.

## Linting / Formatting

There is no linting or formatting tooling configured (no ESLint, Prettier, or similar).

## Important Notes for AI Assistants

1. **Frontend** — `index.html` contains all UI code (React via CDN, Babel in-browser). No separate JS modules on the frontend.
2. **Backend** — `server.js` is the Express server. Uses raw SQL via `pg` Pool, not the Drizzle query builder.
3. **Schema** — `src/schema.js` defines tables with Drizzle ORM, used only for migrations (`drizzle-kit`). `src/db.js` sets up the Neon connection.
4. **Environment variables** — `DATABASE_URL`, `ANTHROPIC_API_KEY`, `CLERK_PUBLISHABLE_KEY`, and `CLERK_SECRET_KEY` must be in `.env`. Never hardcode secrets or expose them to the frontend. The Clerk publishable key is safe in frontend code (it's public by design).
5. **Authentication** — Clerk handles auth. Frontend loads `@clerk/clerk-js` via CDN script tag. Backend uses `@clerk/express` (`clerkMiddleware()` + `requireAuth()`). All API data is scoped per user via `user_id` column. The Clerk user ID is accessed via `req.auth.userId` in route handlers.
6. **CDN dependencies** — Frontend libraries (React, Babel, Tailwind, Clerk JS) are loaded via CDN. Do not convert to npm packages unless explicitly requested.
7. **npm dependencies** — Backend uses Express, pg, dotenv, cors, drizzle-orm, @clerk/express. Do not add new dependencies without asking.
8. **Voice features** — Web Speech API requires HTTPS or localhost. Degrades gracefully in unsupported environments.
9. **No build system** — Frontend has no build step. Do not introduce bundlers (webpack, vite, etc.) unless explicitly requested.
