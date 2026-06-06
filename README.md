# 2026 世界杯赛况与预测面板

一个轻量的前后端原型，用来把 2026 世界杯的实时赛况、次日预测、盘口/Polymarket 数据和 LLM 分析放在同一屏中对照展示。

## 当前内容

- 零依赖本地 Node 服务
- 研究面板首页结构：
  - **KPI Hero**：已扫描 / 推荐 / 强信号 / 观察区概览，以及数据源状态条
  - **赛程 Spotlight**：未来三天重点比赛，按信号强度排序
  - **Tab 主视图**：价值信号 · 比赛盘面 · 复盘与解释
  - **Match Drawer**：点击任意比赛行查看模型 vs 市场详情
- 前端通过 `app/` 模块化脚本分 tier 刷新（赛程 5 分钟 · 信号 8 分钟 · 质量 30 分钟）
- 服务端 `data-guard` 在 demo/research 模式下过滤 mock 混入的数据
- 默认优先走真实 `The Odds API` 与 `football-data.org`；`Polymarket` 默认关闭

## 本地打开

在项目目录运行：

```bash
npm run dev
```

然后访问 `http://127.0.0.1:3000`。

当前默认行为：
- 市场预测优先走真实 `The Odds API`
- 实时比赛优先走真实 `football-data.org`
- `Polymarket` 默认关闭，不影响主流程稳定性

## 环境变量

- 本地私密配置放在 [`.env`](/Users/liuzhen/Documents/guess_worldcup2026/.env)
- 可共享模板放在 [.env.example](/Users/liuzhen/Documents/guess_worldcup2026/.env.example)
- `.env` 已加入 [.gitignore](/Users/liuzhen/Documents/guess_worldcup2026/.gitignore)，不会被 Git 跟踪
- provider 原始抓取结果会默认缓存在 `fixtures/cache/` 下的本地 JSON 文件中

### 本地缓存

- `PROVIDER_CACHE_ENABLED=true`
- `PROVIDER_CACHE_DIR=./fixtures/cache`

默认缓存策略：

- `ODDS_CACHE_TTL_SECONDS=1800`
- `POLYMARKET_CACHE_TTL_SECONDS=900`
- `FOOTBALL_DATA_CACHE_TTL_SECONDS=300`
- `BZZOIRO_CACHE_TTL_SECONDS=1800`

这层缓存的目标是减少免费 API 的重复读取，开发联调和页面重复刷新会优先复用本地 JSON 快照。

## API 端点

- `/api/health`
- `/api/dashboard`
- `/api/live-matches`
- `/api/tomorrow-predictions`
- `/api/market-sources`
- `/api/post-match-review`
- `/api/analysis-items`
- `/api/modeling-steps`
- `/api/expert-opinions`
- `/api/raw-market-board`
- `/api/prediction-pipeline`
- `/api/providers/status`
- `/api/providers/catalog`
- `/api/data/supplemental-signals`
- `/api/data/normalized-matches`
- `/api/data/quality-report`
- `/api/data/provider-coverage`
- `/api/data/refresh-policy`

## 数据分层

- [data-source-catalog.json](/Users/liuzhen/Documents/guess_worldcup2026/data-source-catalog.json)
  项目内信源目录。新增、删减、调整优先级都改这里，不要在脚本里硬编码。
- [providers/mock/index.js](/Users/liuzhen/Documents/guess_worldcup2026/providers/mock/index.js)
  负责聚合 mock provider 输出。
- [fixtures/](/Users/liuzhen/Documents/guess_worldcup2026/fixtures)
  按主题拆分 mock 数据，不再把所有样例堆在一个脚本里。
- [data-sources.js](/Users/liuzhen/Documents/guess_worldcup2026/data-sources.js)
  负责切换 provider 模式，目前支持 `mock` 和 `file`。
- [market-pipeline.js](/Users/liuzhen/Documents/guess_worldcup2026/market-pipeline.js)
  负责赔率去水、三方概率归一化、市场聚合和首版预测生成。
- [dashboard-data.js](/Users/liuzhen/Documents/guess_worldcup2026/dashboard-data.js)
  负责组装首页需要的完整数据。
- [data-hub.js](/Users/liuzhen/Documents/guess_worldcup2026/data-hub.js)
  提供标准化比赛数据、数据质量报告和 provider 覆盖报告。
- [schemas/market-board.js](/Users/liuzhen/Documents/guess_worldcup2026/schemas/market-board.js)
  定义并校验原始市场数据 schema。
- [schemas/live-matches.js](/Users/liuzhen/Documents/guess_worldcup2026/schemas/live-matches.js)
  校验实时比赛卡片数据。
- [schemas/expert-opinions.js](/Users/liuzhen/Documents/guess_worldcup2026/schemas/expert-opinions.js)
  校验专家观点结构。
- [schemas/normalized-matches.js](/Users/liuzhen/Documents/guess_worldcup2026/schemas/normalized-matches.js)
  校验标准化后的比赛输出。
- [providers/provider-registry.js](/Users/liuzhen/Documents/guess_worldcup2026/providers/provider-registry.js)
  作为 provider 适配入口，后续可以在这里注册真实数据源。
- [providers/odds/](/Users/liuzhen/Documents/guess_worldcup2026/providers/odds)
- [providers/polymarket/](/Users/liuzhen/Documents/guess_worldcup2026/providers/polymarket)
- [providers/live/](/Users/liuzhen/Documents/guess_worldcup2026/providers/live)
- [providers/opinions/](/Users/liuzhen/Documents/guess_worldcup2026/providers/opinions)
  这三个目录已经建好适配器骨架，后续接真实源直接往里扩。
  现在 `odds`、`polymarket`、`live` 已经有真实适配器初版。

