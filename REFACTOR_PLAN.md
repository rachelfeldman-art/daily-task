# Refactor Monolithic React Component into Smaller Components

## Context

The VoiceTaskManager component in `index.html` (lines 101-1377) has grown to **1,276 lines** with **24 useState + 2 useRef**, making it difficult to maintain and test. This refactoring will break it into **6-8 focused components** while:
- Preserving all functionality (drag-and-drop, voice input, AI categorization, confetti animations, etc.)
- Maintaining the CDN-based single-file architecture (no build step required)
- Improving code organization and maintainability
- Reducing cognitive load when working on specific features
- **Optimizing render performance** via memoization and context splitting
- **Preparing for scale** with pagination-ready patterns and efficient data flow
- **Applying better software practices** (error boundaries, optimistic updates, AbortController cleanup)

This addresses **High Priority #2** from the code review: "Break up monolithic React component into smaller, focused components."

## Recommended Approach

**State Management Strategy**: **Split Context** approach — two separate Contexts to minimize unnecessary re-renders, plus props for localized state.

### Why Split Context (not a single AppContext)?

A single Context that holds `items`, `draggedItem`, `customCategories`, etc. causes **every consumer to re-render when any value changes**. Drag events fire rapidly during drag-and-drop, which would re-render the Header, FilterBar, and CategoryManager even though they don't use drag state.

**Solution: Two Contexts**

| Context | State | Consumers | Update Frequency |
|---------|-------|-----------|------------------|
| **DataContext** | `items`, `setItems`, `customCategories`, `setCustomCategories`, `learningData`, `setLearningData`, `allCategories`, utility fns | All components | Low (user actions) |
| **DragContext** | `draggedItem`, `setDraggedItem`, `dragOverGroupKey`, `setDragOverGroupKey`, `customDropDate`, `setCustomDropDate`, `isCustomDateDragOver`, `setIsCustomDateDragOver`, `suppressGroupToggleRef` | TaskItemCard, TaskGroup, CustomDateDropZone only | High (every mouse move during drag) |

This ensures Header, FilterBar, CategoryManager, VoiceTextInput, and CompletedToggle **never re-render during drag-and-drop**.

### Performance Strategy

| Technique | Where Applied |
|-----------|---------------|
| **React.memo()** | All extracted components (prevents re-render when props unchanged) |
| **useMemo()** | `sortedItems`, `filteredItems`, `groupedItems`, `stats`, `allCategories`, `contextValue` objects |
| **useCallback()** | All handler functions passed as props (`onToggleComplete`, `onDelete`, `onSave`, `onToggle`) |
| **Optimistic updates** | `toggleComplete`, `deleteItem` — update UI immediately, revert on API failure |
| **AbortController** | All fetch calls — cancel in-flight requests on unmount or re-fetch |
| **Debounced drag reorder** | `handleDragOver` — throttle to 60fps to avoid excessive state updates |

### Error Handling Strategy

| Pattern | Description |
|---------|-------------|
| **Error Boundary component** | Wraps the entire app; catches React render errors and shows a recovery UI instead of blank screen |
| **Inline async pattern** | Standardized async pattern (AbortController + optional retry) applied inline in each component; no shared hook |
| **Optimistic rollback** | Complete/delete show instant UI feedback; revert state + show toast on API failure |
| **Retry logic** | Failed data loads retry once automatically before showing error |

**Component Architecture**:
1. **DataContext** - Items, categories, learning data, utility functions (low-frequency updates)
2. **DragContext** - All drag-and-drop state (high-frequency updates, isolated from non-drag components)
3. **ErrorBoundary** - Catches render errors, shows recovery UI
4. **Header** - Stats display, period toggle, settings button
5. **CategoryManager** - Add/edit/delete custom categories
6. **VoiceTextInput** - Voice recognition + text input + AI categorization
7. **FilterBar** - Type and category filters
8. **CustomDateDropZone** - Drag-to-reschedule to any date
9. **TaskGroup** - Date-grouped section with collapse/expand
10. **TaskItemCard** - Individual task with edit/complete/delete/drag (memoized)
11. **CompletedToggle** - Show/hide completed items
12. **VoiceTaskManager** (root) - Orchestrates everything, wraps Context Providers

## Implementation Phases

**Note:** Line references (e.g. "Lines: 909-962") are approximate. When extracting, locate sections by responsibility or key strings (e.g. "Stats", "FilterBar", "CustomDateDropZone") in case the file has changed.

