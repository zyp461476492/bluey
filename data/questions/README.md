# 题库目录

数据结构详见 [docs/04-data-model.md](../../docs/04-data-model.md)。

```
data/questions/
├── index.json     ← 分类注册表（新增分类必须在此登记，否则不加载）
└── animals.json   ← 一个分类一个文件
```

## 加一个词条（3 步）

1. 在对应分类文件的 `items` 里加一条（字段见 data-model §3）
2. 把图片放进 `assets/<分类>/<英文名>.webp`
3. 刷新浏览器 —— 不需要改任何代码

## 加一个分类（2 步）

1. 新建 `data/questions/<分类id>.json`，结构照抄现有文件
2. 在 `index.json` 的 `categories` 里注册 `{ id, name, icon, file }`

## 校验

```bash
python -m json.tool data/questions/animals.json > /dev/null && echo OK
```

## 当前内容（M1）

| 文件 | 题数 | 说明 |
| --- | --- | --- |
| `index.json` | — | 注册 `animals`、`vehicles` 两个主题 |
| `animals.json` | 8 | cat / dog / rabbit / elephant / fish / bird / duck / pig |
| `vehicles.json` | 4 | car / bus / train / bicycle |

12 个词全部使用 AI 手绘素材（`assets/<主题>/<slug>.webp`），
由 `assets/_pilot/` 的打样产物转正而来。
年龄分层与词表规划见 [docs/11-curriculum-design.md](../../docs/11-curriculum-design.md)。
