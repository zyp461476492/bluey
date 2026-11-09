# 04 题库数据模型

题库是**数据**，不是代码。新增词条的唯一操作是：改 JSON + 放素材，**不改任何 JS**。

---

## 1. 文件布局

```
data/
├── age-profiles.json   ← 年龄档配置（App 直接读；将来由 Studio 发布生成）
└── questions/
    ├── index.json      ← 分类清单（必须先注册，否则不加载）
    ├── animals.json    ← 一个主题一个文件
    ├── fruits.json
    └── ...
```

`age-profiles.json` 结构见 `11-curriculum-design.md` §3.2，是**配置不是内容**：
它只决定「同一条词在哪个年龄段怎么玩」，不参与词条筛选（筛选看 `minAge`）。

### 为什么一个分类一个文件

- 单文件可以独立校验、独立维护，不会因为改一个词条导致整包 JSON 语法错误而全挂
- 按需加载：进入"动物"分类才 fetch `animals.json`，首屏更快
- 便于以后做「家长自建分类」时按文件增删

---

## 2. 分类清单 `index.json`

```json
{
  "version": 1,
  "defaultCategory": "animals",
  "categories": [
    {
      "id": "animals",
      "name": { "zh": "动物", "en": "Animals" },
      "icon": "🐾",
      "file": "animals.json"
    },
    {
      "id": "fruits",
      "name": { "zh": "水果", "en": "Fruits" },
      "icon": "🍎",
      "file": "fruits.json"
    }
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `version` | number | 是 | 数据结构版本，结构调整时 +1，便于做迁移 |
| `defaultCategory` | string | 是 | 启动时默认进入的分类 id，`"all"` 表示全部 |
| `categories[].id` | string | 是 | 唯一标识，kebab-case，**不可与已有分类重复** |
| `categories[].name` | object | 是 | 双语显示名 |
| `categories[].icon` | string | 否 | emoji，用于分类卡片，避免额外图片 |
| `categories[].file` | string | 是 | 相对 `data/questions/` 的文件名 |

> `"all"` 是**保留 id**，代表"全部题库"，不允许被真实分类占用。

---

## 3. 词条结构

### 3.1 完整示例

```json
{
  "version": 1,
  "categoryId": "animals",
  "items": [
    {
      "id": "animals-cat-001",
      "minAge": 2,
      "difficulty": 1,
      "media": {
        "type": "image",
        "src": "assets/animals/cat.webp",
        "source": "ai",
        "credit": null,
        "provisional": false,
        "alt": { "zh": "一只橘色的猫", "en": "An orange cat" },
        "fallbackEmoji": "🐱"
      },
      "answer": {
        "en": "cat",
        "ipa": "/kæt/",
        "zh": "猫",
        "pinyin": "māo"
      },
      "speech": {
        "en": "cat",
        "zh": "猫"
      },
      "hint": {
        "zh": "它会喵喵叫",
        "en": "It says meow"
      },
      "distractors": [
        { "en": "dog", "zh": "狗" },
        { "en": "pig", "zh": "猪" },
        { "en": "cow", "zh": "牛" }
      ],
      "tags": ["pet", "noun", "countable"]
    }
  ]
}
```

### 3.2 字段说明

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 全局唯一，格式 `{categoryId}-{slug}-{NNN}`。**改词条不要改 id**（进度记录依赖它） |
| `minAge` | 2\|3\|4\|5\|6 | 是 | 最早引入年龄。App 按当前年龄档过滤，规则见 `11-curriculum-design.md` §3.3 |
| `difficulty` | 1\|2\|3 | 是 | 1=直观单字，2=稍抽象，3=易混/多义。**与 `minAge` 不是一回事**，见 §3.3 |
| `media.type` | `"image"` \| `"gif"` \| `"emoji"` \| `"pending"` | 是 | `emoji` 表示**不发图片请求**，直接用 `fallbackEmoji` 渲染。这是"词条先落地、图后补"的正式通道：不会产生 404，也没有骨架屏闪烁。`pending` 表示**词条已录入、素材尚未制作**，这类词不进队列（见 `11` §4.1） |
| `media.src` | string | 条件 | `type` 为 image/gif 时必填；`pending` 时**预填目标路径**（图做好后只改 `type`）；`emoji` 时不要写 |
| `media.source` | `"ai"` \| `"openmoji"` \| `"twemoji"` \| `"manual"` | 是 | 素材来源，由 Studio 导出时写入。用于混源检测与「素材来源」页 |
| `media.credit` | string \| null | 条件 | `source` 为 openmoji/twemoji 时必填署名文案；`ai` 为 `null` |
| `media.provisional` | boolean | 是 | `true` = 临时降级素材（待补 AI 图），App 可据此显示小角标（M5） |
| `media.alt` | object | 是 | 双语描述，供无障碍与加载失败时使用 |
| `media.fallbackEmoji` | string | 是 | 图片加载失败 / 无素材时的兜底，**永远提供** |
| `answer.en` | string | 是 | 英文答案（小写，单数为主） |
| `answer.ipa` | string | 是 | **国际音标**，用斜杠包围，英式（RP），如 `/kæt/`、`/ˈelɪfənt/`。与 TTS 的 `en-GB` 保持一致 |
| `answer.zh` | string | 是 | 中文答案 |
| `answer.pinyin` | string | 否 | 拼音，带声调。帮助家长纠音，可选 |
| `speech.en` / `speech.zh` | string | 否 | TTS 朗读文本；未提供时用 `answer` 对应字段 |
| `hint.zh` / `hint.en` | string | 否 | 揭晓后的一句趣味提示，不参与判题 |
| `distractors` | array | 条件 | **quiz 模式必填 3 条**，reveal 模式可省略 |
| `tags` | string[] | 否 | 预留：词性、主题、是否可数。当前只用于筛选与调试 |

### 3.3 约束（实现时须校验）

1. `id` 在同一文件内唯一；跨文件也应唯一。
2. `distractors` 的 `en` / `zh` **不得与正确答案重复**，且三条之间互不重复。
3. `media.src` 指向的文件必须存在——**唯一例外是 `type: "pending"`**，那是"将来要放图的位置"。
   把 `pending` 改成 `image` 时，必须确认文件已经就位，否则会走 8 秒超时兜底。
4. 正确答案在 4 个选项中的落位**由运行时随机**决定，不在数据里写死顺序。
5. 缺失 `pinyin` / `hint` / `speech` 时功能降级但不报错。

---

## 4. 干扰项策略

`distractors` 用**两条腿**：

| 来源 | 优先级 | 说明 |
| --- | --- | --- |
| 词条自带 `distractors` | 高 | 手写，语义最贴，质量最好 |
| 同分类其他词条的 `answer` | 低 | 兜底：词条未写干扰项时，从同文件随机抽 |

规则：
- 优先用自带干扰项；不足 3 条时用同分类随机补足。
- 同分类不足 3 个词条时，从全题库补。
- 全题库不足 3 条 → quiz 模式该题降级为 reveal 模式，不报错。

---

## 5. 素材规范

> 素材**从哪来**、能否 AI 生成、如何保持一致风格，见 [09-asset-pipeline.md](09-asset-pipeline.md)。
> 本节只定义"到手之后必须长什么样"。

**图片没就绪时用 `media.type: "emoji"` 占位**，等图生成后改成：

```json
"media": { "type": "image", "src": "assets/fruits/apple.webp", "fallbackEmoji": "🍎", ... }
```

`fallbackEmoji` 始终保留 —— 图片加载失败时靠它兜底。

```
assets/
├── animals/
│   ├── cat.webp
│   └── dog.webp
├── fruits/
│   └── apple.webp
└── ui/
    └── (界面图标，尽量用内联 SVG 而非图片)
