/**
 * 轻提示：一条小横条，自动消失。
 * 只用于"家长需要知道但不该打断孩子"的信息（比如缺英文语音）。
 */
export function createToast(el) {
  let timer = 0;

  function hide() {
    el.setAttribute('data-visible', 'false');
    timer = setTimeout(function () {
      el.hidden = true;
    }, 200);
  }

  function show(text, ms) {
    clearTimeout(timer);
    el.textContent = text;
    el.hidden = false;
    // 等一帧再加 visible，否则 transition 不生效
    requestAnimationFrame(function () {
      el.setAttribute('data-visible', 'true');
    });
    timer = setTimeout(hide, ms || 9000);
  }

  return { show: show, hide: hide };
}
