# UI Redesign: Earthy & Warm Vibe Shift (Light Theme)

## Context

The current app has a clean but corporate feel — white cards on a light blue-indigo gradient, small gray badges, standard Tailwind defaults. The goal is a full redesign inspired by Tiimo (color-coded visual blocks, emoji accents, celebration animations, bubbly shapes) and TimeBloc (visual daily planner with colorful blocks), with an earthy, warm color palette on a **light canvas** — natural tones that feel grounded, airy, and expressive.

All changes are in index.html (the single frontend file). No new dependencies, no build tools.

---

## 1. Foundation: Light Canvas + Custom Font

**Why light?** A warm, light background keeps the app open and readable — earthy accent colors pop against it without feeling heavy.

- **Background**: #F5F0E8 (warm cream/off-white) 
- **Card surfaces**: #FFFBF7 (warm white) with subtle borders; optional very light tint from Cloud Sand for variety
- **Font**: Load Source Sans 3 via Google Fonts CDN (preconnect + link below) — clean, readable, warm
- Add a `<style>` block with CSS custom properties, font-family, and keyframe animations

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,200..900;1,200..900&display=swap" rel="stylesheet">
<style>
  body { font-family: 'Source Sans 3', sans-serif; background: #F5F0E8; }
  /* + keyframes for confetti, mic pulse, etc. */
</style>
```

---

## 2. Color System

An earthy, warm palette on light — natural tones that feel grounded and expressive:

| Role | Color | Hex | Vibe |
|------|-------|-----|------|
| Primary accent / High priority | Terracotta Clay | #C65D3B | Earthy, warm urgency |
| Ideas / Highlights | Golden Moss | #C2A83E | Sunlit, natural |
| Voice / Active | Muted Berry | #9E5B8C | Creative, expressive |
| Success | Fern Green | #4F7C59 | Calm growth |
| Tasks / Info | Lake Blue | #3F6C7A | Deep, thoughtful |
| Work Category | Storm Indigo | #4B4F73 | Grounded |
| Secondary category | River Slate | #5E6B73 | Neutral anchor |
| Soft highlight / warm bg tint | Cloud Sand | #E6D8C3 | Warm tint for pills/panels |
| Background | Warm Cream | #F5F0E8 | Page background |
| Text primary | Warm Ink | #2D2A26 | Dark for readability on light |
| Text secondary | — | #6B6560 | Muted warm gray |

**Category colors** — each category gets an earthy tone that tints the entire task card (light tint + left border):
- work → Storm Indigo #4B4F73, personal → Fern Green #4F7C59, project → Terracotta #C65D3B
- Custom categories cycle through: Muted Berry #9E5B8C, Lake Blue #3F6C7A, Golden Moss #C2A83E, River Slate #5E6B73

**Confetti colors**: Terracotta, Golden Moss, Fern Green, Muted Berry, Lake Blue, Cloud Sand.

Replace `getCategoryColor()` with `getCategoryStyle()` returning `{ bg, border, text, badge, emoji }` (values tuned for light background).

---

## 3. Layout Restructure

**Current**: Vertical stack of white cards in max-w-6xl.
**New**: Light canvas with a focused max-w-4xl column; cards are warm white or lightly tinted.

```
┌─ STICKY HEADER BAR (backdrop-blur, light frosted glass) ──────┐
│  🌿 My Tasks    [List|Calendar] pill toggle   [⚙] [Profile]  │
│  [12 tasks] [5 ideas] [8 done]  ← earthy-colored stat pills  │
└───────────────────────────────────────────────────────────────┘

┌─ HERO INPUT (warm white surface, glowing border on focus) ───┐
│  [🎤 Mic]  [════ Large input ════]  [➕ Add]                 │
└───────────────────────────────────────────────────────────────┘

  [All] [Tasks] [Ideas]  │  [🏢 Work] [🏠 Personal] [🚀 Project]
  ← earthy-colored inline pills, no heavy card wrapper

┌─ TASK BLOCKS ─────────────────────────────────────────────────┐
│  ┌─ storm-indigo-tinted block, rounded-2xl, left border ────┐│
│  │  [≡] [☐]  💼 Email BKS about follow-up                   ││
│  │  ● HIGH  |  TASK  |  📅 Today                            ││
│  └───────────────────────────────────────────────────────────┘│
│  ┌─ fern-green-tinted block ────────────────────────────────┐│
│  │  [≡] [☐]  🏠 Give Dahlia treats                          ││
│  │  ● MED   |  TASK  |  📅 Tomorrow                         ││
│  └───────────────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────────┘

  [Show completed (3)]  ← styled toggle button
```

---

## 4. Task Card Redesign (biggest change)

- Each task becomes a **color block** — background tinted by category color at ~15–20% opacity (readable on light), bold 4px left border in full category color, rounded-2xl.
- **Text**: Warm Ink #2D2A26 text-lg font-semibold with category emoji prefix
- **Priority**: Colored dot (pulsing for high/terracotta) + bold uppercase label, not a tiny badge
- **Type**: Colored pill — Lake Blue tinted for tasks, Golden Moss tinted for ideas
- **Due date**: Colored pill with calendar emoji; Terracotta for "Overdue", Golden Moss for "Today"
- **Checkbox**: Rounded-lg, border-2, fills Fern Green on complete with scale-up animation
- **Hover**: hover:scale-[1.02] with category-colored shadow glow
- **Completed**: opacity-60 + line-through + fern green tint
- **Edit mode**: Light inputs (warm white surface, Warm Ink text, rounded-xl)

---

## 5. Interactions & Delight

### Confetti on completion
When a task is marked complete, fire 30 small colored particles from the checkbox position using CSS @keyframes + temporary DOM elements. Colors: Terracotta, Golden Moss, Fern Green, Muted Berry, Lake Blue, Cloud Sand. Auto-cleanup after 800ms.

### Mic button pulse
When listening: Muted Berry background + expanding ring animation (box-shadow keyframes).

### Input focus glow
Lake Blue glow ring on focus: box-shadow: 0 0 0 3px rgba(63,108,122,0.4).

### Smooth transitions
All cards get transition-all duration-200. Hover scales up slightly. Drag state: opacity-50 rotate-1 scale-95.

### Fun empty state
Large emoji + bold Warm Ink text: "No tasks yet!" with a playful subheading in text secondary.

---

## 6. Calendar View Redesign

- Day containers: Warm white surface rounded-2xl with subtle border
- Today: ring-2 in Lake Blue, slightly warmer surface tint
- Day headings: text-xl font-bold in Warm Ink with day name in Lake Blue uppercase
- Tasks inside days: Same color-block style as list view
- Empty days: Dashed border with subtle "No tasks" message

---

## 7. Other Components

- **Sign-in page**: Light warm background (#F5F0E8) to match app
- **Category manager**: Warm white surface, earthy colored pills, light-themed inputs
- **Show/hide completed**: Styled toggle button with count badge in Fern Green accent
- **Notes expansion**: Warm white surface rounded-xl with subtle border
- **Clerk user button**: Use Clerk's default (light) appearance

---

## 8. Implementation Order

1. Foundation — Add Google Font, `<style>` block with CSS vars + keyframes, update body/container to light backgrounds
2. Color system — Replace getCategoryColor with getCategoryStyle (light-aware), add priority styling helpers
3. Header — Sticky light frosted bar, pill view toggle, colored stat badges
4. Input section — Light hero input with glow, gradient add button, mic animation
5. Filters — Inline colorful pills (remove heavy card wrapper)
6. Task cards — Color-block redesign, new checkbox, confetti on complete
7. Calendar view — Light theme, colored blocks, enhanced today highlight
8. Category manager — Light theme
9. Show/hide completed + empty states — Styled toggle, fun empty state
10. Polish — Test mobile responsiveness, drag-and-drop, Clerk on light, contrast checks

---

## Verification

- [ ] Start server (npm start), open in browser
- [ ] Verify light theme renders correctly
- [ ] Create tasks in different categories → confirm color-coded blocks
- [ ] Complete a task → confirm confetti animation fires
- [ ] Test voice input → confirm mic pulse animation
- [ ] Switch to calendar view → confirm light-themed calendar
- [ ] Test drag-and-drop reordering → confirm it still works with new card styles
- [ ] Test on narrow viewport → confirm mobile responsiveness
- [ ] Sign out and back in → confirm Clerk widget looks good on light background
