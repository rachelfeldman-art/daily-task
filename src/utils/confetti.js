import { CONFETTI_COLORS } from './constants.js';

export const fireConfetti = (sourceEl) => {
  if (!sourceEl || !sourceEl.getBoundingClientRect) return;
  const rect = sourceEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:9999';
  document.body.appendChild(container);
  const count = 30;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = 60 + Math.random() * 80;
    const dx = Math.cos(angle) * dist;
    const dy = -Math.abs(Math.sin(angle)) * dist - 20;
    el.style.cssText = `position:absolute;left:${cx}px;top:${cy}px;width:8px;height:8px;border-radius:2px;background:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};--cf-dx:${dx}px;--cf-dy:${dy}px;animation:confetti-fly 0.8s ease-out forwards`;
    container.appendChild(el);
  }
  setTimeout(() => container.remove(), 800);
};
