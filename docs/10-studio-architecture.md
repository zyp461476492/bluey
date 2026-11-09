# 10 Studio：题库与素材生成器架构

> 本文定义**生产端**（Studio）的架构。给孩子玩的**运行端**（App）见 `05-architecture.md`。
> 两者是**两个独立制品**，靠 `data/` + `assets/` 的契约通信，代码不互相 import。

---

## 1. 本次决策前提

用户确认两条（2026-11-09）：

| 决策 | 含义 |
| --- | --- |
| **AI 手绘为主，OpenMoji 为辅** | 素材有优先级链，不是单一来源；额度不足或人工指定时降级 |
| **可以引入成熟 UI 框架，本地部署** | 生产端不再受"零构建"约束 |

这两条共同推翻了一个隐含假设：**一个仓库只能有一种技术复杂度**。
本方案的处理方式是把它拆成两个制品，各自用最合适的复杂度。

---

## 2. 核心判断：App 与 Studio 必须分离

### 2.1 为什么不能合并

| 如果合并 | 后果 |
| --- | --- |
| 生图依赖、构建链进入 App | App 从"单个 HTML 文件夹"变成"要 npm install 才能跑"，电视上没法直接打开 |
| 前端框架进入 App | 包体增大、TV 老内核兼容风险、遥控器焦点要跟虚拟 DOM 打架 |
| 数据库进入 App | 孩子的设备上不该有 SQLite；离线单文件部署被破坏 |
| App 的零依赖被 Studio 的依赖污染 | 每次升级 Studio 都可能让 App 跑不起来，而 App 是给孩子用的，不能随便挂 |

### 2.2 分离后的形态

```
Bluey/
├── app/                ← 运行端：纯静态，零构建，可整个文件夹拷到电视/平板
│   ├── index.html
│   ├── src/            原生 ES Modules
│   └── styles/
│
├── studio/             ← 生产端：本地单机服务，现代栈，有构建
│   ├── server/         Node + Express + SQLite
│   ├── web/            Vue 3 + Vite
│   ├── data/           studio.db（工作库，gitignore）
│   └── package.json
│
├── data/questions/     ← 契约：Studio 导出，App 只读
└── assets/             ← 契约：Studio 产出，App 只读
```

**依赖方向**：`Studio → data/ + assets/ → App`。反向零依赖。
App 不知道 Studio 存在；Studio 删掉，App 照常跑。

### 2.3 契约长什么样

Studio 发布时生成 `data/questions/<category>.json`，App 只按 `04-data-model.md` 的 schema 读。
**schema 是唯一的接口**，两边都不许绕过它直读对方的内部结构。

---

## 3. 一个必须直面的现实：本机生图不是 HTTP API

这是整个方案里最容易设计错的地方。

**现状**：AI 生图能力挂在 agent 工具上（`ImageGen`），不是可被 HTTP 调用的服务。
Studio 没有 key、没有 endpoint，**点按钮无法直接出图**。

如果假装可以，最后会做出一个"点生成 → 转圈 → 报错"的假功能。

### 3.1 解法：把"生成"抽象成工单，执行器可插拔

```
Studio 只负责：算出该生成什么 → 落成 job 记录 → 展示队列 → 收结果 → 后处理 → 入库
谁去执行 job，由 executor 决定
```

| executor | 谁执行 | 成本 | 何时用 |
| --- | --- | --- | --- |
| **`agent`**（默认） | AI agent 读 job 清单，逐条调生图工具，回写结果 | 额度 | 当前唯一可行路径 |
| `api` | Studio 直连图像 API（需自备 key） | 钱 | 将来想全自动时接入 |
| `manual` | 人拖拽上传图片 | 0 | 补图、替换废片 |
| `library` | 从本地图库（OpenMoji/Twemoji 缓存）取 | 0 | 降级路径 |

**agent 模式的具体流程**（这也解释了为什么它不鸡肋）：

```
1. Studio 里勾选 20 个词 → 点「生成工单」
2. Studio 写入 20 条 job（status=queued），并生成一份
   studio/outbox/batch-20261109-01.json（含每个 job 的完整 prompt、参考图路径、目标输出路径）
3. 人对 agent 说：「跑 studio/outbox/batch-20261109-01.json」
4. agent 逐条执行 → 图片落到 assets/_inbox/ → 回写 job 状态与额度到 Studio
   （回写方式：agent 生成 studio/inbox/batch-...-result.json，Studio 点「导入结果」）
5. Studio 跑后处理流水线 → 素材进 assets/<分类>/ → 状态变 approved
```

