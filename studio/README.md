# studio/ · 生产端（未开始实现）

题库与素材生成器。**架构方案见 [`docs/10-studio-architecture.md`](../docs/10-studio-architecture.md)。**

## 三条边界（先记住这三条，再看方案）

1. **Studio 是独立制品**。它不 import `app/` 的任何代码，也不被 `app/` import。
   删掉整个 `studio/` 目录，`app/` 照常跑。
2. **Studio 不读 `data/questions/`**。那是它的输出。它只写 SQLite，导出时才生成 JSON。
3. **Studio 不直接调用生图模型**。生图能力挂在 agent 工具上，不是 HTTP API。
   Studio 只生产"生成工单"（JSON 文件），由 agent 执行后回写结果。

## 计划中的结构

```
studio/
├── package.json
├── config.json          来源策略链 + 额度预算
├── data/studio.db       SQLite 工作库（gitignore）
├── outbox/              agent 待执行工单（gitignore）
├── inbox/               agent 回写结果（gitignore）
├── server/              Express 5 + node:sqlite
└── web/                 React 18 + Vite + shadcn/ui (TS)
```

## 端口

App `5173` / Studio 前端 `5174` / Studio API `5175`

## 状态

| 阶段 | 状态 |
| --- | --- |
| S0 骨架（建表 + seed） | 未开始 |
| S1 词条管理 | 未开始 |
| S2 工单与入库 | 未开始 |
| S3 发布 | 未开始 |

> 当前阶段先做 `app/` 的 M1 主循环——Studio 的效率收益只有在词条数超过 50 之后才显现。
> 见 `docs/08-roadmap.md` 的「第二条线」。
