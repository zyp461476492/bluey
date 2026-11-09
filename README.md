# Bluey · 看图猜词

面向 3–8 岁儿童的双语看图猜词学习应用。纯前端，一套代码自适应**电视 / 平板 / 手机**。

```
一张图出现  →  孩子猜一猜  →  5 秒倒计时  →  揭晓中英文答案 + 发音  →  下一题
```

## 快速开始

题库通过 `fetch()` 读取，**不能直接双击 HTML 打开**（`file://` 会被 CORS 拦）。

```bash
# 仓库根目录，二选一
python -m http.server 5173
npx --yes serve -l 5173 .
```

打开 <http://localhost:5173>。

- 电视 / 手机：同一局域网访问 `http://<本机IP>:5173`
- 改完文件直接刷新浏览器，**没有构建步骤**

## 项目状态

| 里程碑 | 状态 |
| --- | --- |
| M0 地基（文档 + 结构） | 已完成 |
| M1 主循环 | 未开始 |
| M2 题库 | 未开始 |
| M3 三端自适应 | 未开始 |
| S0–S3 生产端（Studio） | 未开始 |

> 当前仓库只有文档与目录骨架，`app/` 与 `studio/` 尚未开始实现。

## 两个制品

| 目录 | 是什么 | 技术栈 |
| --- | --- | --- |
| `app/` | 给孩子玩的运行端 | 纯静态 HTML/CSS/JS，零构建 |
| `studio/` | 题库与素材生成器 | Node + Express + SQLite + Vue 3 |

依赖方向单向：`studio → data/ + assets/ → app`。删掉 `studio/`，`app/` 照常跑。

## 文档

所有规格在 `docs/`，`AGENTS.md` 是导航入口：

| 文档 | 内容 |
| --- | --- |
| [docs/README.md](docs/README.md) | 文档索引与阅读顺序 |
| [docs/01-vision.md](docs/01-vision.md) | 产品愿景、目标用户、非目标 |
| [docs/02-requirements.md](docs/02-requirements.md) | 功能范围与验收标准 |
| [docs/03-ux-devices.md](docs/03-ux-devices.md) | 三端交互设计与响应式策略 |
| [docs/04-data-model.md](docs/04-data-model.md) | 题库 JSON 格式与素材规范 |
| [docs/05-architecture.md](docs/05-architecture.md) | 技术架构与状态机 |
| [docs/06-harness.md](docs/06-harness.md) | AI agent 协作约定 |
| [docs/07-decisions.md](docs/07-decisions.md) | 技术决策记录（ADR） |
| [docs/08-roadmap.md](docs/08-roadmap.md) | 里程碑路线图 |
| [docs/09-asset-pipeline.md](docs/09-asset-pipeline.md) | 素材来源、AI 生图、风格一致性 |
| [docs/10-studio-architecture.md](docs/10-studio-architecture.md) | 生产端（题库与素材生成器）架构 |
| [docs/11-curriculum-design.md](docs/11-curriculum-design.md) | 题库分层：年龄档、主题矩阵、词表 |

## 核心约束

- **`app/` 零构建**：没有 npm / webpack / vite，改完刷新即生效
- **`app/` 零后端**：无账号、无数据库，离线可用
- **数据驱动**：加词条只改 `data/questions/*.json`，不改代码（或用 Studio 改）
- **`studio/` 不受零构建约束**：它是本地生产工具，可以用现代栈

细节与理由见 [docs/07-decisions.md](docs/07-decisions.md)。