关键设计：**job 清单是文件，不是内存**。这样 agent 崩溃、额度用完、跨天继续，
都能从文件接着跑，不丢进度。

---

## 4. 存储：SQLite 是工作库，JSON 是发布产物

### 4.1 为什么工作库不能用 JSON

| 需求 | JSON | SQLite |
| --- | --- | --- |
| 素材状态机（生成/清洗/审核/发布/废弃） | 要自己写状态迁移校验 | 字段 + CHECK 约束 |
| 额度账本按批次汇总 | 手算 | `SUM()` |
| 按分类查"还差几张图" | 遍历所有文件 | 一条 JOIN |
| 生成尝试的历史（同一词试了 3 次） | 数组嵌套膨胀 | 独立表的天然能力 |
| 并发写入（后处理脚本 + Web UI） | 后写覆盖前写 | 事务 + WAL |
| 图片指纹去重 | 全量扫描 | 索引 |

**结论：JSON 做工作库，写着写着就会手搓一个残缺的数据库。**

### 4.2 双写关系

```
SQLite（studio/data/studio.db）        ← 唯一可写的事实来源
        │
        │  publish 命令（显式触发）
        ▼
data/questions/*.json + assets/*.webp   ← 只读的发布产物（App 消费）
```

两条铁律：

1. **Studio 从不读 `data/questions/`**——那是它的输出，不是它的输入。
2. **App 从不读 `studio.db`**——它甚至不知道有这么个文件。

这样"发布"就是一次单向导出，天然可重放、可回滚（git 管住 `data/` 就行）。

---

## 5. 数据模型

