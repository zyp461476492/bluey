/**
 * 通用选择页：年龄档、主题都用它。
 *
 * items: [{ id, icon, label, hint }]
 * 之所以做成通用：这两个选择页的交互完全一样（大卡片、焦点落当前项、
 * 遥控器可操作），写两份只会让以后的修改要做两遍。
 */
export function createPicker(opts) {
  const root = opts.root;
  const title = opts.title;
  const hint = opts.hint;
  const list = opts.list;
  let onPick = null;

  function render(items, selectedId) {
    list.innerHTML = '';

    items.forEach(function (item) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'picker-item';
      if (item.id === selectedId) btn.setAttribute('data-current', 'true');
      if (item.disabled) btn.setAttribute('data-disabled', 'true');

      const icon = document.createElement('span');
      icon.className = 'picker-icon';
      icon.textContent = item.icon || '';

      const label = document.createElement('span');
      label.className = 'picker-label';
      label.textContent = item.label || '';

      const sub = document.createElement('span');
      sub.className = 'picker-hint';
      sub.textContent = item.hint || '';

      btn.appendChild(icon);
      btn.appendChild(label);
      btn.appendChild(sub);

      btn.addEventListener('click', function () {
        if (item.disabled) return;
        if (typeof onPick === 'function') onPick(item.id);
      });

      list.appendChild(btn);
    });
  }

  function show(cfg) {
    title.textContent = cfg.title;
    hint.textContent = cfg.hint;
    onPick = cfg.onPick;
    render(cfg.items, cfg.selectedId);
    root.hidden = false;

    // 焦点落到当前项（没有就第一项），遥控器用户直接能操作
    requestAnimationFrame(function () {
      const all = list.querySelectorAll('.picker-item');
      let target = list.querySelector('.picker-item[data-current="true"]');
      if (!target) target = all[0];
      if (target) target.focus();
    });
  }

  function hide() {
    root.hidden = true;
    onPick = null;
  }

  function isOpen() {
    return !root.hidden;
  }

  return { show: show, hide: hide, isOpen: isOpen };
}
