import { CUSTOM_CATEGORY_COLORS, NEW_TASK_MINUTES } from './constants.js';
import { toLocalDateString } from './dates.js';

export const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

export const getCategoryStyle = (category, customCategories) => {
  const work = { hex: '#4B4F73', emoji: '💼' };
  const personal = { hex: '#4F7C59', emoji: '🏠' };
  const project = { hex: '#C65D3B', emoji: '🚀' };
  const map = { work, personal, project };
  let data = map[category];
  if (!data) {
    const i = customCategories.findIndex(c => c.name === category);
    const customEmoji = i >= 0 ? (customCategories[i].emoji || '📌') : '📌';
    data = { ...CUSTOM_CATEGORY_COLORS[i >= 0 ? i % CUSTOM_CATEGORY_COLORS.length : 0], emoji: customEmoji };
  }
  const hex = data.hex;
  return {
    bg: hexToRgba(hex, 0.18),
    border: hex,
    text: hex,
    badgeBg: hexToRgba(hex, 0.22),
    badgeText: hex,
    emoji: data.emoji
  };
};

export const getPriorityStyle = (priority) => {
  const high = { bg: '#C65D3B', text: '#C65D3B' };
  const medium = { bg: '#3F6C7A', text: '#3F6C7A' };
  const low = { bg: '#5E6B73', text: '#5E6B73' };
  const map = { high, medium, low };
  const d = map[priority] || low;
  return { badgeBg: hexToRgba(d.bg, 0.22), badgeText: d.text };
};

export const getCardBackground = (item) => {
  if (item.completed) return 'rgba(79,124,89,0.06)';
  const now = Date.now();
  const todayStr = toLocalDateString();
  if (item.dueDate && item.dueDate < todayStr) return 'rgba(198,93,59,0.08)';
  if (item.dueDate && item.dueDate === todayStr) return 'rgba(194,168,62,0.08)';
  if (item.createdAt) {
    const created = new Date(item.createdAt).getTime();
    if (now - created < NEW_TASK_MINUTES * 60 * 1000) return 'rgba(79,124,89,0.08)';
  }
  return '#FFFBF7';
};