```sql
-- 分类
CREATE TABLE categories (
  id        TEXT PRIMARY KEY,          -- animals
  name_zh   TEXT NOT NULL,
  name_en   TEXT NOT NULL,
  icon      TEXT,                       -- emoji
  file      TEXT NOT NULL,              -- animals.json
  sort      INTEGER DEFAULT 0
);

-- 词条
CREATE TABLE words (
  id          TEXT PRIMARY KEY,          -- animals-cat-001
  slug        TEXT NOT NULL UNIQUE,      -- cat（对应文件名）
  zh          TEXT NOT NULL,
  en          TEXT NOT NULL,
  pinyin      TEXT,
  category_id TEXT NOT NULL REFERENCES categories(id),  -- 主题 = 分类，两者是同一个概念
  min_age     INTEGER NOT NULL DEFAULT 2, -- 最早引入年龄（2|3|4|5|6），见 docs/11
  difficulty  INTEGER NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 3),
  hint_zh     TEXT,
  hint_en     TEXT,
  status      TEXT NOT NULL DEFAULT 'draft',   -- draft|ready|published
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- 年龄档（配置，不是内容分库；详见 docs/11 §3）
CREATE TABLE age_profiles (
  id                       TEXT PRIMARY KEY,   -- toddler|preschool|school
  label_zh                 TEXT NOT NULL,
  label_en                 TEXT NOT NULL,
  min_month                INTEGER NOT NULL,   -- 24
  max_month                INTEGER NOT NULL,   -- 47
  mode                     TEXT NOT NULL,      -- flashcard|reveal|quiz
  reveal_delay_ms          INTEGER NOT NULL DEFAULT 5000,
  option_count             INTEGER NOT NULL DEFAULT 0,
  show_text_before_reveal  INTEGER NOT NULL DEFAULT 0,
  show_pinyin              INTEGER NOT NULL DEFAULT 1,
  tts_rate                 REAL NOT NULL DEFAULT 1.0,
  max_per_session          INTEGER NOT NULL DEFAULT 12,
  auto_advance_ms          INTEGER NOT NULL DEFAULT 0,
  sort                     INTEGER NOT NULL DEFAULT 0
);

-- 风格档（风格锚 + 提示词模板，可多套并存）
CREATE TABLE style_profiles (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  anchor_path      TEXT NOT NULL,       -- assets/_style/anchor-01.png
  style_block      TEXT NOT NULL,       -- 固定风格块
  constraint_block TEXT NOT NULL,       -- 固定构图块
  negative_block   TEXT NOT NULL,       -- no text 等约束
  subject_suffix   TEXT,                -- 主体块模板，{subject} 占位
  input_fidelity   TEXT DEFAULT 'high',
  size             TEXT DEFAULT '1024x1024',
  version          INTEGER NOT NULL DEFAULT 1,
  is_active        INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL
);

-- 生成工单
CREATE TABLE jobs (
  id               TEXT PRIMARY KEY,
  job_key          TEXT NOT NULL UNIQUE, -- sha1(word_id|profile_id|prompt_version)
  word_id          TEXT NOT NULL REFERENCES words(id),
  style_profile_id TEXT REFERENCES style_profiles(id),
  source           TEXT NOT NULL,        -- ai|openmoji|twemoji|manual
  executor         TEXT NOT NULL,        -- agent|api|manual|library
  status           TEXT NOT NULL,        -- queued|running|done|failed|cancelled
  prompt           TEXT,                 -- 展开后的完整 prompt，便于复现
  batch_id         TEXT,                 -- 批次，便于按批统计
  est_credits      INTEGER,              -- 下单时的预估额度（见 §7.3）
  actual_credits   INTEGER,              -- 执行后回写的实测额度
  attempts         INTEGER DEFAULT 0,
  error            TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

-- 素材
CREATE TABLE assets (
  id                 TEXT PRIMARY KEY,
  job_id             TEXT REFERENCES jobs(id),
  word_id            TEXT NOT NULL REFERENCES words(id),
  source             TEXT NOT NULL,      -- ai|openmoji|twemoji|manual
  license            TEXT NOT NULL,      -- 可商用|需署名|仅家用
  credit_text        TEXT,               -- 署名文案（需署名时必填）
  orig_path          TEXT,               -- 原始产物（_inbox 或 _raw）
  path               TEXT,               -- 发布用 webp，相对仓库根
  width              INTEGER,
  height             INTEGER,
  bytes              INTEGER,
  phash              TEXT,               -- 感知哈希，查重
  watermark_cleared  INTEGER DEFAULT 0,
  provisional        INTEGER DEFAULT 0,  -- 1 = 临时降级素材，待补 AI 图
  status             TEXT NOT NULL DEFAULT 'generated',
                     -- generated|cleaned|approved|published|rejected
  quality_notes      TEXT,
  created_at         TEXT NOT NULL
);

-- 额度账本
CREATE TABLE credits (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id     TEXT REFERENCES jobs(id),
  provider   TEXT NOT NULL,              -- imagegen|openai|...
  amount     INTEGER NOT NULL,
  note       TEXT,
  created_at TEXT NOT NULL
);
```

索引与视图：

```sql
CREATE INDEX idx_words_cat    ON words(category_id, min_age, status);
CREATE INDEX idx_assets_word  ON assets(word_id, status);
CREATE INDEX idx_assets_phash ON assets(phash);
CREATE INDEX idx_jobs_status  ON jobs(status, batch_id);

-- 素材覆盖率：每个词有没有可发布的图
CREATE VIEW v_coverage AS
SELECT w.id, w.slug, w.zh, w.category_id,
       (SELECT COUNT(*) FROM assets a
         WHERE a.word_id = w.id AND a.status IN ('approved','published')) AS ok,
       (SELECT source FROM assets a
         WHERE a.word_id = w.id AND a.status IN ('approved','published')
         ORDER BY a.created_at DESC LIMIT 1) AS source
FROM words w;

-- 混源检测：同一分类里出现了多种 source
CREATE VIEW v_mixed_source AS
SELECT category_id, COUNT(DISTINCT source) AS sources,
       GROUP_CONCAT(DISTINCT source) AS which
FROM v_coverage WHERE ok > 0
GROUP BY category_id HAVING sources > 1;
```

`v_mixed_source` 是给 §7 的一致性规则用的，不是装饰。

---

## 6. 生成流水线

### 6.1 状态机

