/**
 * 全屏浮层：错误态、本组完成都用它。
 * 自带焦点转移 —— 浮层出现后必须把焦点放到主按钮上，
 * 否则遥控器用户会卡在后面的内容上。
 */
export function createOverlay(els) {
  let onButton = null;

  function show(cfg) {
    els.title.textContent = cfg.title || '';
    els.text.textContent = cfg.text || '';

    if (cfg.code) {
      els.code.textContent = cfg.code;
      els.code.hidden = false;
    } else {
      els.code.textContent = '';
      els.code.hidden = true;
    }

    els.btn.textContent = cfg.buttonLabel || '';
    onButton = cfg.onButton || null;
    els.root.hidden = false;

    // 等一帧再聚焦，避免隐藏元素上聚焦失败
    requestAnimationFrame(function () {
      els.btn.focus();
    });
  }

  function hide() {
    els.root.hidden = true;
    onButton = null;
  }

  els.btn.addEventListener('click', function () {
    const fn = onButton;
    if (fn) fn();
  });

  return { show: show, hide: hide, isOpen: function () { return !els.root.hidden; } };
}
