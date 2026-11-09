# AGENTS.md — Bluey 项目导航

> 本文件是 AI coding agent（WorkBuddy / opencode / Claude Code / codex 等）进入本仓库的**唯一入口**。
> 开始任何工作前先读完本文件，再按「任务 → 文档」路由表跳转。**不要凭猜测改代码或改规格。**

---

## 1. 项目是什么

**Bluey** 是一个面向 3–8 岁儿童的双语看图猜词学习应用，纯前端 HTML/CSS/JS，
一套代码同时自适应 **电视（遥控器）/ 平板（触屏）/ 手机（竖屏）**。

核心循环：

```
展示图片 / 动图  →  孩子观察并说出答案  →  5 秒倒计时  →  揭晓中英文答案 + 发音  →  下一题
```

产品定位：**低认知负荷、大画面、零文字门槛**。孩子不需要认字、不需要打字，
家长不需要注册登录。打开就能玩。

### 关键约束（决定了所有技术选择）

| 约束 | 含义 |
| --- | --- |
| 零构建 | 没有 npm / webpack / vite，改完文件刷新即可生效 |
| 零后端 | 无账号、无数据库、无网络依赖，离线可用 |
| 素材本地化 | 图片、音频全部放在 `assets/`，不引用外链 CDN |
| 题库数据驱动 | 新增词条只改 JSON，不改代码 |
| TV 可用 | 遥控器方向键可完成全流程，焦点可见，字号按 10-foot UI |

---

## 2. 硬性约定（Hard rules）

> **适用范围**：规则 1–2 只约束 `app/`（给孩子玩的运行端）。
> `studio/`（本地生产端）**不受零构建约束**，见 `docs/10-studio-architecture.md`。

以下规则**不可由 agent 自行放宽**，需要变更必须在 `docs/07-decisions.md` 新增一条 ADR 并说明理由。

1. **`app/` 不引入构建工具。** 不新增 `package.json` 构建脚本、不引入框架（React/Vue）、不用 TypeScript 编译。
   语言层面只用浏览器原生支持的 ES2022 + CSS。
2. **`app/` 不引入运行时依赖。** 不用外部 CDN、不用 npm 包、不用 web font。需要图标就用内联 SVG 或 emoji。
3. **题库是数据不是代码。** 词条一律写进 `data/questions/*.json`，
   禁止把词条硬编码在 JS 里。
4. **文案不硬编码中文。** 所有界面文案走 `src/i18n/` 的字典，答案天然双语（`en` / `zh`）。
5. **新增/改变用户可见行为，必须同步 docs。** 先改 `docs/02-requirements.md`，再改代码。
   文档与实现不一致时，**以 docs 为准**，实现视为缺陷。
6. **文件命名**：代码与目录用英文 kebab-case；文档用 `NN-english-name.md` + 中文标题；
   中文只出现在文件内容里，不出现在路径里（跨平台/工具兼容）。
7. **不留死代码。** 删掉的功能连同样式、资源、词条一起删，不注释保留。

---

## 3. 目录职责