```

| 类别 | 规范 |
| --- | --- |
| 格式 | 静态图优先 `webp`（体积小），兼容性问题时退 `jpg`；动图用 `gif`（`webp` 动图在部分 TV 浏览器不播） |
| 尺寸 | 正方形比例，长边 800–1200px。TV 上小于 800px 会糊 |
| 体积 | 单张 ≤ 200KB；单个 GIF ≤ 2MB，时长 ≤ 3s，不循环超过 3 次 |
| 命名 | 与英文答案一致的小写 kebab-case：`cat.webp`、`ice-cream.webp` |
| 背景 | 统一风格：纯色浅底或透明底，主体占画面 60%–80%，**避免复杂背景干扰认知** |
| 版权 | 只用自有、CC0 或已获授权素材；来源记录在 `assets/SOURCES.md` |

---

## 6. 题库规模建议

| 里程碑 | 分类数 | 词条数 | 说明 |
| --- | --- | --- | --- |
| M1 骨架 | 1 | 5–10 | 够验证主循环即可，先用手绘/emoji |
| M2 可用 | 3 | 50 | 动物 / 水果 / 颜色 |
| M3 完整 | 6 | 150 | 加 数字 / 身体 / 交通工具 |

> 初版允许 `media.type: "emoji"` 作为过渡——**先用 emoji 跑通流程，再补真图**。
> 这条能显著降低 M1 的启动成本，不要一上来就找素材。

---

## 7. 未来扩展预留（当前不实现）

- `audio.custom`：预录真人发音，替代 TTS
- `media.video`：mp4 短视频
- `sentence`：例句（`"The cat is sleeping."`）
- `locale`：多语种扩展（日语、西班牙语）
- `meta.author` / `meta.createdAt`：家长自建题库的归属

**加这些字段前先改本文与 `07-decisions.md`**，不要悄悄扩展 schema。
