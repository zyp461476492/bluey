# 素材来源记录

> 本表是**素材授权台账**，不是可选项。每条入库素材必须有一行。
> 原因见 `docs/09-asset-pipeline.md` §2.4：将来若对外发布，需要一键筛出"仅家用"素材。

## 登记表

同一批次、同一来源、同一授权的素材合并为一行，避免台账膨胀到上百行而没人看。
**判定"能不能对外发布"时按批次筛就够了**——同一批的授权完全相同。

| 批次 | 文件 | 张数 | 来源 | 授权 | 商用 | 日期 |
| --- | --- | --- | --- | --- | --- | --- |
| 打样 | `animals/{cat,dog,rabbit,elephant,fish,bird,duck,pig}.webp`<br>`vehicles/{car,bus,train,bicycle}.webp` | 12 | AI 生成（本机 ImageGen，风格锚 `_style/`） | 平台生成物 | 可商用 | 2026-11-09 |
| ① 工程车 | `construction/{excavator,bulldozer,road-roller,crane,dump-truck,cement-mixer,forklift,loader}.webp` | 8 | 同上 | 同上 | 可商用 | 2026-11-09 |
| ② 具象名词 | `animals/{cow,sheep,horse}.webp`<br>`fruits/*.webp`（8）<br>`vehicles/{airplane,boat,ship,fire-engine,ambulance,police-car,truck,helicopter}.webp`（8）<br>`body/*.webp`（8） | 27 | 同上 | 同上 | 可商用 | 2026-11-09 |
| ③ 生活词 | `clothes/*.webp`（6）<br>`food/*.webp`（8） | 14 | 同上 | 同上 | 可商用 | 2026-11-09 |
| — | `colors/`、`numbers/` | 0 | **不生成 AI 图**，走 CSS 渲染（见 `docs/11` §8.1） | — | — | — |

**当前合计：61 张 AI 生成图，全部为「可商用」。** 无 NC 授权素材，无 OpenMoji/Twemoji，
无 ARASAAC。将来若对外发布，**不需要替换任何一张图**（只需复核平台条款）。

> 全部经过同一条流水线：去水印（右下 20%×12% 区域按行填背景色）→ 转 webp q90。
> 体积 25–89KB，平均 55KB，合计 3.3MB。详见 `docs/09-asset-pipeline.md` §8。

### 批次实绩

| 批次 | 产出 | 生成次数 | 一次过 | 重画 | 额度 |
| --- | --- | --- | --- | --- | --- |
| 风格锚 | 1 张 | 1 | 1 | 0 | 5–10 |
| 打样 12 张 | 12 | 12 | 12 | 0 | 65–130 |
| ① 工程车 | 8 | 8 | 8 | 0 | 40–80 |
| ② 具象名词 | 27 | 30 | 25 | 2 词（hair、mouth） | 150–300 |
| ③ 生活词 | 14 | 15 | 13 | 1 词（egg） | 75–150 |
| ④ 颜色/数字 | 0 | **0** | — | — | **0** |
| **合计** | **61** | **66** | **59** | **3** | **330–660** |

> **一次过率 59/61 = 96.7%**（按最终采用的图算）。浪费的调用只有 4 次：
> `mouth` 的中间版本 1 次 + 3 次重画。
>
> 相比开工前按"废片率 30–50%"做的预算（49 张 ≈ 340–680 额度），
> 实际 330–660 落在区间下沿。**风格锚 + 固定 prompt 模板的稳定性远超预期。**

> 重画的三个词都是「单件物体没有参照物」：`hair`（一坨深色看不出发丝）、
> `mouth`（被画成彩色圆球）、`egg`（米色蛋壳与米色背景对比过低）。
> 共同点见 `docs/09` §8.7。

## 商用列取值（三选一，必填）

| 标签 | 适用授权 | 将来公开发布时 |
| --- | --- | --- |
| `可商用` | CC0 / Apache 2.0 / MIT / 买断 | 直接留用 |
| `需署名` | CC BY / CC BY-SA / Freepik 免费档 | 留用，但须在应用「素材来源」页列出 |
| `仅家用` | CC BY-NC 系列（ARASAAC 等） | **必须替换** |

## 常用来源速查

| 来源 | 授权 | 商用标签 |
| --- | --- | --- |
| Noto Emoji（github.com/googlefonts/noto-emoji） | Apache 2.0（SVG 目录） | 可商用 |
| Fluent Emoji（github.com/microsoft/fluentui-emoji） | MIT | 可商用 |
| OpenMoji（openmoji.org） | CC BY-SA 4.0 | 需署名 |
| Twemoji（github.com/jdecked/twemoji） | CC BY 4.0 | 需署名 |
| Openclipart（openclipart.org） | CC0 | 可商用 |
| ARASAAC（arasaac.org） | CC BY-NC-SA | **仅家用** |
| AI 生成（本机工具） | 平台条款 | 家用无碍，先标 `需署名` 待核对 |

## 禁止事项

- ❌ Apple Emoji / Windows Segoe UI Emoji / 各 OEM emoji 的图片文件（专有美术资源，不可提取打包）
- ❌ 来源不明的网络图片
- ❌ 任何 Bluey 动画的角色形象素材（见 ADR-007）
- ❌ 未登记就放进 `assets/` 的文件

## 署名格式（用于应用内「素材来源」页，M5 做）

```
Emoji 图形来自 OpenMoji (CC BY-SA 4.0) 与 Twemoji (CC BY 4.0)
象形图来自 ARASAAC，作者 Sergio Palao，版权归 Gobierno de Aragón，
以 CC BY-NC-SA 许可发布（仅限非商业用途）
```
