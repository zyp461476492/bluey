# 05 运行端技术架构

> **本文只描述 `app/`（给孩子玩的运行端）**。生产端（题库与素材生成器）见
> [`10-studio-architecture.md`](10-studio-architecture.md)。
> 两者是独立制品，依赖方向：`studio → data/ + assets/ → app`。

## 1. 技术选型

| 层 | 选择 | 理由 |
| --- | --- | --- |
| 语言 | 原生 HTML + CSS + ES Modules（ES2022） | 零构建，浏览器直接跑，TV 浏览器兼容性好 |
| UI | 无框架，手写 DOM | 状态极简（一个题目的生命周期），框架反而增加 TV 兼容风险 |
| 样式 | 原生 CSS，自定义属性 + `clamp()` | 一套代码三端缩放，不需要预处理器 |
| 数据 | 静态 JSON + `fetch()` | 数据与代码分离，加词条不改代码 |
| 状态 | 单例 store + 显式状态机 | 状态少，不需要 Redux |
| 语言 | TTS 用 `speechSynthesis` | 零素材成本；不支持时静默降级 |
| 持久化 | `localStorage` | 无后端，只需存设置与进度 |
| 构建 | **无** | 硬性约束，见 `07-decisions.md` ADR-001 |

---

## 2. 目录结构（M1 起逐步实现）

```
app/
├── index.html              入口（单页）
│
├── src/
│   ├── main.js             bootstrap：加载题库 → 初始化 store → 挂载视图
│   ├── config.js           常量集中处（倒计时、断点、存储 key）
│   │
│   ├── core/
│   │   ├── store.js        全局状态 + 订阅
│   │   ├── state-machine.js 题目生命周期状态机
│   │   ├── theme.js        深色/浅色主题（data-theme + localStorage）
│   │   └── storage.js      localStorage 封装（全部 try/catch）
│   │
│   ├── data/
│   │   ├── loader.js       fetch 分类与词条，负责缓存与错误处理
│   │   ├── profiles.js     年龄档：加载、按 minAge 筛词、取标签
│   │   └── quiz.js         出题：洗牌、建队列
│   │
│   ├── ui/
│   │   ├── app.js          顶层视图 / 控制器
│   │   ├── card.js         图片卡片（含加载中 / 失败降级 / 超时兜底）
│   │   ├── countdown.js    倒计时进度环（rAF）
│   │   ├── answer.js       答案区（显形 / 隐形，含音标）
│   │   ├── choices.js      quiz 模式的 4 选项（含方向键焦点移动）
│   │   ├── picker.js       通用选择页（年龄档 / 主题共用一份）
│   │   ├── speech.js       TTS 封装（静默降级 + 看门狗 + 语音匹配 + 重试）
│   │   ├── overlay.js      错误 / 完成浮层
│   │   ├── toast.js        轻提示（缺英文语音等家长须知）
│   │   └── focus.js        焦点工具
│   │
│   └── i18n/
│       └── ui-strings.js   界面文案字典（zh / en）
│
└── styles/
    ├── tokens.css          CSS 变量：颜色、字号、间距、动效时长
    ├── base.css            reset + 排版基线
    ├── layout.css          三端布局（media queries 只在这里）
    ├── components.css      按钮、卡片、进度环
    └── tv.css              TV 专属：焦点环、10-foot 尺寸
```

**分层原则**：`ui/` 只读 store、只发事件，不做数据计算；`data/` 不碰 DOM；
`core/` 不认识题目内容。任何跨层直接调用都算架构违规。

---

## 3. 状态机

题目生命周期只有 5 个状态，**不允许出现隐式状态**。

```
            ┌──────────────────────────────────────────┐
            │                                          │
            ▼                                          │
        ┌───────┐   load   ┌──────────────┐  ready  ┌──┴───────────┐
        │ IDLE  │─────────▶│ LOADING_MEDIA│────────▶│  COUNTDOWN   │
        └───────┘          └──────────────┘         └──────┬───────┘
                                │ error                  │ timeout / skip
                                ▼                        ▼
                         ┌─────────────┐          ┌──────────────┐
                         │ ERROR_STATE │          │ ANSWER_SHOWN │
                         └─────────────┘          └──────┬───────┘
                                                         │ next
                                                         └──▶ LOADING_MEDIA
```

| 状态 | 界面表现 | 允许的动作 |
| --- | --- | --- |
| `IDLE` | 空白 / 启动画面 | 选年龄档、开设置 |
| `LOADING_MEDIA` | 图片骨架屏，倒计时**不启动** | 取消（回 IDLE） |
| `COUNTDOWN` | 图片可见，答案隐形，进度环运行 | 立即揭晓、返回 |
| `ANSWER_SHOWN` | 答案可见，朗读，下一题高亮 | 下一题、重看、返回 |
| `ERROR_STATE` | 错误提示 + 重试按钮 | 重试、返回 |

> **模式差异不改状态机，只改参数**：
> - `reveal` / `quiz`：`LOADING_MEDIA → COUNTDOWN → ANSWER_SHOWN`
> - `flashcard`（2–3 岁）：`LOADING_MEDIA → ANSWER_SHOWN`（跳过倒计时，图词同时给）
>
> `choices` 只在 `quiz` 下存在，但它不是独立状态——选项显示在 `COUNTDOWN`，
> 判定结果仍落在 `ANSWER_SHOWN`。多造一个 `QUIZ_ANSWERED` 状态只会让竞态更难守。

