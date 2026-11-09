/**
 * 发音：浏览器 speechSynthesis。
 *
 * 三条纪律（来自 docs/09 与 MEMORY 里的硬事实）：
 *   1. 不支持 / 报错 → 静默降级，绝不让"没声音"影响流程
 *   2. 不能用"音频是否播放成功"决定状态机走向
 *   3. 电视上常见"接口存在但无声"——所以必须给一个「再听一次」按钮
 *
 * 两个必须绕开的 Chrome 毛病（2026-11-09 实测，占"有中文没英文"的主因）：
 *   A. cancel() 之后立刻 speak() 会**吞掉新的一句**。必须先等一下再 speak。
 *   B. voice.lang 可能是 en_US 这种下划线写法，直接赋给 u.lang 是无效 BCP-47，
 *      浏览器找不到语音就**静默不出声**。必须归一化成 en-US。
 *
 * 所以这里不赌一次成功：按"显式语音 → 只用 lang → 退化到最常见地区"依次重试，
 * 任何一步 onstart 在 900ms 内没触发就换下一种。
 */
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

let voices = [];
let voicesHooked = false;
let unlocked = false;
let sessionToken = 0;
let loggedOnce = false;

export function isSupported() {
  return (
    !!synth &&
    typeof window !== 'undefined' &&
    typeof window.SpeechSynthesisUtterance === 'function'
  );
}

/* ---------------- 语音列表 ---------------- */

function loadVoices() {
  if (!synth) return;
  try {
    const list = synth.getVoices();
    if (list && list.length) voices = list;
  } catch (e) {
    voices = [];
  }
}

function hookVoices() {
  if (voicesHooked || !synth) return;
  voicesHooked = true;
  loadVoices();
  if (typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', loadVoices);
  } else {
    synth.onvoiceschanged = loadVoices;
  }
}

/** 首次调用时语音列表可能是空的（异步填充），最多等一会儿 */
function waitForVoices(timeoutMs) {
  hookVoices();
  loadVoices();
  if (voices.length) return Promise.resolve(voices);

  return new Promise(function (resolve) {
    let settled = false;

    function done() {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (synth && typeof synth.removeEventListener === 'function') {
        try {
          synth.removeEventListener('voiceschanged', onChange);
        } catch (e) {
          /* 忽略 */
        }
      }
      resolve(voices);
    }

    function onChange() {
      loadVoices();
      if (voices.length) done();
    }

    const timer = setTimeout(done, timeoutMs || 800);
    try {
      synth.addEventListener('voiceschanged', onChange);
    } catch (e) {
      done();
    }
  });
}

/** en_US → en-US；非法值返回 '' */
function normLang(lang) {
  const raw = String(lang || '').replace(/_/g, '-').trim();
  if (!/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(raw)) return '';
  return raw;
}

function pickVoice(preferred) {
  if (!voices.length) loadVoices();
  if (!voices.length) return null;

  const want = normLang(preferred).toLowerCase();
  const base = want.split('-')[0];
  let i;

  for (i = 0; i < voices.length; i++) {
    if (normLang(voices[i].lang).toLowerCase() === want) return voices[i];
  }
  for (i = 0; i < voices.length; i++) {
    if (normLang(voices[i].lang).toLowerCase().split('-')[0] === base) return voices[i];
  }
  return null;
}

/** 诊断用：让 tools/voice-check.html 能列出可用语音 */
export function getVoiceReport() {
  hookVoices();
  loadVoices();
  const langs = [];
  for (let i = 0; i < voices.length; i++) {
    const l = normLang(voices[i].lang);
    if (l && langs.indexOf(l) === -1) langs.push(l);
  }
  const en = pickVoice('en-GB') || pickVoice('en-US');
  const zh = pickVoice('zh-CN');
  return {
    supported: isSupported(),
    total: voices.length,
    langs: langs,
    english: en ? en.name + ' (' + en.lang + ')' : null,
    chinese: zh ? zh.name + ' (' + zh.lang + ')' : null,
    names: voices.map(function (v) {
      return v.name + ' | ' + v.lang;
    })
  };
}

/* ---------------- 播放 ---------------- */

/**
 * 部分浏览器要求先有一次"用户手势"才允许发声。
 * 在第一次点击/按键时调用它，用一个静音空串解锁。
 */
export function unlock() {
  if (unlocked || !isSupported()) return;
  unlocked = true;
  try {
    const u = new window.SpeechSynthesisUtterance(' ');
    u.volume = 0;
    synth.speak(u);
  } catch (e) {
    /* 忽略 */
  }
}

export function cancel() {
  sessionToken++;
  stopEngine();
}

/** 只停引擎，不动 sessionToken —— 内部重试用 */
function stopEngine() {
  if (!isSupported()) return;
  try {
    synth.cancel();
  } catch (e) {
    /* 忽略 */
  }
}

