# 项目长期记忆（Bluey）

> 只写**会反复用到**的东西。规格细节去 `docs/`，不要在这里重复。
> 控制在此长度内（约 300 行），超了就要蒸馏。

## 项目定位

- **Bluey**：3–8 岁儿童双语看图猜词应用，纯前端 HTML/CSS/JS
- 主循环：出图 → 5s 倒计时 → 揭晓中英文答案 + TTS → 下一题
- 三端：电视（遥控器）/ 平板（触摸）/ 手机（竖屏）
- **使用范围：家庭内部，不涉及商业**（2026-11-09 确认）→ NC 素材可用，但对外传播即越界
- **两个制品**（2026-11-09 定）：`app/` 运行端（零构建）+ `studio/` 生产端（现代栈）
- 当前阶段：**M1/M2 完成**（9 主题 70 词、61 张真图、三档模式、主题选择）；
  仅颜色 4 + 数字 5 用 emoji（刻意不用 AI）；下一步 M3 三端与 TV 焦点

## 双制品边界（最容易被破坏的约定）

1. 依赖方向单向：`studio → data/ + assets/ → app`。**`app/` 不许 import `studio/`**
2. Studio 不读 `data/questions/`（那是它的输出），只写 SQLite，导出时才生成 JSON
3. **Studio 不能直接调生图**：生图挂在 agent 工具上，不是 HTTP API。
   Studio 只产出 job 清单 JSON，由 agent 执行后回写 → 这是当前唯一零成本路径
4. 端口固定：App `5173` / Studio 前端 `5174` / API `5175`

## 稳定约定（不可由 agent 自行放宽）

1. **`app/` 零构建**：不加 npm / webpack / vite / TS 编译。改完刷新即生效。
   （`studio/` 不受此限，ADR-009）
2. **零后端**：App 无账号、无数据库、无 CDN。
3. **数据驱动**：词条写 `data/questions/*.json`，**禁止硬编码在 JS**。
4. **文案不硬编码中文**：走 `src/i18n/ui-strings.js`，答案数据除外。
5. **docs 是唯一事实来源**：改行为先改 docs；文档与实现冲突时以 docs 为准。
6. **文件命名**：代码/路径英文 kebab-case，中文只在内容里。
7. **题库 schema 变更必须先写 ADR**，否则会让已写好的词条失效。
8. **SQL 只写在 `studio/server/`**，路由里不出现裸 SQL（便于换数据库驱动）。

## 架构要点

- 状态机 5 态：`IDLE` / `LOADING_MEDIA` / `COUNTDOWN` / `ANSWER_SHOWN` / `ERROR_STATE`
- **倒计时在图片 load 成功后才启动**（否则图没出来时间就流走）
- 进入 `ANSWER_SHOWN` 必须 `clearTimeout`；异步回调要校验「当前题 id 是否是出发时那道题」——
  否则快速连点会串答案，这是这类应用最典型的 bug
- 渲染是手写函数式，无框架；重渲染后要显式恢复焦点（焦点逻辑集中在 `ui/focus.js`）
- 所有魔数进 `src/config.js`

## 踩过的坑 / 硬事实

