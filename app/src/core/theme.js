/**
 * 主题：深色 / 浅色。
 * 实现方式只是给 <html> 加 data-theme，颜色全部走 CSS 变量覆盖，
 * 所以切换是零重绘成本的。
 * 见 docs/03-ux-devices.md
 */
import { read, write } from './storage.js';
import { CONFIG } from '../config.js';

export const THEMES = { DARK: 'dark', LIGHT: 'light' };

let current = THEMES.DARK;

export function systemTheme() {
  try {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return THEMES.LIGHT;
    }
  } catch (e) {
    /* 老浏览器没有 matchMedia，退回深色 */
  }
  return THEMES.DARK;
}

export function resolveInitial() {
  const saved = read(CONFIG.STORAGE_KEYS.theme, null);
  if (saved === THEMES.LIGHT || saved === THEMES.DARK) return saved;
  // 没存过就跟随系统
  return systemTheme();
}

export function applyTheme(theme) {
  current = theme === THEMES.LIGHT ? THEMES.LIGHT : THEMES.DARK;
  document.documentElement.setAttribute('data-theme', current);
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) meta.setAttribute('content', current === THEMES.LIGHT ? 'light' : 'dark');
  return current;
}

export function toggleTheme() {
  const next = current === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT;
  applyTheme(next);
  write(CONFIG.STORAGE_KEYS.theme, next);
  return next;
}

export function getTheme() {
  return current;
}
