# 项目级技能（skills/）

存放**跨 runtime 优先加载**的项目技能（WorkBuddy / opencode / Claude Code 均识别本目录）。
约定详见 [docs/06-harness.md](../docs/06-harness.md) §7。

## 什么时候建 skill

同一个操作**重复执行 ≥ 3 次**，步骤固定且容易漏步 → 才抽成 skill。
提前抽出来的通常是错的抽象。

## 结构

```
skills/
└── <skill-name>/
    ├── SKILL.md       触发条件 + 步骤 + 校验点（必需）
    └── scripts/       可选辅助脚本
```

## 候选清单（尚未创建）

| 候选 | 触发场景 | 要点 |
| --- | --- | --- |
| `add-vocab` | 新增词条 | 校验 JSON → 检查图片存在 → 干扰项不重复 → 注册 index |
| `check-bank` | 题库体检 | id 唯一、字段必填、素材路径存在、体积超标告警 |
| `verify-layout` | 三端自检 | 三尺寸截图，查溢出、焦点环、对比度 |

> M0/M1 阶段不建 skill。等真正重复第三次再说。