### Phase 1: Extract Utilities, Create Split Contexts & Error Boundary (45 min)
**Risk**: Low | **Value**: High - Foundation for all other phases

**Steps**:

1. **Extract constants** to top of script block:
   ```javascript
   const API_BASE = '';
   const DEFAULT_CATEGORIES = ['work', 'personal', 'project'];
   const CONFETTI_COLORS = ['#C65D3B', '#C2A83E', '#4F7C59', '#9E5B8C', '#3F6C7A', '#E6D8C3'];
   const NEW_TASK_MINUTES = 5;
   const CUSTOM_CATEGORY_COLORS = [
     { hex: '#9E5B8C' }, { hex: '#3F6C7A' }, { hex: '#C2A83E' }, { hex: '#5E6B73' }
   ];
   ```

2. **Extract utility functions** (pure functions, no state dependency):
   - `toLocalDateString`, `hexToRgba`, `getEndOfWeek`, `getEndOfMonth`
   - `getWeekdaysFromInput`, `getDateForWeekday`, `applyWeekdayDueDateFromInput`, `applyDefaultDueDate`

3. **Extract style functions** that depend on `customCategories`:
   - `getCategoryStyle(category, customCategories)` — add `customCategories` as parameter instead of closure
   - `getPriorityStyle(priority)` — pure, no dependency
   - `getCardBackground(item)` — pure, no dependency

4. **Create ErrorBoundary component** (class component — the one place we need it):
   ```javascript
   class ErrorBoundary extends React.Component {
     constructor(props) { super(props); this.state = { hasError: false, error: null }; }
     static getDerivedStateFromError(error) { return { hasError: true, error }; }
     componentDidCatch(error, info) { console.error('React Error Boundary:', error, info); }
     render() {
       if (this.state.hasError) {
         return <div className="min-h-screen flex items-center justify-center p-8 text-center">
           <div><h2 className="text-xl font-bold text-[#2D2A26] mb-2">Something went wrong</h2>
           <p className="text-[#6B6560] mb-4">{this.state.error?.message}</p>
           <button onClick={() => this.setState({ hasError: false, error: null })}
             className="px-4 py-2 bg-[#4F7C59] text-white rounded-xl">Try Again</button></div>
         </div>;
       }
       return this.props.children;
     }
   }
   ```

5. **Create DataContext** (low-frequency updates):
   ```javascript
   const DataContext = React.createContext();
   const useDataContext = () => React.useContext(DataContext);
   ```
   Holds: `items`, `setItems`, `customCategories`, `setCustomCategories`, `learningData`, `setLearningData`, `allCategories`

6. **Create DragContext** (high-frequency updates, isolated):
   ```javascript
   const DragContext = React.createContext();
   const useDragContext = () => React.useContext(DragContext);
   ```
   Holds: `draggedItem`, `setDraggedItem`, `dragOverGroupKey`, `setDragOverGroupKey`, `customDropDate`, `setCustomDropDate`, `isCustomDateDragOver`, `setIsCustomDateDragOver`, `suppressGroupToggleRef`

7. **Memoize context values** to prevent unnecessary re-renders:
   ```javascript
   const dataContextValue = useMemo(() => ({
     items, setItems, customCategories, setCustomCategories,
     learningData, setLearningData, allCategories
   }), [items, customCategories, learningData, allCategories]);

   const dragContextValue = useMemo(() => ({
     draggedItem, setDraggedItem, dragOverGroupKey, setDragOverGroupKey,
     customDropDate, setCustomDropDate, isCustomDateDragOver, setIsCustomDateDragOver,
     suppressGroupToggleRef
   }), [draggedItem, dragOverGroupKey, customDropDate, isCustomDateDragOver]);
   ```

8. **Wrap JSX in nested providers**:
   ```javascript
   <ErrorBoundary>
     <DataContext.Provider value={dataContextValue}>
       <DragContext.Provider value={dragContextValue}>
         {/* existing JSX */}
       </DragContext.Provider>
     </DataContext.Provider>
   </ErrorBoundary>
   ```

