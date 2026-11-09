# 文档索引

`docs/` 是本项目的**规格唯一事实来源**。代码与文档冲突时，以文档为准，代码视为缺陷。

## 阅读顺序

| 序号 | 文档 | 回答什么问题 | 主要读者 |
| --- | --- | --- | --- |
| 01 | [01-vision.md](01-vision.md) | 为什么做、给谁做、怎样算成功 | 所有人，先读这篇 |
| 02 | [02-requirements.md](02-requirements.md) | 这一版做哪些功能、验收标准是什么 | 开发 / 验收 |
| 03 | [03-ux-devices.md](03-ux-devices.md) | 电视/平板/手机上分别长什么样、怎么操作 | 开发 / 设计 |
| 04 | [04-data-model.md](04-data-model.md) | 题库 JSON 怎么写、素材怎么放 | 内容 / 开发 |
| 05 | [05-architecture.md](05-architecture.md) | 代码怎么组织、状态怎么流转 | 开发 |
| 06 | [06-harness.md](06-harness.md) | AI agent 在本仓库怎么工作 | agent / 维护者 |
| 07 | [07-decisions.md](07-decisions.md) | 已经定下的技术决策和理由 | 开发 / 后来者 |
| 08 | [08-roadmap.md](08-roadmap.md) | 先做什么后做什么 | 所有人 |
| 09 | [09-asset-pipeline.md](09-asset-pipeline.md) | 素材从哪来、能不能 AI 生、怎么保持一致风格 | 内容 / 开发 |
| 10 | [10-studio-architecture.md](10-studio-architecture.md) | 生产端（题库与素材生成器）怎么设计 | 开发 |
| 11 | [11-curriculum-design.md](11-curriculum-design.md) | 题库怎么分层：年龄档、主题矩阵、词表 | 内容 / 开发 |

## 文档纪律

1. **一个主题一个文件**，不要把所有东西塞进一篇大文档。
2. **改行为先改文档**：先提交对 `02-requirements.md` 的修改，再动代码。
3. **不做悬空引用**：删除或重命名文档时，同步修正 `AGENTS.md` 与本索引中的链接。
4. **决策要留痕**：任何「我们决定不用 X」都写进 `07-decisions.md`，否则三个月后会被重新讨论一遍。
5. **不写实现细节进需求文档**：需求写「是什么」，架构写「怎么实现」。
