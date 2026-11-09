/**
 * 焦点工具 —— 电视上焦点丢了就等于应用挂了。
 * 见 docs/03-ux-devices.md §3.3
 *
 * 这里做四件事：
 *   1. 记录当前输入模式（遥控器/键盘 vs 触摸/鼠标），焦点环只在键盘模式显示
 *   2. 空间导航：按方向键找"那个方向上最合适的元素"，不是按 DOM 顺序 Tab
 *   3. 聚焦工具（带 preventScroll，避免 TV 上页面乱跳）
 *   4. 作用域内的可聚焦元素收集
 *
 * 为什么不用 Tab 顺序：TV 上没有 Tab 键，遥控器只有四向 + 确认。
 * 而且 DOM 顺序 ≠ 视觉位置，2×2 选项网格里 Tab 会把焦点带到奇怪的地方。
 */

const FOCUSABLE = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

/** 'key' | 'pointer'。挂到 <html data-input>，CSS 用它决定是否显示焦点环 */
export function setInputMode(mode) {
  const el = document.documentElement;
  if (el.dataset.input !== mode) el.dataset.input = mode;
}

export function getInputMode() {
  return document.documentElement.dataset.input || 'pointer';
}

export function isKeyboardMode() {
  return getInputMode() === 'key';
}

export function focusEl(el) {
  if (!el || el.disabled || typeof el.focus !== 'function') return false;
  if (el.closest('[hidden]')) return false;
  try {
    el.focus({ preventScroll: true });
  } catch (e) {
    el.focus();
  }
  return document.activeElement === el;
}

/** 作用域内所有"看得见、点得着"的元素，按 DOM 顺序 */
export function collectFocusable(scope) {
  const root = scope || document;
  const found = Array.prototype.slice.call(root.querySelectorAll(FOCUSABLE));
  return found.filter(function (el) {
    if (el.disabled) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    if (el.closest('[hidden]')) return false;
    // offsetParent 为 null 说明 display:none 或不在布局流里
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

export function focusFirst(scope) {
  const list = collectFocusable(scope);
  return list.length ? focusEl(list[0]) : false;
}

/**
 * 空间导航：从当前焦点出发，往 dir 方向找最合适的元素。
 *
 * 打分 = 主轴距离 + 副轴偏移 × 2
 *   副轴权重给 2，是为了在同排/同列优先——2×2 网格里按 → 不会跳到下一排。
 * 找不到就原地不动，不做环绕：TV 上"焦点跑到屏幕另一端"比"不动"更让人慌。
 */
export function moveFocus(scope, dir) {
  const list = collectFocusable(scope);
  if (!list.length) return false;

  const active = document.activeElement;
  let cur = list.indexOf(active);
  if (cur === -1) {
    focusEl(list[0]);
    return true;
  }

  const cr = active.getBoundingClientRect();
  const cx = cr.left + cr.width / 2;
  const cy = cr.top + cr.height / 2;

  let best = null;
  let bestScore = Infinity;

  for (let i = 0; i < list.length; i++) {
    if (i === cur) continue;
    const el = list[i];
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const dx = x - cx;
    const dy = y - cy;

    let primary;
    let secondary;
    if (dir === 'right') {
      if (dx <= 2) continue;
      primary = dx;
      secondary = Math.abs(dy);
    } else if (dir === 'left') {
      if (dx >= -2) continue;
      primary = -dx;
      secondary = Math.abs(dy);
    } else if (dir === 'down') {
      if (dy <= 2) continue;
      primary = dy;
      secondary = Math.abs(dx);
    } else if (dir === 'up') {
      if (dy >= -2) continue;
      primary = -dy;
      secondary = Math.abs(dx);
    } else {
      return false;
    }

    const score = primary + secondary * 2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }

  if (!best) return false;
  return focusEl(best);
}

export function moveFocusBy(scope, delta) {
  const list = collectFocusable(scope);
  if (!list.length) return false;
  const i = list.indexOf(document.activeElement);
  const next = i === -1 ? 0 : (i + delta + list.length) % list.length;
  return focusEl(list[next]);
}