```
                       ┌──────────┐
       创建工单 ───────▶│  queued  │
                       └────┬─────┘
                            │ agent/api/manual 领取
                            ▼
                       ┌──────────┐  失败  ┌────────┐
                       │ running  │───────▶│ failed │─┐
                       └────┬─────┘        └────────┘ │重试
                            │ 有产物                  │
                            ▼                        │
        ┌───────────────────────────────────────────┘
        ▼
   ┌───────────┐  去水印+压缩+指纹  ┌─────────┐  人工/规则   ┌──────────┐
   │ generated │──────────────────▶│ cleaned │────────────▶│ approved │
   └───────────┘                   └─────────┘             └────┬─────┘
                                                                │ publish
                                                                ▼
                                                          ┌───────────┐
                                                          │ published │
                                                          └───────────┘
```

规则：
- `approved → published` 只发生在发布时，是幂等操作
- `rejected` 可随时进入，且不删除文件（保留试错痕迹）
- **同一 word 可以有多条 assets**，但同一时刻只有一条是 `published`

### 6.2 后处理流水线（`pipeline` 子命令，可重复执行）

```
1. 水印区域检查：右下 20%×12% 是否存在主体像素（深色像素计数）
   ├ 为空   → 逐行用左侧中位色填充
   └ 非空   → 标记 quality_notes，转人工（**不许盲填**，会抹掉车轮）
2. 裁切居中（按主体包围盒）+ 统一缩放到 1024×1024
3. 转 webp q90，写入 assets/<category>/<slug>.webp
4. 计算 phash，与库存比对
   ├ 相似度 > 0.95 且同 word → 视为重复，标记 rejected
   └ 相似度 > 0.95 且不同 word → 告警（可能是"猫和狗长得一样"）
5. 大小校验：> 200KB 告警
6. 写 assets 行，status=cleaned
```

> 第 1 步是上一轮打样踩出来的坑（`09-asset-pipeline.md` §8.2）。
> 任何 AI 图入库都必须过这一步，且**检查失败必须转人工**。

### 6.3 出题与素材的关系

Studio 只管"这个词有没有合格的图"，不管"怎么出题"。
出题逻辑（洗牌、干扰项、难度）留在 App 的 `data/quiz.js` 里——
**因为出题是运行时行为，不是数据内容**。

---

## 7. 来源策略链：AI 主、OpenMoji 辅

### 7.1 策略解析顺序

```
resolveSource(word):
  1. word.source_override 显式指定        → 用它（人工强制）
  2. 全局 strategy 列表第一个             → 通常是 'ai'
  3. 前置检查：
       - 本月额度余量 < 阈值？
       - 该 word 已有 source=ai 且 approved 的素材？（复用，不重复生成）
  4. 命中失败 → 顺次取下一位（'openmoji'）
  5. 全部失败 → 标记 manual，转人工
```

配置放 `studio/config.json`：

```json
{
  "strategy": ["ai", "openmoji"],
  "creditBudget": { "monthly": 2200, "warnAtPercent": 80, "hardStop": true },
  "forbidSourceForCategory": { "feelings": ["ai"] },
  "downgradeOnBudgetExhausted": true
}
```

`forbidSourceForCategory` 是有用的：抽象词（情绪、动作）本来就更适合 ARASAAC 象形图，
可以显式禁掉 AI，省额度也省风格风险。

### 7.2 降级会破坏"同分类不混源"，必须正视

`09-asset-pipeline.md` §6 原写的是"同一分类内不混视觉来源"。但"AI 主 + OpenMoji 辅"
**天然会混源**。两条规则打架时，我选择修正规则，而不是假装不冲突：

| 新规则 | 说明 |
| --- | --- |
| 混源不是事故，**无意识的混源**才是 | 系统必须随时能报出"哪些分类在混、混了几张" |
| 降级素材标记 `provisional = 1` | 发布前必须显式确认，UI 上黄色角标 |
| 单分类混源比例 > 30% | 提示"建议整类切换"，而不是继续零散补 |
| **核心分类**（数值、颜色、常用动物）不允许混源 | 配置里白名单锁定，降级时直接跳过该词 |

这样"降级"从一个偷偷发生的失败，变成一个可见、可决策的状态。

### 7.3 额度预估与预算控制

需求很直接：**点生成之前先知道大概要烧多少；如果不够，优先走 OpenMoji。**

#### 7.3.1 预估公式