```
Bluey/
├── AGENTS.md                ← 你在读的文件，agent 入口
├── README.md                ← 给人看的简介（怎么跑起来）
├── .gitignore
│
├── docs/                    ← 规格的唯一事实来源（spec = source of truth）
│   ├── README.md            文档索引 + 阅读顺序
│   ├── 01-vision.md         产品愿景、目标用户、成功标准
│   ├── 02-requirements.md   功能范围、用户故事、验收标准
│   ├── 03-ux-devices.md     三端交互设计：TV / 平板 / 手机、倒计时、布局
│   ├── 04-data-model.md     题库 JSON 格式、素材规范
│   ├── 05-architecture.md   运行端技术架构、模块划分、状态机
│   ├── 06-harness.md        本机 harness 约定：agent 工作流、记忆、技能
│   ├── 07-decisions.md      决策记录（ADR）
│   ├── 08-roadmap.md        里程碑与路线图
│   ├── 09-asset-pipeline.md 素材来源、AI 生图、风格一致性流水线
│   ├── 10-studio-architecture.md  生产端（题库与素材生成器）架构
│   └── 11-curriculum-design.md    题库设计：年龄分层、主题矩阵、词表规划
│
├── app/                     ← 运行端：纯静态，零构建，可整包拷到电视
│   ├── index.html
│   ├── src/
│   └── styles/
│
├── studio/                  ← 生产端：本地单机服务（Node + SQLite + Vue）
│   ├── server/              Express + node:sqlite
│   ├── web/                 React 18 + Vite + shadcn/ui (TS)
│   ├── config.json          来源策略链与额度预算
│   └── data/studio.db       工作库（gitignore）
│
├── data/questions/          ← 契约：Studio 导出，App 只读
├── assets/                  ← 契约：Studio 产出，App 只读
│   ├── <category>/
│   ├── _style/              风格锚图（生产输入，gitignore）
│   ├── _inbox/              agent 产出原图（gitignore）
│   ├── _raw/                原始存档（gitignore）
│   └── _pilot/              打样产物（gitignore）
├── tools/                   ← 开发自检工具（不入运行时，不参与构建）
│   ├── viewport-check.html  三端视口对比（iframe 精确控宽）
│   └── flow-check.html      自动走流程，截「已揭晓」「本组完成」
├── skills/                  ← 项目级 agent 技能（跨 runtime 优先加载）
└── .workbuddy/memory/       ← 项目记忆：长期约定 + 每日工作日志
```

**依赖方向**：`studio → data/ + assets/ → app`。反向零依赖。
`app/` 不知道 `studio/` 存在；删掉 `studio/`，`app/` 照常跑。

---

## 4. 任务 → 文档路由表

| 你要做的事 | 先读 | 改完要动 |
| --- | --- | --- |
| 理解产品要做什么 | `docs/01-vision.md` | — |
| 加/改功能 | `docs/02-requirements.md` | 验收标准同步更新 |
| 调 UI、布局、三端适配 | `docs/03-ux-devices.md` | `src/styles/` |
| 加词条、改题库结构 | `docs/04-data-model.md` | `data/questions/` |
| **定词表、分年龄档、排主题** | `docs/11-curriculum-design.md` | `words` 表 + `age_profiles` |
| **找素材、生图、统一风格** | `docs/09-asset-pipeline.md` | `assets/SOURCES.md` 登记 |
| **改生产端 / 题库生成器 / 素材入库** | `docs/10-studio-architecture.md` | `studio/` |
| 改代码结构、加模块（运行端） | `docs/05-architecture.md` | `app/src/` |
| 改 agent 工作方式 / 加技能 | `docs/06-harness.md` | `AGENTS.md` |
| 做技术选型、推翻旧方案 | `docs/07-decisions.md` | 追加 ADR |
| 排期、定里程碑 | `docs/08-roadmap.md` | — |

---

## 5. 怎么跑起来

### 运行端（给孩子玩）

题库通过 `fetch()` 读取，`file://` 直开会因 CORS 失败。**必须起本地静态服务**：

```bash
# 仓库根目录执行，二选一
python -m http.server 5173
npx --yes serve -l 5173 .
```

然后浏览器打开 <http://localhost:5173/app/>。

> 注意末尾的 `/app/`。仓库根目录是给服务用的，应用在子目录里。

TV 端调试：同一局域网内用电视浏览器访问 `http://<本机 IP>:5173/app/`，
或在电视上用遥控器打开系统浏览器。手机端用局域网 IP 访问即可。

**三端自检**：打开 <http://localhost:5173/tools/viewport-check.html>，
一页并排显示 390×844 / 844×390 / 1024×768 三种视口。
电视（1920×1080）不要用这个页测，嵌套 iframe 会让 media query 失真，直接开窗口看。

> 为什么需要专门的自检页：Chrome 在 Windows 上有约 500px 的最小窗口宽度，
> 直接 `--window-size=390` 布局会按 504px 算，量出来的手机效果是假的。

### 生产端（Studio，题库与素材生成器）

```bash
cd studio
npm install
npm run dev        # Studio 前端 :5174 + API :5175（Vite 代理 /api）
npm run seed       # 从 data/questions 导入词条
npm run pipeline   # 后处理 assets/_inbox 里的新图
npm run publish    # 校验并导出 data/questions/*.json
```