9. **Add useMemo to expensive computed values** (already in root):
   ```javascript
   const allCategories = useMemo(() =>
     [...DEFAULT_CATEGORIES, ...customCategories.map(c => c.name)],
     [customCategories]
   );
   const sortedItems = useMemo(() => /* sort logic */, [items]);
   const filteredItems = useMemo(() => /* filter logic */, [sortedItems, filter, categoryFilter, showCompleted, statsPeriod]);
   const groupedItems = useMemo(() => /* group logic */, [filteredItems]);
   const stats = useMemo(() => /* stats logic */, [items, statsPeriod]);
   ```

**Test Checklist**:
- [ ] App loads without errors
- [ ] Items display correctly
- [ ] All interactions work exactly as before
- [ ] ErrorBoundary catches errors (test by temporarily throwing in a component)
- [ ] No performance regression (drag-and-drop still smooth)

---

### Phase 2: Extract Simple Display Components with React.memo (45 min)
**Risk**: Low | **Value**: High - Quick wins, easy to test

**Components to Extract** — each wrapped in `React.memo()`:

**A. Header Component** (`React.memo`)
- **Props**: `statsPeriod`, `setStatsPeriod`, `stats`, `showCategoryManager`, `setShowCategoryManager`
- **Context**: `useDataContext` only (never DragContext — won't re-render during drag)
- **Lines**: 909-962
- **Responsibilities**: Title, stats pills, period toggle, settings button, Clerk UserButton mount

**B. FilterBar Component** (`React.memo`)
- **Props**: `filter`, `setFilter`, `categoryFilter`, `setCategoryFilter`
- **Context**: `useDataContext` for `allCategories`
- **Lines**: 1086-1137
- **Responsibilities**: Category filter pills, type filter pills (All/Tasks/Ideas)

**C. CompletedToggle Component** (`React.memo`)
- **Props**: `showCompleted`, `setShowCompleted`, `completedCount` (pass count as prop, don't read full `items` array)
- **Lines**: 1365-1376
- **Scale optimization**: Pass `completedCount` as a pre-computed number instead of having this component iterate over `items`. Prevents re-render when items change but completed count stays the same.

**Test Checklist**:
- [ ] Stats update when period changes
- [ ] Filter by type works
- [ ] Filter by category works
- [ ] Show/hide completed works
- [ ] Category manager toggle opens/closes panel
- [ ] Clerk UserButton mounts correctly
- [ ] Verify Header does NOT re-render during drag (React DevTools Profiler or console.log)

---

### Phase 3: Extract Category Manager (1 hour)
**Risk**: Medium | **Value**: High - Self-contained panel

**CategoryManager Component** (`React.memo`)
- **Props**: none (reads everything from context)
- **Context**: `useDataContext` for `customCategories`, `setCustomCategories`, `items`, `setItems`
- **Local State**: `newCategory`, `newCategoryEmoji`, `editingCategory`, `error`
- **Lines**: 965-1045
- **Error state:** The current single root `error` is split: VoiceTextInput and CategoryManager each have their own local `error` state; no shared error state remains at root.
- **API Calls**: POST/PUT/DELETE `/api/custom-categories`
- **Cascade Logic**: Category rename must update `items.category` and `learningData.category`

**Practice improvements**:
- Use **AbortController** in API calls — cancel if component unmounts mid-request
- Handle **409 Conflict** response from server (duplicate category) gracefully
- Use **functional setState** for arrays: `setCustomCategories(prev => prev.filter(...))` instead of reading stale closure values

**Test Checklist**:
- [ ] Add custom category
- [ ] Edit category name → items update
- [ ] Edit category emoji
- [ ] Delete category
- [ ] Duplicate category name shows error (409 response)
- [ ] Category colors apply to filters and cards
- [ ] Rapid add/delete doesn't cause race conditions

---

### Phase 4: Extract Voice/Text Input (1.5 hours)
**Risk**: Medium | **Value**: High - Complex async logic

**VoiceTextInput Component** (`React.memo`)
- **Props**: `onAddItems` callback (wrapped in `useCallback` by parent)
- **Context**: `useDataContext` for `learningData`, `allCategories`
- **Local State**: `textInput`, `isListening`, `loading`, `error`, `recognitionRef`
- **Lines**: 1048-1083

**Practice improvements**:
- **AbortController** for `/api/categorize` calls — cancel if user submits again before response
- **Debounce** input validation (not the submit, but any real-time feedback)
- **useCallback** for `categorizeWithClaude` and `addItem` to stabilize references
- **Cleanup** speech recognition in useEffect return: `recognitionRef.current?.abort()` on unmount
- **Error auto-clear**: Clear error message after 5 seconds with `setTimeout` + cleanup

```javascript
// AbortController pattern for AI categorization
const abortRef = useRef(null);

const categorizeWithClaude = useCallback(async (text) => {
  abortRef.current?.abort();
  abortRef.current = new AbortController();

  try {
    const response = await fetch('/api/categorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: abortRef.current.signal
    });
    // ...
  } catch (err) {
    if (err.name === 'AbortError') return; // Silently ignore cancelled requests
    // ... handle real errors
  }
}, [learningData, allCategories]);

// Cleanup on unmount
useEffect(() => () => abortRef.current?.abort(), []);
```

**Test Checklist**:
- [ ] Voice input activates/deactivates
- [ ] Mic permission handling
- [ ] Text input works
- [ ] Single task creation
- [ ] Multi-task parsing ("buy milk and walk dog")
- [ ] AI categorization applies
- [ ] Due date extraction ("by Friday", "tomorrow")
- [ ] Rapid double-submit doesn't create duplicates (AbortController cancels first)
- [ ] Error messages auto-clear after timeout
- [ ] Fallback to defaults when AI unavailable

---

### Phase 5: Extract Custom Date Drop Zone (30 min)
**Risk**: Low | **Value**: Medium - Isolated drag feature

**CustomDateDropZone Component** (`React.memo`)
- **Context**: `useDragContext` for drag state, `useDataContext` for `items`, `setItems`
- **Lines**: 1140-1160
- **Drag Events**: `onDragOver`, `onDragLeave`, `onDrop`

**Practice improvement**: **Optimistic update** on drop — update local state immediately, API call in background with rollback on failure.

**Test Checklist**:
- [ ] Drop zone only appears when dragging
- [ ] Drag over highlights zone
- [ ] Drop updates item's due date to selected date
- [ ] Date picker changes custom date
- [ ] Item moves to correct date group after drop
- [ ] API failure reverts the date change (optimistic rollback)

---

### Phase 6: Extract Task Group (1 hour)
**Risk**: Medium-High | **Value**: High - Reduces nesting

**TaskGroup Component** (`React.memo`)
- **Props**: `group`, `collapsed`, `onToggle` (all stable via useCallback/useMemo from parent)
- **Context**: `useDragContext` for `draggedItem`, `dragOverGroupKey`, `setDragOverGroupKey`, `suppressGroupToggleRef`; `useDataContext` for `items`, `setItems`
- **Lines**: 1168-1360
- **Drag Events**: `onDragOver`, `onDragLeave`, `onDrop`

**Performance**: React.memo with custom comparator — skip re-render if `group.items` array is referentially equal and `collapsed`/`dragOverGroupKey` unchanged:
```javascript
const TaskGroup = React.memo(({ group, collapsed, onToggle }) => {
  // ...
}, (prev, next) => {
  return prev.group === next.group
    && prev.collapsed === next.collapsed
    && prev.onToggle === next.onToggle;
});
```

**Practice improvement**: **Optimistic update** on drop-to-group — move item in state immediately, revert if API fails.

**Test Checklist**:
- [ ] Groups collapse/expand on header click
- [ ] Group labels display correctly (Overdue, Today, Tomorrow, date formats)
- [ ] Drag over group header highlights
- [ ] Drop on group header moves item to that date
- [ ] Group doesn't toggle during drag-drop (suppressGroupToggleRef)
- [ ] Item count shows correctly
- [ ] API failure on drop reverts item back to original group

---

### Phase 7: Extract Task Item Card (2 hours) — HIGHEST RISK
**Risk**: High | **Value**: Critical - Most complex component

**TaskItemCard Component** (`React.memo`)
- **Props**: `item`, `onToggleComplete`, `onDelete`, `onSave` (all wrapped in `useCallback` by parent)
- **Context**: `useDragContext` for `draggedItem`, `setDraggedItem`; `useDataContext` for `items`, `setItems`, `allCategories`
- **Local State**:
  - `isEditing` (replaces root's editingId === item.id)
  - `editValues` (local to this card)
  - `isNotesExpanded` (replaces root's expandedNotes[item.id])
  - `justCompleted` (animation state) — remove root state `justCompletedId`; clear local `justCompleted` after a short timeout (e.g. 300-500ms) in a `useEffect` so the checkbox pop animation runs once per complete.
- **Lines**: 1192-1357
- **useCallback for complete/delete:** Use `useCallback(..., [items])` for `handleToggleComplete` and `handleDeleteItem` (handlers need current item for rollback). Memo is still valuable: it prevents re-renders when only drag state changes. Optional: for a stable callback and maximum memo benefit, use a ref holding the latest `items` and `useCallback(..., [])`.

**Performance — React.memo with custom comparator**:
```javascript
const TaskItemCard = React.memo(({ item, onToggleComplete, onDelete, onSave }) => {
  // ...
}, (prev, next) => {
  // Only re-render if the item data actually changed
  return prev.item === next.item
    && prev.onToggleComplete === next.onToggleComplete
    && prev.onDelete === next.onDelete
    && prev.onSave === next.onSave;
});
```
This is critical: without memo, every card re-renders when ANY item changes (e.g., dragging reorders one card but re-renders all 50).

**Optimistic updates for toggleComplete and deleteItem**:
```javascript
const handleComplete = useCallback(async (id, e) => {
  e.stopPropagation();
  const item = items.find(i => i.id === id);
  if (!item) return;

  // Optimistic: update UI immediately
  const updated = { ...item, completed: !item.completed };
  setItems(prev => prev.map(i => i.id === id ? updated : i));

  if (updated.completed) {
    fireConfetti(e.currentTarget);
  }

  try {
    await fetch(`/api/items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
  } catch (err) {
    // Rollback on failure
    setItems(prev => prev.map(i => i.id === id ? item : i));
    setError('Failed to update item — reverted');
  }
}, [items]);
```

**Throttle drag reorder** to prevent excessive state updates during fast mouse movement:
```javascript
const lastDragOverTime = useRef(0);

const handleDragOver = (e, targetItem) => {
  e.preventDefault();
  const now = Date.now();
  if (now - lastDragOverTime.current < 50) return; // ~20fps throttle
  lastDragOverTime.current = now;
  // ... reorder logic
};
```

**Test Checklist** (THOROUGH):
- [ ] Click card → edit mode activates
- [ ] Edit all fields (text, type, category, priority, dueDate, notes)
- [ ] Save → persists to server + learning data recorded
- [ ] Cancel → reverts changes
- [ ] Complete/uncomplete toggle → instant UI update (optimistic)
- [ ] Confetti fires on complete, checkbox pop animation
- [ ] Delete removes item instantly (optimistic), reverts on API failure
- [ ] Expand/collapse notes
- [ ] Drag within group → smooth reordering (throttled)
- [ ] Drop within group → saves order to server
- [ ] Drag to different group / custom date zone → works
- [ ] Drag ghost image shows correctly (setTimeout delay preserved)
- [ ] Card backgrounds (new/overdue/today) apply correctly
- [ ] Priority dot pulses, category colors/emoji display
- [ ] With 50+ items, drag is still smooth (throttle + memo working)

---

### Phase 8: Final Integration, Cleanup & CLAUDE.md Update (1 hour)
**Risk**: Low | **Value**: High - Quality assurance

**Steps**:
1. Remove all old code from VoiceTaskManager root
2. Verify root component only contains: context state, local UI state, API handlers (wrapped in `useCallback`), computed values (wrapped in `useMemo`), JSX rendering
3. **Wrap all handler props in useCallback**:
   ```javascript
   const handleToggleComplete = useCallback(async (id, e) => { ... }, [items]);
   const handleDeleteItem = useCallback(async (id, e) => { ... }, [items]);
   const handleSaveEdit = useCallback(async (item, editValues) => { ... }, []);
   const handleToggleGroup = useCallback((key) => { ... }, []);
   ```
4. Clean up any duplicate code
5. **Update CLAUDE.md** with new component architecture
6. Verify no console errors
7. Run full smoke test

**Final Smoke Test Checklist**:
- [ ] **User Flow 1**: Add task via voice → Edit → Drag to new date → Complete → Delete
- [ ] **User Flow 2**: Add multiple tasks ("buy milk and walk dog") → All parse correctly
- [ ] **User Flow 3**: Create custom category → Filter by it → Rename category → Items update
- [ ] **Drag Flow**: Drag between groups, reorder within group, custom date drop — all smooth
- [ ] **Optimistic Updates**: Complete a task with network tab throttled to Slow 3G — UI updates instantly, syncs when network responds
- [ ] **Error Recovery**: Kill server, try to complete a task → see rollback + error message
- [ ] **Performance**: Add 50+ items → drag still smooth, filter changes instant
- [ ] **Animation Check**: Confetti, mic pulse, checkbox pop, priority pulse all work
- [ ] **Responsive / Auth / Error handling**: All pass
- [ ] **No console errors or warnings**

---

## File Organization

All components remain in `index.html` within the `<script type="text/babel">` block:

```javascript
<script type="text/babel">
  const { useState, useEffect, useRef, useMemo, useCallback } = React;

  // ─── 1. Constants ───
  const API_BASE = '';
  const DEFAULT_CATEGORIES = ['work', 'personal', 'project'];
  const CONFETTI_COLORS = [...];
  const NEW_TASK_MINUTES = 5;

  // ─── 2. Icon Components (unchanged) ───
  const Icon = ({ size = 24, children, className = '' }) => ...

  // ─── 3. Utility Functions (pure, no state) ───
  const toLocalDateString = (date = new Date()) => { ... };
  const hexToRgba = (hex, alpha) => { ... };
  const getCategoryStyle = (category, customCategories) => { ... };
  const getPriorityStyle = (priority) => { ... };
  const getCardBackground = (item) => { ... };
  // ... date utilities

  // ─── 4. Contexts ───
  const DataContext = React.createContext();
  const useDataContext = () => React.useContext(DataContext);

  const DragContext = React.createContext();
  const useDragContext = () => React.useContext(DragContext);

  // ─── 5. Error Boundary ───
  class ErrorBoundary extends React.Component { ... }

  // ─── 6. Extracted Components (alphabetical, all React.memo) ───
  const CategoryManager = React.memo(() => { ... });
  const CompletedToggle = React.memo(({ showCompleted, setShowCompleted, completedCount }) => { ... });
  const CustomDateDropZone = React.memo(() => { ... });
  const FilterBar = React.memo(({ filter, setFilter, categoryFilter, setCategoryFilter }) => { ... });
  const Header = React.memo(({ statsPeriod, setStatsPeriod, stats, ... }) => { ... });
  const TaskGroup = React.memo(({ group, collapsed, onToggle }) => { ... });
  const TaskItemCard = React.memo(({ item, onToggleComplete, onDelete, onSave }) => { ... });
  const VoiceTextInput = React.memo(({ onAddItems }) => { ... });

  // ─── 7. Root Component ───
  const VoiceTaskManager = () => {
    // DataContext state
    const [items, setItems] = useState([]);
    const [customCategories, setCustomCategories] = useState([]);
    const [learningData, setLearningData] = useState([]);

    // DragContext state
    const [draggedItem, setDraggedItem] = useState(null);
    const [dragOverGroupKey, setDragOverGroupKey] = useState(null);
    const [customDropDate, setCustomDropDate] = useState('');
    const [isCustomDateDragOver, setIsCustomDateDragOver] = useState(false);
    const suppressGroupToggleRef = useRef(false);

    // Local state (not in any Context)
    const [filter, setFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [showCompleted, setShowCompleted] = useState(false);
    const [statsPeriod, setStatsPeriod] = useState('week');
    const [showCategoryManager, setShowCategoryManager] = useState(false);
    const [collapsedGroups, setCollapsedGroups] = useState(new Set());

    // Memoized computed values
    const allCategories = useMemo(() => [...], [customCategories]);
    const sortedItems = useMemo(() => [...], [items]);
    const filteredItems = useMemo(() => [...], [sortedItems, filter, ...]);
    const groupedItems = useMemo(() => [...], [filteredItems]);
    const stats = useMemo(() => ({...}), [items, statsPeriod]);
    const completedCount = useMemo(() => items.filter(i => i.completed).length, [items]);

    // Memoized context values (prevents consumer re-renders)
    const dataContextValue = useMemo(() => ({
      items, setItems, customCategories, setCustomCategories,
      learningData, setLearningData, allCategories
    }), [items, customCategories, learningData, allCategories]);

    const dragContextValue = useMemo(() => ({
      draggedItem, setDraggedItem, dragOverGroupKey, setDragOverGroupKey,
      customDropDate, setCustomDropDate, isCustomDateDragOver,
      setIsCustomDateDragOver, suppressGroupToggleRef
    }), [draggedItem, dragOverGroupKey, customDropDate, isCustomDateDragOver]);

    // Stable handler refs (useCallback)
    const handleToggleComplete = useCallback(async (id, e) => { ... }, []);
    const handleDeleteItem = useCallback(async (id, e) => { ... }, []);
    const handleSaveEdit = useCallback(async (item, editValues) => { ... }, []);
    const handleToggleGroup = useCallback((key) => { ... }, []);

    return (
      <ErrorBoundary>
        <DataContext.Provider value={dataContextValue}>
          <DragContext.Provider value={dragContextValue}>
            <div className="min-h-screen p-4">
              <div className="max-w-4xl mx-auto">
                <Header ... />
                {showCategoryManager && <CategoryManager />}
                <VoiceTextInput onAddItems={handleAddItems} />
                <FilterBar ... />
                <div className="space-y-6">
                  {draggedItem && <CustomDateDropZone />}
                  {groupedItems.map(group => <TaskGroup key={group.key} ... />)}
                </div>
                {completedCount > 0 && <CompletedToggle completedCount={completedCount} ... />}
              </div>
            </div>
          </DragContext.Provider>
        </DataContext.Provider>
      </ErrorBoundary>
    );
  };

  // ─── 8. Clerk Initialization (unchanged) ───
  window.addEventListener('load', async function () { ... });
</script>
```

## Critical Files

- `index.html` — All frontend refactoring happens here
- `server.js` — API endpoints (reference only, no changes needed)
- `CLAUDE.md` — Update architecture section after refactor complete

## Verification

After completing all 8 phases:

1. **Manual Testing**: Run through Phase 8 Final Smoke Test
2. **Performance Profiling**: Use React DevTools Profiler to verify:
   - Header/FilterBar don't re-render during drag
   - TaskItemCard only re-renders when its own `item` prop changes
   - Drag operations stay under 16ms per frame
3. **Network Tab**: Verify API calls are identical to before, optimistic updates fire immediately
4. **Browser Console**: No errors or warnings
5. **Stress Test**: Add 50+ items, verify drag/filter/complete are still smooth

**Success Criteria**:
- All 8 phases complete without breaking functionality
- Component count: 1 monolith → 10 focused components
- No component over 200 lines
- Drag-and-drop smooth with 50+ items (throttled + memoized)
- Optimistic updates for complete/delete (instant UI feedback)
- Error boundary catches render crashes gracefully
- AbortController prevents stale API responses
- No unnecessary re-renders (verified via React DevTools)
- CLAUDE.md updated with new architecture

## Estimated Timeline

- **Phase 1**: 45 minutes (was 30 — added contexts, error boundary, memoization)
- **Phase 2**: 45 minutes
- **Phase 3**: 1 hour
- **Phase 4**: 1.5 hours
- **Phase 5**: 30 minutes
- **Phase 6**: 1 hour
- **Phase 7**: 2 hours (most critical)
- **Phase 8**: 1 hour

**Total**: ~8.75 hours spread across multiple sessions

## Potential Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking drag-and-drop during extraction | Extract drag components last (Phase 6-7), test exhaustively |
| Split context adds complexity | Only two contexts with clear separation (data vs drag). Simple `useDataContext()`/`useDragContext()` hooks |
| React.memo comparators miss updates | Use referential equality by default; custom comparators only where proven needed |
| Optimistic updates cause inconsistent state | Always use functional `setItems(prev => ...)` pattern; rollback reverts to snapshot |
| AbortController breaks expected behavior | Only abort on unmount or superseding request; never abort user-initiated actions |
| useCallback dependency arrays stale | Complete/delete handlers use `[items]` for rollback; memo still isolates drag re-renders. Use functional `setItems(prev => ...)` where possible; optional ref for stable callback |
| Confetti not firing after extraction | Keep `fireConfetti` as standalone utility; pass as callback |
| Category rename cascade broken | Test thoroughly — server already handles cascade in transaction |

## Notes

- This is a **code organization + performance refactor**, not a feature change
- All existing functionality must be preserved
- Single-file CDN architecture maintained (no build step)
- Incremental approach allows stopping after any phase
- Phase 7 (TaskItemCard) is highest risk — test thoroughly
- Key performance wins: split context (no drag re-renders on non-drag components), React.memo (skip unchanged cards), useMemo (avoid recomputing sorts/filters), optimistic updates (instant UI), throttled drag (smooth 20fps+)
- Warm earthy aesthetic and all animations must stay intact
