/**
 * 界面文案字典。禁止在 JS 里硬编码中文（答案数据除外）。
 * 见 AGENTS.md 硬规则 4
 */
const STRINGS = {
  zh: {
    appTitle: 'Bluey 猜词',
    next: '下一题',
    revealNow: '立即揭晓',
    revealHint: '点一下看答案',
    speak: '再听一次',
    speakUnsupported: '这个浏览器不支持朗读',
    themeToLight: '切换到浅色',
    themeToDark: '切换到深色',
    counter: '{current} / {total}',
    loading: '正在加载',
    pickerTitleFirst: '先选一个年龄段',
    pickerTitle: '换个年龄段',
    pickerHint: '选错了也没关系，右上角随时能改。',
    ageAria: '年龄段',
    settingsAria: '设置',
    settings: '设置',
    theme: '主题外观',
    themeDark: '深色',
    themeLight: '浅色',
    setLang: '语言',
    setTts: '发音',
    setAge: '年龄段',
    setCategory: '主题',
    langBoth: '双语',
    langZh: '中文',
    langEn: 'English',
    on: '开',
    off: '关',
    close: '关闭',
    keyHint: '遥控器：← → ↑ ↓ 选，Enter 确认，返回键 关闭',
    keyHintPlay: 'Enter 下一题 · r 重听 · 返回键 设置',
    keyHintReveal: 'Enter 立即揭晓 · 返回键 设置',
    keyHintQuiz: '1–4 或方向键选 · 返回键 设置',
    categoryTitle: '选一个主题',
    categoryHint: '也可以选「全部」，所有主题混着出。',
    categoryAll: '全部',
    categoryAllHint: '所有主题混着出',
    categoryAria: '主题',
    unitWords: ' 个词',
    categoryPending: '待配图',
    noEnglishVoice:
      '这台设备没有英文语音，只会读中文。想装英文发音，看 /tools/voice-check.html 里的说明。',
    doneTitle: '这一组玩完啦',
    doneText: '一共 {total} 题，真棒。',
    restart: '再来一次',

    errTitle: '题库加载失败',
    errRetry: '重试',
    errFetchHint:
      '如果是直接双击 HTML 打开的，浏览器会拦下读取题库的请求。\n' +
      '请在仓库根目录执行：\n\n' +
      '    python -m http.server 5173\n\n' +
      '然后访问 http://localhost:5173/app/',
    errEmptyTitle: '题库是空的',
    errEmptyText: 'data/questions/ 里没有可出的题。'
  },
  en: {
    appTitle: 'Bluey Word Guess',
    next: 'Next',
    revealNow: 'Show answer',
    revealHint: 'Tap to reveal',
    speak: 'Say it again',
    speakUnsupported: 'Speech is not supported here',
    themeToLight: 'Switch to light',
    themeToDark: 'Switch to dark',
    counter: '{current} / {total}',
    loading: 'Loading',
    pickerTitleFirst: 'Pick an age group',
    pickerTitle: 'Change age group',
    pickerHint: 'You can switch anytime from the top right.',
    ageAria: 'Age group',
    settingsAria: 'Settings',
    settings: 'Settings',
    theme: 'Appearance',
    themeDark: 'Dark',
    themeLight: 'Light',
    setLang: 'Language',
    setTts: 'Sound',
    setAge: 'Age group',
    setCategory: 'Topic',
    langBoth: 'Both',
    langZh: 'Chinese',
    langEn: 'English',
    on: 'On',
    off: 'Off',
    close: 'Close',
    keyHint: 'Remote: arrows to move, Enter to confirm, Back to close',
    keyHintPlay: 'Enter for next · R to replay · Back for settings',
    keyHintReveal: 'Enter to reveal · Back for settings',
    keyHintQuiz: '1–4 or arrows to pick · Back for settings',
    categoryTitle: 'Pick a topic',
    categoryHint: 'Or choose All to mix every topic.',
    categoryAll: 'All',
    categoryAllHint: 'Mix all topics',
    categoryAria: 'Topic',
    unitWords: ' words',
    categoryPending: 'art pending',
    noEnglishVoice:
      'No English voice on this device, only Chinese will be spoken. Open /tools/voice-check.html to see how to install one.',
    doneTitle: 'Set complete',
    doneText: '{total} words done. Nice work!',
    restart: 'Play again',

    errTitle: 'Could not load the question bank',
    errRetry: 'Retry',
    errFetchHint:
      'If you opened the HTML file directly, the browser blocks reading the data files.\n' +
      'Run this from the repo root:\n\n' +
      '    python -m http.server 5173\n\n' +
      'Then open http://localhost:5173/app/',
    errEmptyTitle: 'No questions',
    errEmptyText: 'data/questions/ has nothing to show.'
  }
};

let current = 'zh';

export function setLang(lang) {
  current = STRINGS[lang] ? lang : 'zh';
}

export function t(key, vars) {
  const dict = STRINGS[current] || STRINGS.zh;
  let text = dict[key] !== undefined ? dict[key] : (STRINGS.zh[key] || key);
  if (vars) {
    Object.keys(vars).forEach(function (k) {
      text = text.split('{' + k + '}').join(String(vars[k]));
    });
  }
  return text;
}
