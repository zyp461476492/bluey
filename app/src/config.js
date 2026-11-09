/**
 * 全局常量。所有魔数集中在这里，界面与逻辑都不许散落硬编码。
 * 见 docs/05-architecture.md §6
 */
export const CONFIG = {
  // 倒计时（M1 固定 preschool 档，见 docs/11-curriculum-design.md §3.2）
  COUNTDOWN_MS: 5000,
  COUNTDOWN_MIN: 2000,
  COUNTDOWN_MAX: 10000,

  // 转场
  NEXT_DELAY_MS: 200,

  // 选项
  OPTION_COUNT: 4,

  // 答案语言：'zh' | 'en' | 'both'
  DEFAULT_LANG: 'both',

  // 发音
  TTS: {
    enabled: true,
    // 英文用英式，与词条里的音标（RP）保持一致
    langs: { en: 'en-GB', zh: 'zh-CN' },
    rate: 0.85,
    // 语速档：乘在年龄档 ttsRate 上（docs/02 F5-5）
    rateLevels: { slow: 0.8, normal: 1, fast: 1.25 },
    rateMin: 0.5,
    rateMax: 1.5,
    // 揭晓后的朗读顺序：先英文再中文
    order: ['en', 'zh']
  },

  // 倒计时档（设置面板可选，docs/02 F5-3）。'auto' = 跟年龄档 revealDelayMs
  COUNTDOWN_CHOICES: ['auto', 3000, 5000, 8000],

  // 主题
  THEMES: ['dark', 'light'],

  // 路径。
  // 约定：data/questions/*.json 里的 media.src 是「相对仓库根」，
  // 而 app/index.html 在 /app/ 下，所以资源需要前缀。
  // 若将来把 data 和 assets 拷进 app 目录一起发布，把 ASSET_BASE 改成 ''。
  PATHS: {
    DATA_ROOT: '../data/questions/',
    PROFILES: '../data/age-profiles.json',
    ASSET_BASE: '../'
  },

  // 队列
  SHUFFLE: true,

  // 存储
  STORAGE_KEYS: {
    settings: 'bluey.settings.v1',
    progress: 'bluey.progress.v1',
    theme: 'bluey.theme.v1',
    age: 'bluey.age.v1',
    lang: 'bluey.lang.v1',
    tts: 'bluey.tts.v1',
    ttsRate: 'bluey.tts-rate.v1',
    countdown: 'bluey.countdown.v1',
    category: 'bluey.category.v1'
  }
};