> **端口约定（固定，别改）**：App `5173` / Studio 前端 `5174` / Studio API `5175`。
> 三者同时开也不会打架，调试时不用来回关服务。

---

## 6. Agent 工作流（每个任务都走一遍）

```
1. 读 AGENTS.md（本文件）
2. 按路由表读相关 docs，确认需求边界
3. 先判断改的是 app/ 还是 studio/（两者规则不同，别混）
4. 若需求不清或有取舍 → 先问人 / 写进 ADR，不要默默决定
5. 改代码（小步、可回滚）
6. 自检：对 docs 的验收标准逐条核对（app 还要过三端尺寸）
7. 更新 docs（行为变了就改规格）
8. 追加记忆：.workbuddy/memory/YYYY-MM-DD.md 记一条
```

**禁止**：一次性大重构、顺手改无关文件、引入未经讨论的依赖、
用 `any` 思维糊过错误处理、删除别人的约定而不留记录、
**在 `app/` 里 import `studio/` 的任何东西**（方向反了）。

---

## 7. 完成定义（DoD）

### 改 `app/` 时，必须同时满足

- [ ] 符合 `docs/02-requirements.md` 中对应条目的验收标准
- [ ] 在 1920×1080（TV）、1024×768（平板）、390×844（手机竖屏）三个尺寸下都可用
- [ ] 键盘 Tab 可遍历所有可交互元素，焦点环可见（TV 遥控器等价于方向键）
- [ ] 断网情况下功能完整（无外部请求）
- [ ] 控制台无报错、无 404
- [ ] 相关 docs 已更新，`docs/README.md` 索引未悬空
- [ ] `.workbuddy/memory/` 当日日志已追加

### 改 `studio/` 时，必须同时满足

- [ ] 数据库变更走迁移脚本，不手改 sqlite 文件
- [ ] SQL 只写在 `server/` 层，路由里不出现裸 SQL
- [ ] 导出的 `data/questions/*.json` 通过 schema 校验
- [ ] 发布前跑混源检测（`v_mixed_source`），混源必须可见
- [ ] 删掉 `studio/` 后 `app/` 仍能正常运行（依赖方向未被破坏）

---

## 8. 记忆分层

| 层 | 位置 | 写什么 | 写入时机 |
| --- | --- | --- | --- |
| 项目长期记忆 | `.workbuddy/memory/MEMORY.md` | 稳定约定、架构决策、踩过的坑 | 约定形成时 |
| 每日工作日志 | `.workbuddy/memory/YYYY-MM-DD.md` | 今天做了什么、改了哪些文件、待办 | 每完成一个任务 |
| 规格记忆 | `docs/` | 产品与技术规格本身 | 行为变化时 |

优先级：`docs/` > `MEMORY.md` > 日志。日志是流水账，**不进化成规格**。

---

## 9. 常用命令

```bash
# 运行端
python -m http.server 5173                          # 本地预览（打开 /app/）
python -m json.tool data/questions/animals.json     # 校验题库 JSON 语法
python tools/check-assets.py                        # 素材体检：体积/尺寸/对比度
python tools/check-assets.py --strict               # 同上，有问题时退出码非 0

# 自检页（起服务后开）
#   /tools/gallery.html          题库总览，按主题分组，自动读题库
#   /tools/viewport-check.html   三端视口并排（390 / 844横屏 / 1024）
#   /tools/flow-check.html       自动跑流程：?age=toddler|preschool|school &cat=fruits &flow=reveal|quiz|complete
#   /tools/voice-check.html      本机语音自检（缺英文语音时给安装步骤）

# 生产端
cd studio && npm run dev                            # Studio 前端 :5174 / API :5175
cd studio && npm run publish                        # 导出并校验 data/
```

> `app/` 没有测试框架、没有 linter——有意为之（零构建约束）。
> 质量靠「三尺寸手动自检 + `check-assets.py` + 题库 JSON 语法校验」保证。
> 素材批量生成后，用 PIL 拼网格图一次目视全部，比逐张看省 80% 时间
> （做法见 `docs/09-asset-pipeline.md` §8.1 末）。
