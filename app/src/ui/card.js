/**
 * 图片卡片：加载态骨架 → 图片 / emoji 降级。
 * 关键点：show() 返回的 Promise 只在"图已可显示"或"已降级"时 resolve，
 * 上层据此才启动倒计时（否则图还没出来，思考时间就流走了）。
 */
const LOAD_TIMEOUT_MS = 8000;

export function createCard(els) {
  let token = 0;

  function clearView() {
    els.img.hidden = true;
    els.img.removeAttribute('src');
    els.emoji.hidden = true;
    els.emoji.textContent = '';
    els.skeleton.hidden = false;
    els.btn.disabled = true;
  }

  function showEmoji(item) {
    els.img.hidden = true;
    els.skeleton.hidden = true;
    els.emoji.textContent = (item.media && item.media.fallbackEmoji) || '❓';
    els.emoji.hidden = false;
    els.btn.disabled = false;
  }

  /** 外部主动清空（例如回 IDLE） */
  function reset() {
    token++;
    els.img.alt = '';
    clearView();
  }

  /**
   * @returns {Promise<{ok: boolean, reason?: string}>}
   * ok=false 且 reason='stale' 表示这次调用已被新的一次取代，调用方应直接丢弃。
   *
   * media.type === 'emoji'（或没有 src）时不发图片请求，直接显示 emoji。
   * 这是"词条先落地、图后补"的正式通道：不会产生 404，也没有骨架屏闪烁。
   */
  function show(item, assetBase) {
    token++;
    const myToken = token;
    clearView();

    const media = item.media || {};
    const alt = media.alt;
    els.img.alt = alt ? (alt.zh || alt.en || '') : '';

    if (media.type === 'emoji' || !media.src) {
      showEmoji(item);
      return Promise.resolve({ ok: true, reason: 'emoji' });
    }

    return new Promise(function (resolve) {
      let settled = false;

      function finish(result) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (myToken !== token) {
          resolve({ ok: false, reason: 'stale' });
          return;
        }
        resolve(result);
      }

      const timer = setTimeout(function () {
        showEmoji(item);
        finish({ ok: false, reason: 'timeout' });
      }, LOAD_TIMEOUT_MS);

      const pre = new Image();

      pre.onload = function () {
        els.img.src = assetBase + media.src;
        els.img.hidden = false;
        els.skeleton.hidden = true;
        els.btn.disabled = false;
        finish({ ok: true });
      };

      pre.onerror = function () {
        showEmoji(item);
        finish({ ok: false, reason: 'error' });
      };

      pre.src = assetBase + media.src;
    });
  }

  return { show: show, reset: reset };
}
