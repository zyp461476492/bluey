import { createApp } from './ui/app.js';

function boot() {
  try {
    const app = createApp(document);
    app.init();
  } catch (err) {
    console.error('[boot] 初始化失败', err);
    // 这是模块加载就挂掉时的最后兜底：此时 i18n 可能根本没跑起来，
    // 所以文案直接写死，属于硬规则 4 的唯一例外，别在这里接 i18n。
    const box = document.getElementById('overlay');
    if (box) box.hidden = false;
    const title = document.getElementById('overlayTitle');
    const text = document.getElementById('overlayText');
    if (title) title.textContent = '启动失败 / Failed to start';
    if (text) text.textContent = (err && err.message) || String(err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
