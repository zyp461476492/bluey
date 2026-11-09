/**
 * quiz 模式的 4 个选项。
 *
 * 方向键不在这里处理 —— 统一交给 ui/keymap.js + ui/focus.js 的空间导航。
 * 之前这里自己算 2×2 网格，结果焦点只能在 4 个选项里打转，出不去；
 * 两处都处理又会一次按键移动两格。一个应用只能有一个焦点实现。
 */
import { shuffle } from '../data/quiz.js';

export function createChoices(opts) {
  const root = opts.root;
  const onPick = opts.onPick;
  let buttons = [];
  let picked = false;

  function clear() {
    root.innerHTML = '';
    buttons = [];
    picked = false;
  }

  function buildOptions(item, count) {
    const answer = item.answer || {};
    const correct = { en: answer.en, zh: answer.zh, correct: true };
    const pool = [];

    const ds = Array.isArray(item.distractors) ? item.distractors : [];
    for (let i = 0; i < ds.length; i++) {
      if (!ds[i] || !ds[i].en) continue;
      if (ds[i].en === correct.en) continue;
      // 去重：同一干扰项写两次不算两个选项
      let dup = false;
      for (let k = 0; k < pool.length; k++) {
        if (pool[k].en === ds[i].en) {
          dup = true;
          break;
        }
      }
      if (!dup) pool.push({ en: ds[i].en, zh: ds[i].zh, correct: false });
    }

    const need = Math.max(1, count || 4) - 1;
    const picked4 = shuffle(pool).slice(0, need);
    // 干扰项不足时降级：少给几个选项，不报错
    return shuffle(picked4.concat([correct]));
  }

  function show(item, count) {
    clear();
    const options = buildOptions(item, count);

    options.forEach(function (opt, i) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'choice';
      btn.setAttribute('data-index', String(i));

      const en = document.createElement('span');
      en.className = 'choice-en';
      en.textContent = opt.en || '';

      const zh = document.createElement('span');
      zh.className = 'choice-zh';
      zh.textContent = opt.zh || '';

      btn.appendChild(en);
      btn.appendChild(zh);
      btn.addEventListener('click', function () {
        if (picked) return;
        picked = true;
        if (typeof onPick === 'function') onPick(i, opt);
      });

      root.appendChild(btn);
      buttons.push(btn);
      if (opt.correct) btn.setAttribute('data-correct', 'true');
    });

    root.hidden = false;
    return options;
  }

  /** 判定后上色：正确项高亮，选错的那项只降透明度（不出现红叉） */
  function markResult(chosenIndex) {
    picked = true;
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      const isCorrect = btn.getAttribute('data-correct') === 'true';
      if (isCorrect) btn.setAttribute('data-state', 'correct');
      else if (i === chosenIndex) btn.setAttribute('data-state', 'wrong');
      else btn.setAttribute('data-state', 'dim');
      btn.disabled = true;
    }
  }

  function hide() {
    root.hidden = true;
    clear();
  }

  function firstButton() {
    return buttons[0] || null;
  }

  function isActive() {
    return !root.hidden && !picked;
  }

  return {
    show: show,
    hide: hide,
    markResult: markResult,
    firstButton: firstButton,
    isActive: isActive
  };
}