| 坑 | 结论 |
| --- | --- |
| `file://` 下 `fetch` 失败 | 必须 `python -m http.server 5173`，文档已说明；ERROR_STATE 要给命令提示 |
| TV 上 `speechSynthesis` 存在但无声 | 静默降级，**不要**用音频成功与否决定流程走向 |
| TV 浏览器内核老旧 | 只用 ES2019 放心特性；不用顶层 await、`structuredClone`、`:has()` |
| `setInterval` 在 TV 后台标签页被节流 | 倒计时/动画用 `requestAnimationFrame` |
| 电视 overscan 裁切边缘 | 布局四周留 5% 安全区 |
| 揭晓瞬间布局跳动会让孩子丢视线 | 答案区提前占位，用 `visibility` 而非 `display` 切换 |
| `outline: none` | 绝对禁止，TV 上等于遥控器完全不可用 |
| **Chrome on Windows 最小窗口宽约 504px** | `--window-size=390` 布局按 504 算，量手机效果是假的 → 用 `tools/viewport-check.html` 的 iframe |
| **长文本撑宽 CSS Grid** | 会把卡片挤出屏幕；栅格项必须加 `min-width: 0`，列用 `minmax(0,1fr)` |
| 自动聚焦按钮会常驻焦点环 | 触摸端看着像装饰边框；改为全局 keydown 兜住确认键，不主动 focus 卡片 |
| iframe + virtual-time 截图 | CSS transition 会卡在半透明，**布局可信、颜色不可信**；颜色要直接截页面 |
| `app/` 访问路径 | 必须 `/app/`，不是仓库根；资源前缀在 `config.js` 的 `PATHS.ASSET_BASE` |
| **卡片底色必须等于素材底色** | AI 图背景是米色 #fdf6ec；浅色主题若用纯白卡片会露出方块接缝 |
| 浅色主题焦点环 | 用墨色不用蓝色——蓝描在珊瑚色按钮上很脏 |
| `speechSynthesis` 自动播放 | 部分浏览器要先有用户手势；首次点击/按键时用静音空串解锁 |
| `speechSynthesis` 的 `onend` | 某些 TV 浏览器永不触发 → 必须加看门狗（按字数估时长），否则朗读链卡死 |
| **`u.lang` 必须写实际语音的 lang** | 本机只有 en-US(Zira)+zh-CN(Huihui)，写 en-GB 会**静默不出声**（表现为"有中文没英文"） |
| **Chrome 可能只用 OneCore 语音** | 本机 OneCore 只有 zh-CN（慧慧/康康/瑶瑶）→ Chrome 里可能一个英文语音都没有，代码怎么写都不出声 |
| Chrome `cancel()` 后立刻 `speak()` | 会吞掉新的一句；必须先 cancel、等 ~140ms 再 speak |
| `voice.lang` 可能是 `en_US` | 直接赋给 `u.lang` 是无效 BCP-47 → 静默失败；必须 `_` → `-` 归一化 |
| **语音无法自动化验证** | 无头 Chrome 的 `getVoices()` 返回 0，只能人工开 `tools/voice-check.html` |
| 中文 Windows 的语音现状 | OneCore 只有 zh-CN，Edge 自然语音**没有英文**；Chrome 用 SAPI5 才有 Zira |
| **本机语音实况（2026-11-09）** | 系统 Win11 26300；已装语言 zh-Hans-CN + **en-US，但 en-US 的「语音」组件未装**（OneCore 零英文语音）；SAPI5 有 Zira(en-US) 但 Chrome 用不上 |
| **CSS Grid 的 `1fr` 最小值是 min-content** | 图片固有高度会把行撑开、整页溢出错位 → 必须写 `minmax(0, 1fr)` |
| 浮层遮罩不能写死深色 | 浅色主题下 title 用深色文字 → 深底深字看不见；用 `--overlay-bg` 跟主题 |
| headless 默认浅色 | `prefers-color-scheme` 在无头 Chrome 是 light，截深色图要显式写 localStorage |
| **无头 Chrome 其实有语音** | 实测 22 个语音含 `Google UK English Female (en-GB)`；之前测出 0 个是**测太早**（语音列表异步加载） |
| **emoji 占位是正式通道** | `media.type:"emoji"` 时不发图片请求，词条可以先落地，不产生 404/骨架屏 |
| **emoji 只适合「符号本身就是那个东西」的词** | 苹果🍎/眼睛👁️/红色🔴 成立；工程车（挖掘机/压路机/搅拌车）没有对应 emoji，硬用 🚧 就是教错 |
| `pending` 通道 | 词条先录、图未做 → `media.type:"pending"` 不进队列，主题显示「待配图」且点不进去 |

## 素材（详见 docs/09-asset-pipeline.md）

