/**
 * 顶层控制器：把 store / 状态机 / 卡片 / 倒计时 / 答案 / 选项 / 发音 串起来。
 *
 * 四条最关键的纪律（这类应用 90% 的 bug 出在这几处）：
 *   1. 进入 ANSWER_SHOWN 必须停掉倒计时与自动翻页定时器
 *   2. 所有异步回调都要校验 runToken —— 快速连点下一题时，
 *      上一题的图片 onload 可能在新题之后到达，会把答案串掉
 *   3. 模式差异只走配置参数，不在代码里按年龄写 if
 *   4. 音频失败不影响状态机
 */
import { CONFIG } from '../config.js';
import { createStore } from '../core/store.js';
import { STATES, assertTransition } from '../core/state-machine.js';
import { applyTheme, toggleTheme, resolveInitial, getTheme, THEMES } from '../core/theme.js';
import { read as readStore, write as writeStore } from '../core/storage.js';
import { loadAll, clearCache } from '../data/loader.js';
import { loadProfiles, getProfile, filterByProfile, labelOf, hintOf } from '../data/profiles.js';
import { buildQueue, indexById, filterPlayable } from '../data/quiz.js';
import { createCard } from './card.js';
import { createCountdown } from './countdown.js';
import { createAnswer } from './answer.js';
import { createChoices } from './choices.js';
import { createPicker } from './picker.js';
import { createOverlay } from './overlay.js';
import { createToast } from './toast.js';
import * as speech from './speech.js';
import { focusEl, focusFirst, setInputMode } from './focus.js';
import { createKeymap } from './keymap.js';
import { createSettings } from './settings.js';
import { t, setLang } from '../i18n/ui-strings.js';