```
待生成数 N           = 选中的词 − 已有 approved 素材的词（复用不计费）
预计生成次数 G       = ceil(N ÷ usableRate)
预估额度            = G × creditsPerImage        （给区间：× min ~ × max）
另加                 风格锚（若该 profile 还没有锚图）→ +1 次
```

`usableRate` = 一次生成出来能用的概率。
**它不是拍脑袋的常数，而是从自己的账本里校准出来的**（见 7.3.4）。

#### 7.3.2 配置

```json
{
  "credits": {
    "perImageMin": 5,
    "perImageMax": 10,
    "usableRate": 0.85,
    "anchorCost": 10,
    "budget": { "period": "month", "limit": 1500, "warnAt": 0.8, "hardStop": true }
  }
}
```

`limit` 默认 1500：全库 116 词预估 685–1370（见 `11-curriculum-design.md` §8），
留 10% 余量做重试。

#### 7.3.3 预估接口与界面

```
POST /api/jobs/estimate
{ "scope": { "ageGroup": "toddler", "category": "animals" }, "source": "ai" }
```

```json
{
  "words": 10,
  "reused": 2,
  "toGenerate": 8,
  "genCalls": 10,
  "estCreditsMin": 50,
  "estCreditsMax": 100,
  "budgetRemaining": 620,
  "verdict": "ok",
  "alternatives": [
    { "source": "openmoji", "estCredits": 0,
      "tradeoff": "风格不一致，8 张标 provisional" },
    { "action": "reduce", "words": 5, "estCreditsMax": 60 },
    { "action": "split",   "batches": 2, "note": "拆到下周，每次不触发预算告警" }
  ]
}
```

界面呈现（Studio 生成页底部常驻一条汇总）：

```
已选 10 词 · 复用 2 · 待生成 8       预估 50–100 额度
本月已用 880 / 1500（59%）           够用 ✓
```

勾选词条时**实时重算**，不用点按钮。因为在勾选的过程中就要能感觉到"选多了"。

#### 7.3.4 实测校准（这一步让预估越用越准）

```sql
CREATE VIEW v_waste_rate AS
SELECT batch_id,
       COUNT(*) AS total,
       SUM(status = 'rejected') AS rejected,
       ROUND(1.0 * SUM(status = 'rejected') / COUNT(*), 3) AS waste_rate
FROM assets
WHERE job_id IS NOT NULL AND source = 'ai'
GROUP BY batch_id;
```

`usableRate` 取最近 3 个批次的 `1 − AVG(waste_rate)`，写入 `config.json` 的运行时覆盖值。
**第一版用 0.85 起步，跑完两三批之后系统就开始用自己的真实数据估。**

> 打样那 12 张的实测废片率是 0（12/12 可用），但那批词都很简单。
> 真实词表里会出现"抽象概念""近似词"，废片率一定更高——所以宁可先按 85% 保守估。

#### 7.3.5 护栏分级

| 预算使用率 | 行为 |
| --- | --- |
| < 80% | 正常，显示绿色 |
| ≥ 80% | 黄色提示；**新建 job 时默认 source 自动切到 `openmoji`**，要选 AI 需手动确认 |
| ≥ 100% | 红色硬停；AI 工单不能创建，只能 openmoji / manual |
| 单批预估 > 150 | 二次确认弹窗，列出将要生成的词 |

第三条是关键：**不是"报个错让你自己想办法"，而是把默认值改掉。**
人在预算快用完时容易"就再来一批"，让系统把默认选项换成免费方案，比提醒有效。

#### 7.3.6 预估触发降级的决策

```
预估 50–100 额度，余量 620 → 走 AI
预估 300–600 额度，余量 200 → 提示：
   ① 砍到 5 词（预估 60）  ② 整批降级 openmoji（0 额度，标 provisional）  ③ 拆两批
```

**永远给三个选项，而不是一个"额度不足"的报错。**
因为"额度不足"不是一个错误，是一个需要决策的约束。

---

## 8. 幂等与去重

| 机制 | 作用 |
| --- | --- |
| `job_key = sha1(word_id ∥ profile_id ∥ profile.version)` | 同一词同风格只允许一个未完成工单，避免重复烧额度 |
| `assets.phash` | 检出"生成结果和已有图几乎一样"（模型偷懒） |
| `v_coverage` | 只给"还没有 approved 素材"的词排工单 |
| 批次号 `batch_id` | 一次批量生成的额度可整批核算、整批回滚 |