**关键规则**

1. 倒计时**只在 `LOADING_MEDIA` 成功后才开始**——否则图还没出来时间就流走了。
   （`02-requirements.md` 待确认问题 #2 的默认解法）
2. 状态进入 `ANSWER_SHOWN` 后必须**清除所有定时器**，防止切题后旧定时器再触发揭晓。
3. 任何异步回调（图片 load、fetch、TTS）都要校验「当前题 id 是否仍是它出发时的那道题」，
   避免快速连点导致错题串答案。这是这类应用最典型的 bug。

---

## 4. 核心数据结构（运行时）

```js
// store 单例的 shape
{
  status: 'IDLE' | 'LOADING_MEDIA' | 'COUNTDOWN' | 'ANSWER_SHOWN' | 'ERROR_STATE',
  categoryId: 'animals',
  queue: ['animals-cat-001', 'animals-dog-002', ...],  // 本轮待出题 id，已洗牌
  current: {                                            // 当前题（已装配好可渲染）
    id: 'animals-cat-001',
    media: { type, src, alt, fallbackEmoji },
    answer: { en, zh, pinyin },
    hint: { zh, en },
    options: [ {en,zh,correct:true}, ... ]              // 仅 quiz 模式，已打乱
  },
  settings: {
    mode: 'reveal' | 'quiz',
    lang: 'zh' | 'en' | 'both',
    countdownMs: 5000,
    ttsEnabled: true
  },
  progress: { seenIds: [], masteredIds: [] }
}
```

---

## 5. 关键流程

### 5.1 启动

```
main.js
  → 读 storage（settings / progress，失败则用默认值）
  → fetch data/questions/index.json
      ├ 成功 → fetch 默认分类文件 → buildQueue() → nextQuestion()
      └ 失败 → ERROR_STATE（提示"题库加载失败，请用本地服务器打开"，附命令提示）
```

### 5.2 出一题

```
nextQuestion()
  → queue 为空？ 有：提示"本组完成"；无：从题库洗牌重建
  → 取 queue.shift() → 组装 current（quiz 模式还要抽干扰项 + 打乱）
  → status = LOADING_MEDIA
  → 预加载图片（new Image()），onload → status = COUNTDOWN，启动 5s 定时器
                              onerror → 用 fallbackEmoji 渲染，仍进入 COUNTDOWN
```

### 5.3 揭晓

```
reveal()
  → clearTimeout
  → status = ANSWER_SHOWN
  → 答案区淡入 + 图片微放大
  → ttsEnabled && speechSynthesis 可用 → speak(answer[lang])
  → 记录 progress.seenIds
```

### 5.4 音频降级

```js
function speak(text, lang) {
  if (!('speechSynthesis' in window)) return;          // 静默返回
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
    speechSynthesis.cancel();                          // 防止上一题语音叠加
    speechSynthesis.speak(u);
  } catch { /* 忽略：没声音不影响学习流程 */ }
}
```

> 电视浏览器 `speechSynthesis` 常常"存在但无声"。**不要为无声加兜底 UI**，
> 也不要用音频播放成功与否来决定流程走向。

---

## 6. 配置集中化

所有魔数进 `src/config.js`，界面与逻辑都不许散落硬编码：

```js
export const CONFIG = {
  COUNTDOWN_MS: 5000,
  COUNTDOWN_MIN: 2000,
  COUNTDOWN_MAX: 10000,
  NEXT_DELAY_MS: 200,          // 切题淡出时长
  OPTION_COUNT: 4,
  STORAGE_KEYS: { settings: 'bluey.settings.v1', progress: 'bluey.progress.v1' },
  PATHS: { questionsIndex: 'data/questions/index.json' },
};
```

---

## 7. 已知技术风险

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| TV 浏览器内核老旧（Chromium 60 级） | 新语法报错白屏 | 只用 ES2019 可放心特性；不用顶层 `await`、不用 `structuredClone`、不用 `:has()` |
| `fetch` 在 `file://` 失败 | 双击 HTML 打不开 | README/AGENTS 明确要求起本地服务；ERROR_STATE 给出具体命令 |
| TV 遥控器无 Tab 键 | 焦点无法移动 | 自己实现方向键 → 焦点移动的映射（`ui/focus.js`） |
| 电视 overscan 裁切 | 边缘内容被切掉 | 布局四周留 5% 安全边距 |
| GIF 在部分 TV 不播 | 动图不动 | 静态图兜底 + `media.type: "gif"` 时同时给首帧图 |
| 局域网 IP 变化 | 手机/电视打不开 | 文档说明用 `http://<IP>:5173`，或后续加二维码入口（M4） |

---

## 8. 明确不做的技术选择

| 不做 | 原因 |
| --- | --- |
| 框架（React/Vue） | 状态极简，框架带来构建链与 TV 兼容风险 |
| TypeScript | 需要编译，违反零构建；用 JSDoc 类型注释替代 |
| 单元测试框架 | 无构建链下引入测试框架成本高于收益；改为「手动 3 尺寸验收清单」 |
| Service Worker 离线缓存 | 本地服务场景收益低；素材已全本地，M5 再评估 |
| Web Components | 调试成本高，手写函数式渲染更直白 |
