# 素材目录

规范详见 [docs/04-data-model.md](../docs/04-data-model.md) §5，
**素材来源与 AI 生图流水线**见 [docs/09-asset-pipeline.md](../docs/09-asset-pipeline.md)。

```
assets/
├── animals/
│   └── cat.webp
├── fruits/
├── ui/         界面图标优先用内联 SVG，尽量不放图片
├── _style/     AI 生图的风格锚图（不进产品，已 gitignore）
└── _raw/       原始大图（不进产品，已 gitignore）
```

## 硬要求

| 项 | 要求 |
| --- | --- |
| 命名 | 与英文答案一致的小写 kebab-case：`cat.webp`、`ice-cream.webp` |
| 比例 | 正方形，长边 800–1200px（TV 上低于 800px 会糊） |
| 体积 | 单张 ≤ 200KB；单个 GIF ≤ 2MB、≤ 3s |
| 格式 | 静态图 `webp`；动图 `gif`（webp 动图部分 TV 不播） |
| 背景 | 浅色纯底或透明底，主体占 60%–80%，背景别抢戏 |
| 版权 | 自有 / CC0 / 已授权；来源记进 `SOURCES.md` |

> 原始大图放 `assets/_raw/`（已在 `.gitignore` 中忽略），只把压缩后的成品入库。
> M1 阶段允许先用 `media.type: "emoji"` 占位，不阻塞开发。
