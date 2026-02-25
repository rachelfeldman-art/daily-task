import { WEEKDAY_INDEX } from './constants.js';

export const toLocalDateString = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getEndOfWeek = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return toLocalDateString(d);
};

export const getEndOfMonth = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 0);
  return toLocalDateString(d);
};

export const getDateForWeekday = (weekdayName) => {
  const targetDay = WEEKDAY_INDEX[weekdayName];
  if (targetDay === undefined) return null;
  const today = new Date();
  const currentDay = today.getDay();
  let daysAhead = targetDay - currentDay;
  if (daysAhead < 0) daysAhead += 7;
  const d = new Date(today);
  d.setDate(d.getDate() + daysAhead);
  return toLocalDateString(d);
};

export const getWeekdaysFromInput = (rawInput) => {
  if (!rawInput || typeof rawInput !== 'string') return [];
  const lower = rawInput.toLowerCase();
  const withIndex = [];
  for (const name of Object.keys(WEEKDAY_INDEX)) {
    let idx = lower.indexOf(name);
    if (idx !== -1) withIndex.push({ name, idx });
  }
  withIndex.sort((a, b) => a.idx - b.idx);
  return withIndex.map(({ name }) => name);
};

export const applyWeekdayDueDateFromInput = (item, rawInput, itemIndex, weekdaysInInput) => {
  const list = weekdaysInInput && weekdaysInInput.length > 0 ? weekdaysInInput : getWeekdaysFromInput(rawInput);
  const name = list.length > 0 ? list[Math.min(itemIndex, list.length - 1)] : null;
  if (!name) return item;
  const date = getDateForWeekday(name);
  return date ? { ...item, dueDate: date } : item;
};

export const applyDefaultDueDate = (item) => {
  if (item.dueDate) return item;
  const today = toLocalDateString();
  if (item.type === 'idea') {
    return { ...item, dueDate: getEndOfMonth() };
  }
  if (item.category === 'work') {
    return { ...item, dueDate: today };
  }
  return { ...item, dueDate: getEndOfWeek() };
};

function getGroupLabel(dateStr, todayStr) {
  if (dateStr === 'overdue') return 'Overdue';
  if (!dateStr) return 'No Date';
  if (dateStr === todayStr) return 'Today';
  const tomorrow = new Date(`${todayStr}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStr === toLocalDateString(tomorrow)) return 'Tomorrow';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Groups filtered items by due date into { key, dueDate, label, isToday, isOverdue, items }[]. */
export const groupFilteredItemsByDueDate = (filteredItems) => {
  const todayStr = toLocalDateString();
  const overdue = [];
  const byDate = new Map();
  let noDate = [];
  for (const item of filteredItems) {
    const due = item.dueDate || null;
    if (due && due < todayStr) overdue.push(item);
    else if (due) {
      if (!byDate.has(due)) byDate.set(due, []);
      byDate.get(due).push(item);
    } else noDate.push(item);
  }
  const sortedDates = [...byDate.keys()].sort();
  const groups = [];
  if (overdue.length) {
    const sorted = [...overdue].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    groups.push({ key: 'overdue', dueDate: 'overdue', label: 'Overdue', isToday: false, isOverdue: true, items: sorted });
  }
  for (const d of sortedDates) {
    const list = byDate.get(d);
    const sorted = [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    groups.push({ key: d, dueDate: d, label: getGroupLabel(d, todayStr), isToday: d === todayStr, isOverdue: false, items: sorted });
  }
  if (noDate.length) {
    const sorted = [...noDate].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    groups.push({ key: 'no-date', dueDate: null, label: 'No Date', isToday: false, isOverdue: false, items: sorted });
  }
  return groups;
};
