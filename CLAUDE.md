# CLAUDE.md - Smart Task Manager

## Project Overview

A simple, voice-enabled task management application and note taker built with React 19 and an Express.js backend.

**Key features:**
  - User authentication via Clerk (sign-in/sign-up, per-user data isolation)
  - Voice input (Web Speech API)
  - AI-powered task categorization (Anthropic Claude API), spell checks, and multi-task breakdown
  - Drag-and-drop reordering (list + date rescheduling), custom categories with emoji
  - Editable custom categories (name + emoji) with cascade updates to items/learning data
  - Confetti animation on task completion
  - A learning system that improves categorization from user corrections
  - Earthy/warm UI theme (Source Sans 3, Cedarville Cursive header, color-coded task cards)

## Repository Structure

```
daily-task/
├── index.html              # Vite entry point (minimal HTML shell)
├── vite.config.js           # Vite config (React plugin, Tailwind plugin, API proxy)
├── server.js                # Express backend (API routes, DB init, serves dist/)
├── src/
│   ├── main.jsx             # React root + ClerkProvider
│   ├── App.jsx              # Auth gate + VoiceTaskManager (main app component)
│   ├── index.css            # Tailwind v4 directives + custom animations
│   ├── components/
│   │   ├── ErrorBoundary.jsx
│   │   ├── Header.jsx
│   │   ├── FilterBar.jsx
│   │   ├── CompletedToggle.jsx
│   │   ├── CategoryManager.jsx
│   │   ├── VoiceTextInput.jsx
│   │   ├── CustomDateDropZone.jsx
│   │   ├── TaskGroup.jsx
│   │   ├── TaskItemCard.jsx
│   │   ├── TaskItemCardEditForm.jsx
│   │   └── Icons.jsx        # All SVG icon components
│   ├── contexts/
│   │   ├── DataContext.jsx  # items, categories, learningData
│   │   └── DragContext.jsx   # draggedItem, dragOverGroupKey, etc.
│   ├── utils/
│   │   ├── constants.js     # API_BASE, DEFAULT_CATEGORIES, colors, etc.
│   │   ├── dates.js         # toLocalDateString, groupFilteredItemsByDueDate, etc.
│   │   ├── styles.js        # getCategoryStyle, getCardBackground, etc.
│   │   └── confetti.js      # fireConfetti
│   ├── schema.js             # Drizzle ORM schema definitions (used for migrations)
│   └── db.js                 # Neon serverless database connection
├── drizzle.config.js        # Drizzle Kit migration config
├── package.json             # Node.js dependencies and scripts
├── .env                     # Environment variables (DATABASE_URL, ANTHROPIC_API_KEY, CLERK_*, VITE_CLERK_*)
├── .gitignore               # Ignores node_modules, .env, dist/
└── CLAUDE.md                # This file
```

## Technology Stack

| Layer        | Technology                        | Loaded via |
|--------------|-----------------------------------|------------|
| UI Framework | React 19 + ReactDOM 19            | npm        |
| Build        | Vite + @vitejs/plugin-react       | npm (dev)  |
| Styling      | Tailwind CSS v4 + @tailwindcss/vite | npm (dev) |
| Fonts        | Source Sans 3 + Cedarville Cursive | Google Fonts CDN |
| Icons        | Inline SVG components (custom)    | Embedded   |
| Backend      | Express 5                         | npm        |
| Database     | PostgreSQL (Neon serverless)      | npm (pg, @neondatabase/serverless) |
| ORM          | Drizzle ORM (migrations only)     | npm        |
| AI           | Anthropic Claude API (`claude-sonnet-4-20250514`) | Server-side proxy (`/api/categorize`) |
| Auth         | Clerk (`@clerk/clerk-react`, `@clerk/express`) | npm |
| Validation   | Zod v4                            | npm        |
| Voice        | Web Speech Recognition API        | Browser native |
| Env Config   | dotenv                            | npm        |

## Architecture

### Client-Server Split

- **Frontend** (`src/`): Multi-file React app built with Vite. Entry point is `src/main.jsx`. Components, contexts, and utilities are split into separate modules.
- **Backend** (`server.js`): Express server handling authentication (Clerk), database operations, AI proxy, and static file serving (serves `dist/` in production).

### Frontend Components

The main app component is `VoiceTaskManager` in `src/App.jsx`. It composes: Header, FilterBar, CompletedToggle, CategoryManager, VoiceTextInput, CustomDateDropZone, TaskGroup, and TaskItemCard (which uses TaskItemCardEditForm for inline editing). State is shared via `DataContext` and `DragContext`. No component exceeds 200 lines.

### Key State Variables

