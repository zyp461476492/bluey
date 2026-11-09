/**
 * 答案区：英文 + 音标 + 中文 + 拼音。
 *
 * 用 visibility 而不是 display 切换 —— 提前占位，避免揭晓瞬间布局跳动。
 * 跳动会让孩子视线丢失，这是最容易被忽略的体验问题。
 * 见 docs/03-ux-devices.md §2.1
 */
export function createAnswer(els) {
  function setLine(lineEl, textEl, text) {
    if (text) {
      textEl.textContent = text;
      textEl.hidden = false;
    } else {
      textEl.textContent = '';
      textEl.hidden = true;
    }
    // 整行都没内容就隐藏，避免留下空行占位
    if (lineEl) {
      const hasAny = Array.prototype.some.call(lineEl.children, function (c) {
        return !c.hidden && c.textContent;
      });
      lineEl.hidden = !hasAny;
    }
  }

  function hide() {
    els.root.setAttribute('data-visible', 'false');
    els.root.setAttribute('aria-hidden', 'true');
    els.en.textContent = '';
    els.ipa.textContent = '';
    els.zh.textContent = '';
    els.pinyin.textContent = '';
  }

  function reveal(item, lang, opts) {
    const answer = item.answer || {};
    const showPinyin = !opts || opts.showPinyin !== false;
    const showEn = lang === 'en' || lang === 'both';
    const showZh = lang === 'zh' || lang === 'both';

    setLine(els.lineEn, els.en, showEn ? answer.en || '' : '');
    setLine(els.lineEn, els.ipa, showEn ? answer.ipa || '' : '');
    setLine(els.lineZh, els.zh, showZh ? answer.zh || '' : '');
    setLine(els.lineZh, els.pinyin, showZh && showPinyin ? answer.pinyin || '' : '');

    els.root.setAttribute('aria-hidden', 'false');
    els.root.setAttribute('data-visible', 'true');
  }

  return { hide: hide, reveal: reveal };
}