function sleep(ms) {
  return new Promise(function (r) {
    setTimeout(r, ms);
  });
}

/**
 * 尝试方案：有匹配语音就用「显式语音 + 该语音的 lang」，
 * 否则只用 lang 让引擎自己挑。
 *
 * 刻意**最多两种**：多一种就多 900ms 的静默等待，
 * 而"系统根本没有英文语音"这个最常见的情况，重试几次都是白等。
 */
function planAttempts(requested) {
  const lang = normLang(requested) || 'en-US';
  const base = lang.split('-')[0];
  const common = base === 'zh' ? 'zh-CN' : 'en-US';
  const voice = pickVoice(lang);
  const plans = [];

  if (voice) plans.push({ voice: voice, lang: normLang(voice.lang) || lang });
  if (!voice || normLang(voice.lang).toLowerCase() !== common.toLowerCase()) {
    plans.push({ voice: null, lang: common });
  }
  return plans.slice(0, 2);
}

/** 该语种在这台机器上到底有没有语音（用于给家长提示） */
export function hasVoiceFor(lang) {
  hookVoices();
  loadVoices();
  const want = normLang(lang).toLowerCase();
  const base = want.split('-')[0];
  let i;
  for (i = 0; i < voices.length; i++) {
    if (normLang(voices[i].lang).toLowerCase().split('-')[0] === base) return true;
  }
  return false;
}

function attemptOnce(text, plan, rate, token) {
  return new Promise(function (resolve) {
    let started = false;
    let settled = false;

    function finish(ok) {
      if (settled) return;
      settled = true;
      clearTimeout(startTimer);
      clearTimeout(watchdog);
      if (!ok) {
        // 这句没响，清掉队列，避免它待会儿突然冒出来
        stopEngine();
      }
      resolve(ok && token === sessionToken);
    }

    const u = new window.SpeechSynthesisUtterance(text);
    if (plan.voice) u.voice = plan.voice;
    u.lang = plan.lang || 'en-US';
    u.rate = rate || 1;
    u.pitch = 1;
    u.volume = 1;

    u.onstart = function () {
      started = true;
      clearTimeout(startTimer);
    };
    u.onend = function () {
      finish(true);
    };
    u.onerror = function () {
      finish(false);
    };

    // 700ms 还没开始 = 这一次被吞了，换下一种方案（别等太久，后面的中文会跟着延后）
    const startTimer = setTimeout(function () {
      if (!started) finish(false);
    }, 700);

    const watchdog = setTimeout(
      function () {
        finish(false);
      },
      Math.max(1600, text.length * 320)
    );

    try {
      if (synth.paused) synth.resume();
      synth.speak(u);
    } catch (e) {
      finish(false);
    }
  });
}

/**
 * 播一句。返回 Promise<boolean>，但**调用方不该依赖它的结果**。
 * 内部会按 planAttempts 依次重试，并带看门狗：
 * 某些 TV 浏览器 onend 永远不触发，不能因此把后续朗读堵死。
 */
export function speak(text, lang, rate) {
  if (!isSupported() || !text) return Promise.resolve(false);

  const content = String(text);
  const requested = lang || 'en-US';
  const token = ++sessionToken;

  if (!loggedOnce) {
    loggedOnce = true;
    try {
      // 只打一次，方便在 DevTools 里看实际选中的语音
      const r = getVoiceReport();
      console.info('[speech] 可用语音 ' + r.total + ' 个；英文=' + r.english + '；中文=' + r.chinese);
    } catch (e) {
      /* 忽略 */
    }
  }

  return waitForVoices(800).then(function () {
    if (token !== sessionToken) return false;

    const plans = planAttempts(requested);

    // Chrome 的坑：cancel 之后立刻 speak 会被吞，先让引擎歇一下
    const needCooldown = synth && (synth.speaking || synth.pending);
    const lead = needCooldown ? sleep(140) : Promise.resolve();

    return lead.then(function () {
      if (needCooldown) stopEngine(); // 注意用 stopEngine，不能动 token
      let chain = Promise.resolve(false);

      for (let i = 0; i < plans.length; i++) {
        (function (plan) {
          chain = chain.then(function (ok) {
            if (ok || token !== sessionToken) return ok;
            return sleep(60).then(function () {
              if (token !== sessionToken) return false;
              return attemptOnce(content, plan, rate, token);
            });
          });
        })(plans[i]);
      }
      return chain;
    });
  });
}

/**
 * 顺序朗读多条。任一条失败就继续下一条。
 * @param {Array<{text: string, lang: string}>} items
 */
export function speakAll(items, rate) {
  let chain = Promise.resolve();
  if (!items || !items.length) return chain;

  for (let i = 0; i < items.length; i++) {
    (function (item) {
      chain = chain.then(function () {
        return speak(item.text, item.lang, rate);
      });
    })(items[i]);
  }
  return chain;
}
