/**
 * 设置面板（底部抽屉 / TV 上为居中面板）。
 *
 * 为什么要收进抽屉：之前语言、发音、年龄段、主题四个入口散在顶栏，
 * 顶栏挤、可点区域小，TV 上尤其难按。抽屉把它们收拢成"一个设置按钮"，
 * 每行高度足够遥控器操作。
 *
 * 行类型只有两种，够用且好维护：
 *   segment —— 横向单选（语言、发音开关、语速、倒计时、主题外观）
 *   link    —— 一行可点，右侧显示当前值（跳去选年龄、选主题）
 */

export function createSettings(o) {
  const root = o.root;
  const list = o.list;
  const els = {
    title: o.title,
    close: o.close,
    hint: o.hint
  };

  let rows = [];

  function clear() {
    list.innerHTML = '';
    rows = [];
  }

  function addSegment(labelText, options, current, onPick) {
    const row = document.createElement('div');
    row.className = 'sheet-row';

    const label = document.createElement('span');
    label.className = 'sheet-label';
    label.textContent = labelText;

    const group = document.createElement('div');
    group.className = 'seg';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', labelText);

    options.forEach(function (opt) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'seg-item';
      btn.textContent = opt.label;
      if (opt.id === current) btn.setAttribute('data-on', 'true');
      btn.addEventListener('click', function () {
        const touched = Array.prototype.slice.call(group.children);
        touched.forEach(function (b) {
          b.setAttribute('data-on', String(b === btn));
        });
        onPick(opt.id);
      });
      group.appendChild(btn);
    });

    row.append(label, group);
    list.appendChild(row);
  }

  function addLink(labelText, valueText, onOpen) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'sheet-row sheet-row--link';

    const label = document.createElement('span');
    label.className = 'sheet-label';
    label.textContent = labelText;

    const value = document.createElement('span');
    value.className = 'sheet-value';
    value.textContent = valueText;

    const caret = document.createElement('span');
    caret.className = 'sheet-caret';
    caret.setAttribute('aria-hidden', 'true');
    caret.textContent = '›';

    row.append(label, value, caret);
    row.addEventListener('click', onOpen);
    list.appendChild(row);
  }

  /**
   * @param {object} s
   * @param {string} s.lang        'both' | 'zh' | 'en'
   * @param {boolean} s.tts
   * @param {string} s.rate        'slow' | 'normal' | 'fast'
   * @param {string|number} s.countdown  'auto' | 3000 | 5000 | 8000
   * @param {boolean} s.showCountdown    flashcard 模式无倒计时，不显示该行
   * @param {string} s.ageLabel
   * @param {string} s.categoryLabel
   */
  function show(s) {
    clear();

    addSegment(
      o.t('setLang'),
      [
        { id: 'both', label: o.t('langBoth') },
        { id: 'zh', label: o.t('langZh') },
        { id: 'en', label: o.t('langEn') }
      ],
      s.lang,
      o.onLang
    );

    addSegment(
      o.t('setTts'),
      [
        { id: 'on', label: o.t('on') },
        { id: 'off', label: o.t('off') }
      ],
      s.tts ? 'on' : 'off',
      function (id) {
        o.onTts(id === 'on');
      }
    );

    addSegment(
      o.t('setRate'),
      [
        { id: 'slow', label: o.t('rateSlow') },
        { id: 'normal', label: o.t('rateNormal') },
        { id: 'fast', label: o.t('rateFast') }
      ],
      s.rate,
      o.onRate
    );

    if (s.showCountdown !== false) {
      addSegment(
        o.t('setCd'),
        [
          { id: 'auto', label: o.t('cdAuto') },
          { id: '3000', label: o.t('cdSeconds', { n: 3 }) },
          { id: '5000', label: o.t('cdSeconds', { n: 5 }) },
          { id: '8000', label: o.t('cdSeconds', { n: 8 }) }
        ],
        String(s.countdown),
        function (id) {
          o.onCountdown(id === 'auto' ? 'auto' : Number(id));
        }
      );
    }

    addSegment(
      o.t('theme'),
      [
        { id: 'dark', label: o.t('themeDark') },
        { id: 'light', label: o.t('themeLight') }
      ],
      s.theme,
      o.onTheme
    );

    addLink(o.t('setAge'), s.ageLabel, o.onAge);
    addLink(o.t('setCategory'), s.categoryLabel, o.onCategory);

    els.title.textContent = o.t('settings');
    els.hint.textContent = o.t('keyHint');
    root.hidden = false;
    root.setAttribute('data-open', 'true');
  }

  function hide() {
    root.hidden = true;
    root.setAttribute('data-open', 'false');
  }

  function isOpen() {
    return !root.hidden;
  }

  els.close.addEventListener('click', function () {
    if (typeof o.onClose === 'function') o.onClose();
  });

  // 点遮罩空白处关闭（触摸端习惯）
  root.addEventListener('click', function (e) {
    if (e.target === root && typeof o.onClose === 'function') o.onClose();
  });

  return { show: show, hide: hide, isOpen: isOpen };
}
