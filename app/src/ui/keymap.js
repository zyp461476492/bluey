/**
 * 遥控器 / 键盘统一按键层。
 *
 * 为什么要有这一层：之前按键散在 app.js 和 choices.js 两处，
 * 结果选项里方向键只在 4 个按钮之间打转，出不去；而在答案态按 ← →
 * 又是"切题"——同一颗键在不同地方含义不同，孩子会乱。
 *
 * 现在全应用只有一套语义：
 *   ← → ↑ ↓   移动焦点（空间导航，可跨区域）
 *   Enter / ␣  确认当前焦点；没有焦点时按状态做默认动作
 *   1–9        quiz 直接选第 N 项
 *   Backspace / Esc  返回上级
 *   r          重听
 *   其他任意键  解锁音频（浏览器要求先有用户手势）
 *
 * 约定：浮层打开时，焦点只在浮层内移动（scope 收紧），
 * 避免焦点跑到背后的卡片上——TV 上这是最常见的"卡住"来源。
 */

import { setInputMode, moveFocus, focusEl, collectFocusable } from './focus.js';

const DIRS = {
  ArrowRight: 'right',
  ArrowLeft: 'left',
  ArrowUp: 'up',
  ArrowDown: 'down'
};

const INTERACTIVE = 'button, a[href], input, select, textarea, [tabindex]';

/**
 * @param {object} opts
 * @param {() => Element} opts.getScope     当前允许焦点活动的容器
 * @param {(kind: string) => boolean} opts.onAction  收到语义动作，返回 true 表示已消费
 * @param {() => void} [opts.onAnyKey]      任意键都调用（用于解锁音频）
 */
export function createKeymap(opts) {
  const getScope = opts.getScope;
  const onAction = opts.onAction || function () { return false; };
  const onAnyKey = opts.onAnyKey || function () {};

  function key(e) {
    // 输入框里的方向键归输入框自己（现在没有输入框，但留个口子）
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    setInputMode('key');
    onAnyKey(e);

    const scope = getScope() || document;

    // ---- 返回上级 ----
    if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'Esc') {
      if (onAction('back')) e.preventDefault();
      return;
    }

    // ---- 数字键直接选 ----
    if (/^[1-9]$/.test(e.key)) {
      if (onAction('pick:' + (Number(e.key) - 1))) {
        e.preventDefault();
        return;
      }
    }

    // ---- 方向键 ----
    const dir = DIRS[e.key];
    if (dir) {
      // 先给业务层机会（比如 tab 组内切换），没消费就做空间导航
      if (onAction('move:' + dir)) {
        e.preventDefault();
        return;
      }
      if (moveFocus(scope, dir)) {
        e.preventDefault();
        return;
      }
      // 走到边界也别让页面滚动（TV 上滚动=画面乱跳）
      e.preventDefault();
      return;
    }

    // ---- 确认 ----
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      const active = document.activeElement;
      // 焦点在按钮上：主动 click。比依赖原生更可靠——
      // 部分 TV 浏览器 / 遥控器只发 keydown，不合成 click
      if (active && active !== document.body && active.matches && active.matches(INTERACTIVE)) {
        e.preventDefault();
        active.click();
        return;
      }
      if (onAction('confirm')) {
        e.preventDefault();
        return;
      }
      // 没焦点时落到第一个可聚焦元素，而不是什么都不发生
      const list = collectFocusable(scope);
      if (list.length) {
        e.preventDefault();
        focusEl(list[0]);
      }
      return;
    }

    // ---- 重听 ----
    if (e.key === 'r' || e.key === 'R') {
      if (onAction('replay')) e.preventDefault();
    }
  }

  document.addEventListener('keydown', key);

  // 鼠标/触摸一旦使用，就退出键盘模式（隐藏焦点环）
  function pointer() {
    setInputMode('pointer');
  }
  document.addEventListener('pointerdown', pointer, { passive: true });
  document.addEventListener('mousemove', pointer, { passive: true });
  document.addEventListener('touchstart', pointer, { passive: true });

  return {
    destroy: function () {
      document.removeEventListener('keydown', key);
      document.removeEventListener('pointerdown', pointer);
      document.removeEventListener('mousemove', pointer);
      document.removeEventListener('touchstart', pointer);
    }
  };
}