## 可切换数据模式

- 默认模式：`MARKET_DATA_MODE=real`
- 文件模式：`MARKET_DATA_MODE=file`
- 实时赛况模式默认：`LIVE_DATA_MODE=real`
- 信源目录文件：`SOURCE_CATALOG_FILE=./data-source-catalog.json`

文件模式下，服务会读取：

- [fixtures/raw-market-board.json](/Users/liuzhen/Documents/guess_worldcup2026/fixtures/raw-market-board.json)

也可以通过环境变量覆盖：

```bash
RAW_MARKET_BOARD_FILE=./fixtures/raw-market-board.json MARKET_DATA_MODE=file npm run dev
```

如需改信源目录，也可以覆盖：

```bash
SOURCE_CATALOG_FILE=./data-source-catalog.json npm run dev
```

## 真实 Provider 配置

### Polymarket

- `POLYMARKET_PUBLIC_ENABLED`
- `POLYMARKET_TAG_ID`
- `POLYMARKET_SLUG`
- `POLYMARKET_SEARCH_TERMS`
- `POLYMARKET_LIMIT`

当前默认关闭。若要手动启用，再设置：

```bash
POLYMARKET_PUBLIC_ENABLED=true
```

启用后会尝试走公开无 key 模式；未配置 `TAG_ID` / `SLUG` 时，会抓取公开 events 并按 `POLYMARKET_SEARCH_TERMS` 过滤。

### The Odds API

- `ODDS_API_KEY`
- `ODDS_SPORT_KEY`
- `ODDS_REGIONS`
- `ODDS_MARKETS`

默认会拉 `h2h,spreads,totals` 三类盘口，保留 1X2 主盘的同时，把让球和大小球线也一起留在 `rawMarketBoard` / `normalized-matches` 输出里。

默认 sport key 是 `soccer_fifa_world_cup`，接口参考 The Odds API v4 文档。

### Sportmonks

- `SPORTMONKS_API_TOKEN`
- `SPORTMONKS_START_DATE`
- `SPORTMONKS_END_DATE`

实时赛况 provider 当前使用 `fixtures/between/{start}/{end}` 并请求 `participants;scores`。

### football-data.org

- `FOOTBALL_DATA_API_KEY`
- `FOOTBALL_DATA_DATE_FROM`
- `FOOTBALL_DATA_DATE_TO`

当前 live provider 会优先使用 `football-data.org`，如果未配置，再退回到 `Sportmonks` 适配器。

### Bzzoiro Sports Data（可选补充源）

- `BZZOIRO_API_TOKEN`
- `BZZOIRO_DATE_FROM`
- `BZZOIRO_DATE_TO`
- `BZZOIRO_LEAGUE`
- `BZZOIRO_TIMEZONE`
- `BZZOIRO_ODDS_EVENT_LIMIT`

这个源主要用来补充赛前上下文和模型层信号，不接入主 dashboard 主流程。配置后可通过 `/api/data/supplemental-signals` 拉取：

- 赛事级补充字段（包含 1X2 / O/U 摘要）
- Bzzoiro 的 ML 预测、预期进球和 most likely score
- 赛事级上下文：天气、旅行距离、教练画像、停赛/伤停摘要
- 按 event 聚合的 bookmaker odds snapshots（含 `previous_decimal_odds` / `movement`）
- Bzzoiro 的 event-level Polymarket 映射结果

当前项目建议把 `BZZOIRO_LEAGUE` 设为 `27`，对应 `World Cup 2026`。

## QA

可运行：

```bash
npm run qa:providers
```

它会：
- 检查已配置的真实 provider 是否可访问
- 对未配置的 provider 标记为 skipped
- 验证 mock 数据仍符合 schema

## 推荐的下一步

1. 接入真实赛程/比分 API，把 `liveMatches` 替换成实时数据。
2. 定义统一的数据模型，把赔率、Polymarket 和模型输出整理成相同概率结构。
3. 第一版预测模型建议先做 market baseline：
   - 赔率去水
   - 多来源加权平均
   - 再加一个轻量校准层
4. 把 LLM 只用于解释和总结，不直接作为概率生成主引擎。
5. 如果要开始接接口，建议优先抽成这 4 个 endpoint：
   - `/api/live-matches`
   - `/api/tomorrow-predictions`
   - `/api/market-sources`
   - `/api/post-match-review`
6. 接真实数据时，优先只替换 `providers/` 或 `fixtures/` 里的 provider 输出，尽量不要先改聚合层。
7. 如果要先做“半真实”演示，可以把抓取结果定时写入 `fixtures/raw-market-board.json`，服务端直接走 `file` 模式读取。
8. 信源清单统一维护在 `data-source-catalog.json`，不要把供应商名字、文档地址和接入优先级散落到各个脚本里。
9. 专家观点建议作为解释层输入，先保留 `summary / stance / signalTags` 结构，不要直接把名嘴观点硬映射成胜平负概率。
10. 接真实 provider 时，优先先看 `/api/data/quality-report` 和 `/api/data/provider-coverage`，确认数据质量，再接页面和后续分析。
11. 新接入的市场数据先通过 `schemas/market-board.js` 校验，再进入聚合层，避免脏数据直接污染预测结果。
12. `live matches`、`expert opinions` 和 `normalized matches` 现在也有独立 schema，建议保持“每类数据一个 schema 文件”的做法继续扩展。
13. 真实 provider 的网络联调目前受本地网络和密钥限制影响较大，所以我已经把适配器和 QA 脚本接好；你提供 key 后可以直接跑 `npm run qa:providers` 做实网验证。
14. 当前推荐演示模式就是默认模式：真实赔率 + 真实 live，Polymarket 默认关闭。