export function createApp(doc) {
  const byId = function (id) {
    return doc.getElementById(id);
  };

  const els = {
    root: byId('app'),
    cardBtn: byId('cardBtn'),
    img: byId('cardImg'),
    emoji: byId('cardEmoji'),
    skeleton: byId('skeleton'),
    countdown: byId('countdown'),
    ringFill: byId('ringFill'),
    ringNum: byId('ringNum'),
    choices: byId('choices'),
    answer: byId('answer'),
    lineEn: byId('lineEn'),
    lineZh: byId('lineZh'),
    answerEn: byId('answerEn'),
    answerIpa: byId('answerIpa'),
    answerZh: byId('answerZh'),
    answerPinyin: byId('answerPinyin'),
    speakBtn: byId('speakBtn'),
    nextBtn: byId('nextBtn'),
    counter: byId('counter'),
    crumbIcon: byId('crumbIcon'),
    crumbName: byId('crumbName'),
    ageBtn: byId('ageBtn'),
    settingsBtn: byId('settingsBtn'),
    keyHint: byId('keyHint'),
    sheet: byId('settingsSheet'),
    sheetTitle: byId('sheetTitle'),
    sheetRows: byId('sheetRows'),
    sheetClose: byId('sheetClose'),
    sheetHint: byId('sheetHint'),
    categoryBtn: byId('categoryBtn'),
    agePicker: byId('agePicker'),
    pickerTitle: byId('pickerTitle'),
    pickerHint: byId('pickerHint'),
    pickerList: byId('pickerList'),
    categoryPicker: byId('categoryPicker'),
    catTitle: byId('catTitle'),
    catHint: byId('catHint'),
    catList: byId('catList'),
    overlay: byId('overlay'),
    overlayTitle: byId('overlayTitle'),
    overlayText: byId('overlayText'),
    overlayCode: byId('overlayCode'),
    overlayBtn: byId('overlayBtn'),
    toast: byId('toast')
  };

  const store = createStore({
    status: STATES.IDLE,
    queue: [],
    pool: [],
    itemsById: {},
    profiles: [],
    profile: null,
    categories: [],
    categoryId: 'all',
    index: -1,
    total: 0,
    lang: CONFIG.DEFAULT_LANG,
    tts: true,
    current: null
  });

  const card = createCard({ img: els.img, emoji: els.emoji, skeleton: els.skeleton, btn: els.cardBtn });

  const answer = createAnswer({
    root: els.answer,
    lineEn: els.lineEn,
    lineZh: els.lineZh,
    en: els.answerEn,
    ipa: els.answerIpa,
    zh: els.answerZh,
    pinyin: els.answerPinyin
  });

  const overlay = createOverlay({
    root: els.overlay,
    title: els.overlayTitle,
    text: els.overlayText,
    code: els.overlayCode,
    btn: els.overlayBtn
  });

  const agePicker = createPicker({
    root: els.agePicker,
    title: els.pickerTitle,
    hint: els.pickerHint,
    list: els.pickerList
  });

  const categoryPicker = createPicker({
    root: els.categoryPicker,
    title: els.catTitle,
    hint: els.catHint,
    list: els.catList
  });

  const settings = createSettings({
    root: els.sheet,
    list: els.sheetRows,
    title: els.sheetTitle,
    close: els.sheetClose,
    hint: els.sheetHint,
    t: t,
    onLang: function (lang) {
      store.set({ lang: lang });
      writeStore(CONFIG.STORAGE_KEYS.lang, lang);
      const s = store.get();
      // 只在答案已经显示时重绘，否则会把答案提前泄露给还在猜的孩子
      if (s.current && s.status === STATES.ANSWER_SHOWN) {
        answer.reveal(s.current, lang, { showPinyin: !!(s.profile && s.profile.showPinyin) });
        speakCurrent();
      }
    },
    onTts: function (on) {
      store.set({ tts: on });
      writeStore(CONFIG.STORAGE_KEYS.tts, on);
      if (!on) stopSpeech();
    },
    onTheme: function (id) {
      applyTheme(id);
    },
    onAge: function () {
      closeSettings();
      openPicker(false);
    },
    onCategory: function () {
      closeSettings();
      openCategoryPicker();
    },
    onClose: closeSettings
  });

  const toast = createToast(els.toast);

  const choices = createChoices({
    root: els.choices,
    onPick: function (index) {
      reveal(activeToken, index);
    }
  });

  let runToken = 0;
  let activeToken = 0;
  let autoTimer = 0;
  let paused = false;
  let speechReady = speech.isSupported();
  let voiceWarned = false;

  /**
   * 这台机器有没有英文语音？没有的话英文永远不会出声，
   * 家长会以为是应用坏了 —— 提示一次，别反复打扰。
   */
  function maybeWarnNoEnglish() {
    if (voiceWarned) return;
    const report = speech.getVoiceReport();
    if (!report.total) return; // 语音列表还没加载出来，下次再看
    voiceWarned = true;
    if (!report.english) toast.show(t('noEnglishVoice'), 12000);
  }

  const countdown = createCountdown({
    root: els.countdown,
    fill: els.ringFill,
    num: els.ringNum,
    onDone: function () {
      reveal(activeToken);
    }
  });

  function setStatus(next) {
    const from = store.get().status;
    if (from === next) return;
    assertTransition(from, next);
    store.set({ status: next });
  }

  function modeOf() {
    const p = store.get().profile;
    return p ? p.mode : 'reveal';
  }

  function render(state) {
    els.root.setAttribute('data-status', state.status);
    els.root.setAttribute('data-mode', state.profile ? state.profile.mode : 'reveal');

    if (state.total > 0 && state.index >= 0) {
      els.counter.textContent = t('counter', { current: state.index + 1, total: state.total });
    } else {
      els.counter.textContent = '';
    }
    // 左上角显示"当前选的主题"，不是"当前这道题的主题"——
    // 一轮里主题是固定的，跟着题变反而让人以为选错了
    updateCategoryBtn();

    // 遥控器提示条：文字随状态变；是否显示由 CSS 决定（只在键盘模式下出现）
    if (els.keyHint) {
      let hint = '';
      if (state.status === STATES.COUNTDOWN) {
        hint = modeOf() === 'quiz' ? t('keyHintQuiz') : t('keyHintReveal');
      } else if (state.status === STATES.ANSWER_SHOWN) {
        hint = t('keyHintPlay');
      }
      els.keyHint.textContent = hint;
    }
  }

  store.subscribe(render);

  /* ---------------- 发音 ---------------- */

  function buildSpeechItems(item, lang) {
    const order = CONFIG.TTS.order || ['en', 'zh'];
    const items = [];
    for (let i = 0; i < order.length; i++) {
      const code = order[i];
      if (lang !== 'both' && lang !== code) continue;
      const text =
        (item.speech && item.speech[code]) || (item.answer && item.answer[code]) || '';
      if (!text) continue;
      items.push({ text: text, lang: CONFIG.TTS.langs[code] || (code === 'zh' ? 'zh-CN' : 'en-US') });
    }
    return items;
  }

  function speakCurrent() {
    const s = store.get();
    if (!s.current) return;
    if (s.tts === false) return;      // 用户在设置里关了发音

    if (!speechReady) {
      els.speakBtn.setAttribute('title', t('speakUnsupported'));
      return;
    }

    const items = buildSpeechItems(s.current, s.lang);
    if (!items.length) return;

    maybeWarnNoEnglish();

    const rate = s.profile && s.profile.ttsRate ? s.profile.ttsRate : CONFIG.TTS.rate;

    speech.cancel();
    els.speakBtn.setAttribute('data-playing', 'true');
    speech.speakAll(items, rate).then(function () {
      els.speakBtn.setAttribute('data-playing', 'false');
    });
  }

  function stopSpeech() {
    speech.cancel();
    els.speakBtn.setAttribute('data-playing', 'false');
    // speakAll 结束后会再置一次 false，这里先置避免按钮一直亮
  }

  /* ---------------- 出题流程 ---------------- */

  function clearTimers() {
    countdown.stop();
    countdown.hide();
    clearTimeout(autoTimer);
    autoTimer = 0;
    paused = false;
    els.root.removeAttribute('data-paused');
  }

  function scheduleAutoAdvance(token, profile) {
    clearTimeout(autoTimer);
    if (!profile.autoAdvanceMs) return;
    autoTimer = setTimeout(function () {
      if (token !== runToken || paused) return;
      goNext();
    }, profile.autoAdvanceMs);
  }

  function beginQuestion(token, item) {
    const p = store.get().profile;
    activeToken = token;

    if (p.mode === 'flashcard') {
      // 2 岁不做"猜"：图、词、发音同时给，没有悬念
      setStatus(STATES.ANSWER_SHOWN);
      answer.reveal(item, 'both', { showPinyin: !!p.showPinyin });
      if (CONFIG.TTS.enabled) speakCurrent();
      focusEl(els.nextBtn);
      scheduleAutoAdvance(token, p);
      return;
    }

    setStatus(STATES.COUNTDOWN);
    els.cardBtn.setAttribute('aria-label', t('revealHint'));
    countdown.show();
    countdown.start(p.revealDelayMs || CONFIG.COUNTDOWN_MS);

    // 焦点默认落在卡片上：遥控器按 Enter 就是"立即揭晓"
    if (p.mode !== 'quiz') focusEl(els.cardBtn);

    if (p.mode === 'quiz') {
      choices.show(item, p.optionCount || CONFIG.OPTION_COUNT);
      focusEl(choices.firstButton());
    }
  }

  function nextQuestion() {
    const s = store.get();

    if (!s.queue.length) {
      showDone();
      return;
    }

    runToken++;
    const token = runToken;

    clearTimers();
    choices.hide();
    answer.hide();
    stopSpeech();
    els.cardBtn.setAttribute('aria-label', t('revealHint'));

    const item = s.itemsById[s.queue[0]];
    store.set({ current: item, index: s.index + 1 });
    setStatus(STATES.LOADING_MEDIA);

    card.show(item, CONFIG.PATHS.ASSET_BASE).then(function (res) {
      if (token !== runToken) return; // 已被新题取代，丢弃
      if (res.reason === 'stale') return;
      // 图片失败也照样继续 —— 用 emoji 兜底，流程不中断
      beginQuestion(token, item);
    });
  }

  function reveal(token, chosenIndex) {
    if (token !== runToken) return;
    const s = store.get();
    if (s.status !== STATES.COUNTDOWN) return;

    countdown.stop();
    countdown.hide();

    if (s.profile.mode === 'quiz') {
      choices.markResult(typeof chosenIndex === 'number' ? chosenIndex : -1);
    } else {
      choices.hide();
    }

    setStatus(STATES.ANSWER_SHOWN);
    answer.reveal(s.current, s.lang, { showPinyin: !!s.profile.showPinyin });
    focusEl(els.nextBtn);

    if (CONFIG.TTS.enabled) speakCurrent();
  }

  function goNext() {
    if (store.get().status !== STATES.ANSWER_SHOWN) return;
    clearTimeout(autoTimer);
    const queue = store.get().queue.slice();
    queue.shift();
    store.set({ queue: queue });
    nextQuestion();
  }

  /* ---------------- 年龄档 ---------------- */

  function updateAgeBtn() {
    const p = store.get().profile;
    if (!p) {
      els.ageBtn.textContent = '';
      return;
    }
    els.ageBtn.textContent = (p.icon ? p.icon + ' ' : '') + labelOf(p, 'zh');
    els.ageBtn.setAttribute('aria-label', t('ageAria') + '：' + labelOf(p, 'zh'));
    els.ageBtn.setAttribute('title', t('ageAria'));
  }

  function openPicker(isFirst) {
    const profiles = store.get().profiles;
    agePicker.show({
      title: t(isFirst ? 'pickerTitleFirst' : 'pickerTitle'),
      hint: t('pickerHint'),
      items: profiles.map(function (p) {
        return { id: p.id, icon: p.icon, label: labelOf(p, 'zh'), hint: hintOf(p, 'zh') };
      }),
      selectedId: store.get().profile ? store.get().profile.id : null,
      onPick: function (id) {
        agePicker.hide();
        applyProfile(id);
      }
    });
  }

  function applyProfile(id) {
    const p = getProfile(store.get().profiles, id);
    store.set({ profile: p });
    writeStore(CONFIG.STORAGE_KEYS.age, p.id);
    updateAgeBtn();
    restart(p);
  }

  /* ---------------- 主题 ---------------- */

  function currentCategory() {
    const id = store.get().categoryId;
    const list = store.get().categories;
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function updateCategoryBtn() {
    const cat = currentCategory();
    const name = cat ? cat.name.zh || cat.name.en || '' : t('categoryAll');
    els.crumbIcon.textContent = cat ? cat.icon || '' : '🎲';
    els.crumbName.textContent = name;
    els.categoryBtn.setAttribute('aria-label', t('categoryAria') + '：' + name);
    els.categoryBtn.setAttribute('title', t('categoryAria'));
  }

  function openCategoryPicker() {
    const list = store.get().categories.slice();
    const items = [
      { id: 'all', icon: '🎲', label: t('categoryAll'), hint: t('categoryAllHint') }
    ];
    for (let i = 0; i < list.length; i++) {
      const n = countInCategory(list[i].id);
      const name = (list[i].name.en || '');
      items.push({
        id: list[i].id,
        icon: list[i].icon,
        label: list[i].name.zh || name,
        hint: n > 0 ? name + ' · ' + n + t('unitWords') : t('categoryPending'),
        disabled: n === 0
      });
    }

    categoryPicker.show({
      title: t('categoryTitle'),
      hint: t('categoryHint'),
      items: items,
      selectedId: store.get().categoryId,
      onPick: function (id) {
        categoryPicker.hide();
        applyCategory(id);
      }
    });
  }

  /** 只算"能出题"的词；待配图的 pending 词不计入，否则会显示一个点了就空的主题 */
  function countInCategory(id) {
    const pool = store.get().pool;
    let n = 0;
    for (let i = 0; i < pool.length; i++) {
      if (id !== 'all' && pool[i].categoryId !== id) continue;
      const media = pool[i].media || {};
      if (media.type === 'pending') continue;
      n++;
    }
    return n;
  }

  function applyCategory(id) {
    store.set({ categoryId: id });
    writeStore(CONFIG.STORAGE_KEYS.category, id);
    updateCategoryBtn();
    restart();
  }

  /* ---------------- 设置面板 ---------------- */

  let settingsReturnFocus = null;

  function openSettings() {
    const s = store.get();
    settingsReturnFocus = doc.activeElement;

    const cat = s.categoryId === 'all' ? null : currentCategory();
    const catLabel = cat ? (cat.name.zh || cat.name.en) : t('categoryAll');

    settings.show({
      lang: s.lang,
      tts: s.tts !== false,
      ageLabel: s.profile ? labelOf(s.profile) : '—',
      categoryLabel: catLabel,
      theme: getTheme()
    });
    els.settingsBtn.setAttribute('aria-expanded', 'true');
    // 焦点进面板第一项设置，而不是右上角的 ✕ ——
    // 遥控器打开设置就是要改东西，先落在"关闭"上等于多按一次
    window.setTimeout(function () {
      if (!focusFirst(els.sheetRows)) focusFirst(els.sheet);
    }, 0);
  }

  function closeSettings() {
    if (!settings.isOpen()) return;
    settings.hide();
    els.settingsBtn.setAttribute('aria-expanded', 'false');
    if (settingsReturnFocus && !settingsReturnFocus.closest('[hidden]')) {
      focusEl(settingsReturnFocus);
    } else {
      focusEl(els.settingsBtn);
    }
  }

  /* ---------------- 结束 / 错误 ---------------- */

  function showDone() {
    clearTimers();
    stopSpeech();
    setStatus(STATES.IDLE);
    overlay.show({
      title: t('doneTitle'),
      text: t('doneText', { total: store.get().total }),
      buttonLabel: t('restart'),
      onButton: function () {
        restart();
      }
    });
  }

  function showEmpty() {
    setStatus(STATES.ERROR_STATE);
    overlay.show({
      title: t('errEmptyTitle'),
      text: t('errEmptyText'),
      buttonLabel: t('errRetry'),
      onButton: function () {
        restart();
      }
    });
  }

  function showError(err) {
    setStatus(STATES.ERROR_STATE);
    const isFetch = err && (err.code === 'FETCH_FAILED' || err.code === 'PARSE_FAILED');
    overlay.show({
      title: t('errTitle'),
      text: isFetch ? t('errFetchHint') : (err && err.message) || 'Unknown error',
      code: isFetch ? '' : (err && err.path) || '',
      buttonLabel: t('errRetry'),
      onButton: function () {
        clearCache();
        boot();
      }
    });
    console.error('[app]', err);
  }

  /* ---------------- 入口 ---------------- */

  function restart(profile) {
    const p = profile || store.get().profile;
    if (!p) return;

    overlay.hide();
    clearTimers();
    choices.hide();
    answer.hide();
    stopSpeech();
    setLang(CONFIG.DEFAULT_LANG);
    els.nextBtn.textContent = t('next');

    const categoryId = store.get().categoryId;
    const pool = filterPlayable(filterByProfile(store.get().pool, p)).filter(function (item) {
      return categoryId === 'all' || item.categoryId === categoryId;
    });

    let queue = buildQueue(pool);
    if (p.maxPerSession && queue.length > p.maxPerSession) {
      queue = queue.slice(0, p.maxPerSession);
    }

    if (!queue.length) {
      showEmpty();
      return;
    }

    store.set({ queue: queue, total: queue.length, index: -1, current: null });
    nextQuestion();
  }

  function boot() {
    overlay.hide();
    return Promise.all([loadProfiles(), loadAll()])
      .then(function (res) {
        const profiles = res[0];
        const data = res[1];
        const categories = data.index && data.index.categories ? data.index.categories : [];

        // 恢复上次选的主题。两种情况都回落到"全部"：
        //   1. 存的 id 已经不存在（改了题库）
        //   2. 该主题一个能玩的词都没有（全是待配图）
        const savedCat = readStore(CONFIG.STORAGE_KEYS.category, 'all');
        let catOk = savedCat === 'all';
        if (!catOk) {
          for (let c = 0; c < categories.length; c++) {
            if (categories[c].id !== savedCat) continue;
            for (let i = 0; i < data.items.length; i++) {
              const it = data.items[i];
              if (it.categoryId === savedCat && (it.media || {}).type !== 'pending') catOk = true;
            }
          }
        }

        // 语言与发音开关跟着上次的选择；非法值一律回落默认
        const savedLang = readStore(CONFIG.STORAGE_KEYS.lang, null);
        const langOk = savedLang === 'both' || savedLang === 'zh' || savedLang === 'en';
        const savedTts = readStore(CONFIG.STORAGE_KEYS.tts, null);

        store.set({
          profiles: profiles,
          pool: data.items,
          itemsById: indexById(data.items),
          categories: categories,
          categoryId: catOk ? savedCat : 'all',
          lang: langOk ? savedLang : CONFIG.DEFAULT_LANG,
          tts: savedTts === null ? true : !!savedTts
        });
        updateCategoryBtn();

        const saved = readStore(CONFIG.STORAGE_KEYS.age, null);
        let has = false;
        for (let i = 0; i < profiles.length; i++) {
          if (profiles[i].id === saved) has = true;
        }

        if (has) {
          applyProfile(saved);
        } else {
          // 首次使用：必须先选年龄档，否则玩法是猜的
          openPicker(true);
        }
      })
      .catch(function (err) {
        showError(err);
      });
  }

  function init() {
    doc.title = t('appTitle');
    els.nextBtn.textContent = t('next');
    answer.hide();
    countdown.hide();
    choices.hide();
    applyTheme(resolveInitial());
    render(store.get());

    if (speechReady) {
      els.speakBtn.textContent = '🔊 ' + t('speak');
      els.speakBtn.setAttribute('aria-label', t('speak'));
    } else {
      els.speakBtn.textContent = '🔇 ' + t('speak');
      els.speakBtn.setAttribute('aria-label', t('speakUnsupported'));
      els.speakBtn.setAttribute('title', t('speakUnsupported'));
    }

    els.cardBtn.addEventListener('click', function () {
      const s = store.get();
      if (s.status === STATES.COUNTDOWN) {
        reveal(activeToken);
        return;
      }
      // 闪卡模式：点一下暂停/继续（避免 2 岁孩子乱点把题全部跳过）
      if (s.status === STATES.ANSWER_SHOWN && modeOf() === 'flashcard') {
        paused = !paused;
        if (paused) {
          clearTimeout(autoTimer);
          els.root.setAttribute('data-paused', 'true');
          stopSpeech();
        } else {
          els.root.removeAttribute('data-paused');
          scheduleAutoAdvance(activeToken, s.profile);
        }
      }
    });

    els.nextBtn.addEventListener('click', goNext);

    els.speakBtn.addEventListener('click', function () {
      speech.unlock();
      speakCurrent();
    });

    els.settingsBtn.addEventListener('click', function () {
      if (settings.isOpen()) closeSettings();
      else openSettings();
    });
    els.settingsBtn.setAttribute('aria-expanded', 'false');
    els.settingsBtn.setAttribute('aria-label', t('settingsAria'));
    els.settingsBtn.setAttribute('title', t('settingsAria'));

    els.ageBtn.addEventListener('click', function () {
      openPicker(false);
    });

    els.categoryBtn.addEventListener('click', function () {
      openCategoryPicker();
    });

    // 第一次交互解锁音频（浏览器要求先有用户手势）
    let unlocked = false;
    doc.addEventListener('pointerdown', function () {
      if (unlocked) return;
      unlocked = true;
      speech.unlock();
    });

    createKeymap({
      onAnyKey: function () {
        if (unlocked) return;
        unlocked = true;
        speech.unlock();
      },

      /**
       * 焦点作用域：浮层打开时只在浮层内活动。
       * TV 上最常见的"卡住"就是焦点跑到遮罩背后的卡片上，
       * 用户按半天没反应，只能拔电源。
       */
      getScope: function () {
        if (settings.isOpen()) return els.sheet;
        if (overlay.isOpen && overlay.isOpen()) return els.overlay;
        if (agePicker.isOpen()) return els.agePicker;
        if (categoryPicker.isOpen()) return els.categoryPicker;
        return els.root;
      },

      onAction: function (action) {
        const s = store.get();
        const status = s.status;

        // ---- 返回：逐层关闭；没层可关就打开设置 ----
        if (action === 'back') {
          if (settings.isOpen()) {
            closeSettings();
            return true;
          }
          if (overlay.isOpen && overlay.isOpen()) return true;   // 错误/完成浮层不许返回键跳过
          if (agePicker.isOpen()) {
            agePicker.hide();
            focusEl(els.ageBtn);
            return true;
          }
          if (categoryPicker.isOpen()) {
            categoryPicker.hide();
            focusEl(els.categoryBtn);
            return true;
          }
          openSettings();
          return true;
        }

        // 浮层期间不响应播放类动作
        if (settings.isOpen() || agePicker.isOpen() || categoryPicker.isOpen()) return false;

        if (action === 'replay') {
          if (status === STATES.ANSWER_SHOWN || modeOf() === 'flashcard') {
            speech.unlock();
            speakCurrent();
            return true;
          }
          return false;
        }

        if (action.indexOf('pick:') === 0) {
          if (status !== STATES.COUNTDOWN || modeOf() !== 'quiz') return false;
          const i = Number(action.slice(5));
          const btn = els.choices.querySelectorAll('.choice')[i];
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        }

        if (action === 'confirm') {
          if (status === STATES.COUNTDOWN) {
            reveal(activeToken);
            return true;
          }
          if (status === STATES.ANSWER_SHOWN) {
            goNext();
            return true;
          }
          if (status === STATES.ERROR_STATE || (overlay.isOpen && overlay.isOpen())) {
            return false;
          }
          return false;
        }

        return false;
      }
    });

    if (!els.overlay.hidden) overlay.hide();
    boot();
  }

  return { init: init, store: store };
}