- `items` — Array of task/idea objects (fetched from `/api/items`)
- `learningData` — Past user corrections for AI categorization (fetched from `/api/learning-data`)
- `customCategories` — User-defined categories as `[{ name, emoji }]` (fetched from `/api/custom-categories`)
- `filter` — Type filter: `'all'`, `'task'`, or `'idea'`
- `categoryFilter` — Category filter
- `showCompleted` — Toggle visibility of completed items (default: hidden)
- `showCategoryManager` — Toggle the category management panel
- `draggedItem` — Currently dragged item for reordering / date rescheduling

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
#   VITE_CLERK_PUBLISHABLE_KEY=pk_test_...  (same value as CLERK_PUBLISHABLE_KEY)

# 3. Development (two terminals):
npm run dev:server    # Express on :3000
npm run dev           # Vite on :5173, proxies /api to :3000

# 4. Production:
npm run build         # Outputs to dist/
npm start             # Express serves dist/ + handles /api
```

### Making Changes

- **Frontend**: Edit files in `src/`, Vite hot-reloads automatically
- **Backend**: Edit `server.js`, restart server
- **Schema changes**: Edit `src/schema.js`, run `npm run db:generate` then `npm run db:migrate`

### Deployment

- **Static frontend**: `vercel.json` sets `buildCommand: "npm run build"` and `outputDirectory: "dist"`. Deploy with Vercel CLI or connect the repo at vercel.com. For full app (API + DB), use a Node host (e.g. Railway, Render) that runs `node server.js`, or configure Vercel serverless functions for `/api/*`.

## UI Design

The frontend uses an earthy/warm light theme:
- **Background**: `#F5F0E8` (warm cream), cards: `#FFFBF7` (warm white)
- **Fonts**: Source Sans 3 (body), Cedarville Cursive (header title)
- **Category color system**: Each category gets a color that tints the card background (~18% opacity) with a 4px left border. Default categories: work (Storm Indigo `#4B4F73`), personal (Fern Green `#4F7C59`), project (Terracotta `#C65D3B`). Custom categories cycle through Muted Berry, Lake Blue, Golden Moss, River Slate.
- **Animations**: Confetti on task completion (30 particles, 800ms), mic pulse when listening, checkbox pop on complete, priority dot pulse for high-priority items.
- **Conditional card backgrounds**: Pale green for new tasks (<5 min), pale red for overdue, pale yellow for due today.

## Code Conventions

- **No JSX for icons** — Icon components use `React.createElement()` directly
- **Hooks only** — No class components; all state managed via `useState`, `useEffect`, `useRef`, `useMemo`, `useCallback`
- **Tailwind utility classes + inline styles** — Styling is primarily Tailwind classes with CSS custom properties and inline `style` for dynamic color theming
- **Async/await** — All API calls and storage operations use async/await
- **Raw SQL** — Backend uses `pg` Pool with raw SQL queries (not the Drizzle query builder)
- **Zod v4 validation** — Server-side request validation uses Zod v4 (note: `error.issues` not `error.errors`)

## Testing

There is no test suite, test framework, or testing infrastructure in this project.

## Linting / Formatting

There is no linting or formatting tooling configured (no ESLint, Prettier, or similar).

## Important Notes for AI Assistants

1. **Frontend** — Multi-file React app in `src/`. Built with Vite. Entry point is `src/main.jsx`, main component in `src/App.jsx`.
2. **Backend** — `server.js` is the Express server. Uses raw SQL via `pg` Pool, not the Drizzle query builder. Serves `dist/` for production.
3. **Schema** — `src/schema.js` defines tables with Drizzle ORM, used only for migrations (`drizzle-kit`). `src/db.js` sets up the Neon connection.
4. **Environment variables** — `DATABASE_URL`, `ANTHROPIC_API_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and `VITE_CLERK_PUBLISHABLE_KEY` must be in `.env`. Never hardcode secrets. The Clerk publishable key is safe in frontend code (it's public by design).
5. **Authentication** — Clerk handles auth. Frontend uses `@clerk/clerk-react` (`ClerkProvider`, `useAuth()`, `SignIn`, `UserButton`). Backend uses `@clerk/express` (`clerkMiddleware()` + `requireAuth()`). All API data is scoped per user via `user_id` column. The Clerk user ID is accessed via `req.auth.userId` in route handlers.
6. **npm dependencies** — Frontend: react, react-dom, @clerk/clerk-react. Backend: express, pg, dotenv, cors, drizzle-orm, @clerk/express, zod. Dev: vite, @vitejs/plugin-react, tailwindcss, @tailwindcss/vite, drizzle-kit. Do not add new dependencies without asking.
7. **Voice features** — Web Speech API requires HTTPS or localhost. Degrades gracefully in unsupported environments.
8. **Build system** — Vite builds the frontend to `dist/`. Use `npm run dev` for development with HMR, `npm run build` for production.
9. **Migration complete** — The app uses a multi-file Vite architecture. See `REFACTOR_PLAN.md` for the phased migration history.