---

## 9. 目录结构

```
studio/
├── package.json
├── config.json                策略链与额度预算（入库）
├── data/studio.db             工作库（gitignore）
├── outbox/                    agent 待执行工单（gitignore）
├── inbox/                     agent 回写结果（gitignore）
│
├── server/
│   ├── index.js               Express 入口
│   ├── db.js                  node:sqlite 连接 + 迁移
│   ├── routes/
│   │   ├── words.js           词条 CRUD
│   │   ├── jobs.js            工单创建/查询
│   │   ├── assets.js          素材审核/废弃
│   │   ├── credits.js         额度统计
│   │   └── publish.js         导出 data/questions + 校验
│   ├── services/
│   │   ├── strategy.js        来源策略解析
│   │   ├── prompt.js          prompt 模板装配
│   │   ├── inbox.js           导入 agent 结果
│   │   └── pipeline.js        去水印/压缩/指纹
│   └── cli/
│       ├── seed.js            从 data/questions 反向导入词条
│       └── run-pipeline.js    批量后处理
│
└── web/                       React 18 + Vite + shadcn/ui
    ├── src/
    │   ├── components/
    │   │   ├── ui/            shadcn 生成的原语（button/table/dialog…）
    │   │   └── DataTable.tsx  **通用表格封装，四个页面共用**
    │   ├── pages/
    │   │   ├── Words.tsx      词条表格 + 年龄档筛选
    │   │   ├── Queue.tsx      工单队列 + 额度预估条
    │   │   ├── Review.tsx     素材审核（大图对比）
    │   │   ├── Styles.tsx     风格档管理
    │   │   └── Publish.tsx    发布预览与校验
    │   ├── lib/api.ts         TanStack Query 封装
    │   └── App.tsx
    └── vite.config.ts         proxy /api → :5175
```

---

## 10. 技术栈

### 10.1 后端

| 项 | 选择 | 理由 |
| --- | --- | --- |
| 运行时 | **Node v22.22**（已装） | 前后端同语言，一个 `npm install` 搞定 |
| Web 框架 | **Express 5** | 最成熟、资料最多，本地单机不需要更多 |
| 数据库 | **`node:sqlite`**（Node 22 内置） | **零原生编译**，Windows 上不用装 VS Build Tools |
| 备选数据库 | `better-sqlite3` | 若不能接受内置模块的实验性警告；有预编译二进制 |
| 图像处理 | **sharp** | 预编译、webp 质量好；phash 用 sharp 缩 8×8 灰度后自算 dHash |

> `node:sqlite` 在 Node 22 会打印一条 ExperimentalWarning，可接受。
> 如果某天它改 API，切 `better-sqlite3` 只需改 `db.js` 一个文件——所以**别把 SQL 写在路由里**。

### 10.2 前端框架

**已定：React 18 + Vite + shadcn/ui + Tailwind CSS**（用户选定 C，2026-11-09）

| 层 | 选择 | 说明 |
| --- | --- | --- |
| 框架 | React 18 | — |
| 构建 | Vite | 起步快，配 `server.proxy` 把 `/api` 转到 5175 |
| 组件 | shadcn/ui | **不是 npm 包，是复制进项目的源码**，可随意改 |
| 样式 | Tailwind CSS | shadcn/ui 的依赖前提 |
| 表格 | TanStack Table v8 | shadcn/ui 的 DataTable 示例基于它，需自己拼列定义 |
| 表单 | react-hook-form + zod | shadcn/ui 的 Form 组件默认搭配 |
| 请求 | TanStack Query | 缓存 + 失效重取，避免手写 loading 状态 |

当初的三个候选与取舍（保留记录，便于将来复评）：

| 选项 | 栈 | 优势 | 劣势 |
| --- | --- | --- | --- |
| A | Vue 3 + Element Plus | 表格/表单开箱即用 | 视觉偏企业后台，定制成本高 |
| B | Vue 3 + Naive UI | 更轻更现代 | 表格能力较弱 |
| **C（选定）** | **React + shadcn/ui** | **组件是源码，可改到任意样子；生态最大；AI 生成的 shadcn 代码质量高** | 要自己拼表格，代码量比 A 多 |

