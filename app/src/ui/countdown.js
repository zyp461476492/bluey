/**
 * 倒计时进度环。
 * 用 requestAnimationFrame 而不是 setInterval：
 * TV 浏览器在后台标签页会节流 setInterval，导致环和数字不同步。
 * 见 docs/05-architecture.md 已知技术风险
 */
export function createCountdown(opts) {
  const fill = opts.fill;
  const num = opts.num;
  const root = opts.root;
  const onDone = opts.onDone;

  let rafId = 0;
  let startAt = 0;
  let duration = 0;
  let fired = false;

  function paint(ratio, seconds) {
    // pathLength=100 做了归一化，各浏览器环长一致
    fill.setAttribute('stroke-dashoffset', String((1 - ratio) * 100));
    num.textContent = String(seconds);
  }

  function frame(now) {
    const elapsed = now - startAt;
    const remain = Math.max(0, duration - elapsed);
    paint(duration > 0 ? remain / duration : 0, Math.ceil(remain / 1000));

    if (remain <= 1) {
      rafId = 0;
      if (!fired) {
        fired = true;
        if (typeof onDone === 'function') onDone();
      }
      return;
    }
    rafId = requestAnimationFrame(frame);
  }

  function start(ms) {
    stop();
    duration = ms;
    fired = false;
    startAt = performance.now();
    paint(1, Math.ceil(ms / 1000));
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function show() {
    root.hidden = false;
  }

  function hide() {
    root.hidden = true;
  }

  return { start: start, stop: stop, show: show, hide: hide };
}