| 事实 | 结论 |
| --- | --- |
| 授权可用的 emoji 图集 | Noto(Apache 2.0) / Fluent(MIT) / OpenMoji(CC BY-SA) / Twemoji(CC BY 4.0) |
| **Apple / Windows Segoe / 厂商 emoji** | 专有美术资源，**不可提取打包进项目** |
| **ARASAAC** | CC BY-NC-SA，禁商用；本项目家用 → **可用**（补抽象词：情绪/动作/方位） |
| Openclipart | CC0 免署名，但风格极参差，做整套会裂 |
| 素材台账 | `assets/SOURCES.md` 每条必填 `可商用/需署名/仅家用`，为将来对外发布留退路 |
| 风格一致性的正确粒度 | **同一分类内不混视觉来源**；跨分类可以各用各的（孩子一次只玩一个分类） |
| emoji 字符 vs 存图 | 字符渲染随设备变（iPad=Apple 风），要全设备统一必须存 PNG/SVG |
| AI 生图致命坑 | 模型会往图上加英文字母，**必须写 no text** 且逐张人工确认 |
| AI 一致性四要素 | 固定风格块 + 风格锚图（image1 + input_fidelity 高）+ 固定构图 + 后期统一 |
| AI 废片率 | 30–50%，生成量按 1.5 倍备；150 词约 1100–2200 额度 + 6–9h 人工 |
| **AI 图带水印** | 右下角「AI生成」约占 20%×12%；该区域为空时可用行中位色无痕填充，**必须先检查**否则抹掉主体 |
| 实测效果（2026-11-09 打样 12 张） | 一致性 12/12、0 张出文字、webp 后 60KB/张；车脸易画到车门而非车头 |
| **机械类不需要另造锚图** | 工程车 8 张一次过、废片 0，与动物同一视觉语言；同一张 `_style/` 锚可复用 |
| **机械的结构特征必须写进 prompt** | 只写 `road roller` 会得到普通卡车；要写 `one very large round roller drum at the front`。货叉/铲斗/搅拌罐同理 |
| **长答案会挤爆答案区** | `.answer-line` 加 `flex: 0 0 auto`，中文/拼音 `flex: 0 0 auto`；否则 `road roller` 这类双词答案会把「压路机」和拼音压到重叠 |
| **emoji 图标选老不选新** | `🏗️`(U+1F3D7+VS16) 在 Windows 上渲染成红块；`🚧`(U+1F6A7) 稳定。分类图标一律用 Unicode 6.0 内、无变体选择符的 emoji |
| **身体部位去脸** | eye/nose/hand 等必须写 `no face, no eyes, no nose`，加脸就变成"一个头"，答案不唯一 |
| **单件物体最容易失败** | 没参照物的词（hair/egg/tooth）缺纹理或对比就认不出；有轮廓的动物车水果几乎不会失败 |
| **批量生成要拼网格审查** | 一次生成 8–14 张 → PIL 拼带标注的网格 → 一次目视 → 挑问题重画。省 80% 检查时间，且能看出单张看不出的风格分裂 |
| 素材体检 | `python tools/check-assets.py --strict`；判据是"前景占比 <8% **且** 平均色差 <150"，单看一个会误判（eye/tooth 占比 4–6% 但色差 284 是正常） |
| 混源规则 | "同分类不混源"已被 ADR-011 修订：**混源不是事故，无意识的混源才是**；降级标 `provisional` + 发布前确认 |
| Studio 技术栈 | Node 22 内置 `node:sqlite`（零原生编译）；Express 5；**React 18 + Vite + shadcn/ui + TS**；TanStack Table/Query；sharp |
| 题库分层模型 | 年龄档是**配置档**不是内容分库（ADR-013）：一套词 + `age_profiles` 配置 + `words.min_age` 过滤 |
| 题库规模（已算） | 201 条档位×主题引用 → **116 个唯一词**；生成 137 次 → **685–1370 额度** |
| 2 岁档的关键判断 | **2 岁不做"猜"做"认"** → flashcard 模式：图词同显、自动翻页、无倒计时无选项 |
| 额度机制 | 下单前预估 `ceil(N/usableRate)×单价`；`usableRate` 从自己账本校准；80% 时**默认 source 自动切 openmoji**（改默认值胜过硬约束） |
| 本机环境（2026-11-09） | node v22.22.2 / npm 10.9.7 / python 3.13.14 / sqlite3 module 3.53.1；无 pnpm、无 sqlite3 CLI |
| "布鲁伊风格" | 画风本身不侵权；但**角色形象受保护 + 名称已注册商标**，prompt 里不写 IP 名，角色自创 |

## 待决策（详见 docs/07-decisions.md）

未决：动图是否支持 mp4 / 干扰项取自同分类还是全题库 / 护眼提醒 / 复习队列
已决：家长编辑界面 → 由 Studio 覆盖；素材路线 → AI 主 + OpenMoji 辅（ADR-008 + ADR-011）

## 工作方式（用户偏好）

- 先给方案与取舍，再落地；不要默默替他拍板产品层面的"要不要"
- 数值、计数类结论要能程序化校验，不靠 AI 估算
- 一次性工作沉淀成 docs / skills，避免只活在对话里
- 每个任务收尾：DoD 自检 + 追加当日日志