**选 C 后必须接受的一个代价**：`el-table` 那种"传 columns 就出表"的便利没有了。
Studio 的表格要用 TanStack Table 自己写列定义、排序、筛选、分页。

缓解办法：**只写一次**——在 `web/src/components/DataTable.tsx` 做一个通用封装，
`Words / Queue / Review / Publish` 四个页面共用。这一步不做，后面四个页面会各写一遍。

> 这是内部工具，选错成本低：换框架不影响 `app/`，也不影响数据（SQLite + JSON 都在）。

### 10.3 明确不用

| 不用 | 原因 |
| --- | --- |
| 数据库 ORM（Prisma/TypeORM） | 表只有 7 张，原生 SQL 更直观，也避免迁移工具链 |
| 云端部署 | 单机单节点，`localhost` 就够 |
| 组件库 npm 包（如 Ant Design） | 选 shadcn/ui 就是因为它**不是 npm 包**，源码进项目可随意改 |

**TypeScript：用。** 选 React + shadcn/ui 之后这条反过来了——
shadcn 生成的组件本身就是 `.tsx`，不用 TS 反而别扭。约定：
- Studio 全量 TS（`strict: true`）
- `app/` 仍然纯 JS（零构建，TS 要编译，不适用）

**端口约定（固定）**：App `5173` / Studio 前端 `5174` / Studio API `5175`。

---

## 11. 本地运行

```bash
cd studio
npm install

npm run dev          # 同时起 Studio 前端(:5174) + API(:5175)，Vite 代理 /api
npm run seed         # 首次：从 data/questions 导入词条
npm run job -- --category animals --only-missing   # 造工单
npm run pipeline     # 后处理 assets/_inbox 里的图
npm run publish      # 校验 + 导出 data/questions/*.json
```

产物路径约定：

| 阶段 | 位置 |
| --- | --- |
| agent 产出原图 | `assets/_inbox/`（gitignore） |
| 风格锚 | `assets/_style/`（gitignore） |
| 发布用成品 | `assets/<category>/<slug>.webp`（入库） |
| 原始存档 | `assets/_raw/`（gitignore） |

---

## 12. 分阶段实施

| 阶段 | 内容 | 判据 |
| --- | --- | --- |
| **S0 骨架** | Express + node:sqlite + 建表（7 张）+ `seed` 导入现有 12 词 | `GET /api/words` 能返回 12 条 |
| **S1 词条管理** | React + shadcn/ui + 通用 DataTable：分类/词条 CRUD、年龄档、主题 | 能在网页里增删改词条 |
| **S2 工单与入库** | 造工单 → 额度预估 → outbox JSON → 导入结果 → pipeline | 能把 12 张打样图走完全流程进 assets/ |
| **S3 发布** | publish 校验（schema、混源、覆盖率、minAge）+ 导出 JSON | App 直接读导出结果就能玩 |
| **S4（可选）** | 风格档管理、额度面板、混源体检报表、废片率校准 | — |

**S2 是唯一有技术风险的阶段**（因为跨了 agent 和 Studio 两次进程边界）。
如果 S2 卡住，退路是：Studio 先只做"人工拖图入库 + 后处理 + 发布"，
生成环节继续由 agent 直接在对话里跑。这条路能保证 App 不被 Studio 阻塞。

---

## 13. 与现有文档的关系

| 改了这里 | 要同步 |
| --- | --- |
| App 与 Studio 边界 | `AGENTS.md` 硬规则适用范围、目录表 |
| 发布 JSON 增加 `source/credit/provisional` | `04-data-model.md` §3.2 |
| 词条增加 `minAge` / 年龄档配置 | `11-curriculum-design.md` §3、`04-data-model.md` |
| 混源规则修订 | `09-asset-pipeline.md` §6 |
| 技术栈选型 | `07-decisions.md` ADR-009 ~ ADR-014 |
| 额度预估与预算护栏 | `11-curriculum-design.md` §8（成本口径） |
| 里程碑 | `08-roadmap.md` 新增 Studio 一条线 |

**变更声明**：本文推翻 `AGENTS.md` 原"全仓库零构建"约束，改为**只约束 `app/`**。
ADR-001 / ADR-002 在 `07-decisions.md` 中已标注适用范围收窄，不是删除。
