# 2026 世界杯赛况与预测面板

一个轻量的前后端原型，用来把 2026 世界杯的实时赛况、次日预测、盘口/Polymarket 数据和 LLM 分析放在同一屏中对照展示。

## 当前内容

- 零依赖本地 Node 服务
- 研究面板首页结构：
  - **KPI Hero**：已扫描 / 推荐 / 强信号 / 观察区概览，以及数据源状态条
  - **赛程 Spotlight**：自开幕日起按周浏览重点比赛，可展开完整赛程
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

如需做完整本地 QA，可运行：

```bash
npm test
npm run qa:research-guardrails
npm run qa:frontend
```

其中 `qa:frontend` 需要本地已有 `npm run dev` 服务在 `http://127.0.0.1:3000` 提供页面与 API；如需覆盖地址，可设置 `FRONTEND_QA_BASE_URL`。
如果 `3000` 端口已被其他进程占用，可改用例如 `PORT=3301 npm run dev`，然后执行 `FRONTEND_QA_BASE_URL=http://127.0.0.1:3301 npm run qa:frontend`。

当前默认行为：
- 市场预测优先走真实 `The Odds API`
- 实时比赛优先走真实 `football-data.org`
- `Polymarket` 默认关闭，不影响主流程稳定性

## 环境变量

- 本地私密配置放在 [`.env`](.env)
- 可共享模板放在 [.env.example](.env.example)
- `.env` 已加入 [.gitignore](.gitignore)，不会被 Git 跟踪
- provider 原始抓取结果会默认缓存在 `fixtures/cache/` 下的本地 JSON 文件中

### 应用模式

- `APP_MODE=demo`
- `APP_MODE=research`

模式差异：

- `demo`：允许真实 provider 失败时回退到 mock，适合页面演示
- `research`：禁止 silent fallback；真实 provider 失败会直接报错，避免把 mock 混进研究结果

### 本地缓存

- `PROVIDER_CACHE_ENABLED=true`
- `PROVIDER_CACHE_DIR=./fixtures/cache`

默认缓存策略：

- `ODDS_CACHE_TTL_SECONDS=1800`
- `POLYMARKET_CACHE_TTL_SECONDS=900`
- `FOOTBALL_DATA_CACHE_TTL_SECONDS=300`
- `BZZOIRO_CACHE_TTL_SECONDS=1800`

这层缓存的目标是减少免费 API 的重复读取，开发联调和页面重复刷新会优先复用本地 JSON 快照。

### 本地快照

可运行：

```bash
npm run snapshot:providers
```

它会把当前 provider 状态、pipeline、recommendation snapshots、recommendation settlements、post-match review、backtest run、live 数据和 supplemental signals 落到 `fixtures/snapshots/`，后续做 quant/QA 时可以优先用这些本地快照而不是重复请求外部 API。
其中 `post-match review` 会优先尝试用真实 live 赛果和赛前预测派生，并在质量报告里输出 finished/matched/live-derived 覆盖率；`recommendation settlements` 会优先用真实 live 赛果 + 官方盘 stop-sale 赔率，并在质量报告里输出 liveMatch / officialMatch / officialSettlement 覆盖率；`backtest run` 只有在存在真实赛后结算条目时才会刷新，避免用 mock 覆盖真实样本；如果没有可用的真实对齐数据，再回退到 artifact 或 mock。

前端现有接口不需要改，仍然直接消费：

- `/api/data/recommendation-snapshots`
- `/api/data/recommendation-settlements`

后端会优先读取 `fixtures/snapshots/` 下的 artifact，文件不存在时再退回到实时 pipeline 计算。

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
- `/api/data/market-snapshots`
- `/api/data/signal-candidates`
- `/api/data/jingcai-recommendations`
- `/api/data/recommendation-snapshots`
- `/api/data/recommendation-settlements`
- `/api/data/quality-report`
- `/api/data/provider-coverage`
- `/api/data/portfolio-review`
- `/api/data/backtest-review`
- `/api/data/refresh-policy`

## 数据分层

- [data-source-catalog.json](data-source-catalog.json)
  项目内信源目录。新增、删减、调整优先级都改这里，不要在脚本里硬编码。
- [providers/mock/index.js](providers/mock/index.js)
  负责聚合 mock provider 输出。
- [fixtures/](fixtures)
  按主题拆分 mock 数据，不再把所有样例堆在一个脚本里。
- [data-sources.js](data-sources.js)
  负责切换 provider 模式，目前支持 `mock` 和 `file`。
- [market-pipeline.js](market-pipeline.js)
  负责市场快照归一化、baseline / signal candidate / 竞彩建议与分层输出生成。
- [dashboard-data.js](dashboard-data.js)
  负责组装首页需要的完整数据，并把竞彩建议、layered output、组合/回测摘要挂到 dashboard。
- [data-hub.js](data-hub.js)
  提供标准化比赛数据、数据质量报告、provider 覆盖、组合复盘与回测摘要。
- [schemas/market-board.js](schemas/market-board.js)
  定义并校验原始市场数据 schema。
- [schemas/live-matches.js](schemas/live-matches.js)
  校验实时比赛卡片数据。
- [schemas/expert-opinions.js](schemas/expert-opinions.js)
  校验专家观点结构。
- [schemas/normalized-matches.js](schemas/normalized-matches.js)
  校验标准化后的比赛输出。
- [providers/provider-registry.js](providers/provider-registry.js)
  作为 provider 适配入口，后续可以在这里注册真实数据源。
- [providers/odds/](providers/odds)
- [providers/polymarket/](providers/polymarket)
- [providers/live/](providers/live)
- [providers/opinions/](providers/opinions)
  这三个目录已经建好适配器骨架，后续接真实源直接往里扩。
  现在 `odds`、`polymarket`、`live` 已经有真实适配器初版。

## 可切换数据模式

- 默认模式：`MARKET_DATA_MODE=real`
- 文件模式：`MARKET_DATA_MODE=file`
- 实时赛况模式默认：`LIVE_DATA_MODE=real`
- 信源目录文件：`SOURCE_CATALOG_FILE=./data-source-catalog.json`

文件模式下，服务会读取：

- [fixtures/raw-market-board.json](fixtures/raw-market-board.json)

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
- `ODDS_COMMENCE_TIME_FROM`
- `ODDS_COMMENCE_TIME_TO`

当前代码默认只开 `h2h`；需要更完整覆盖时再把 `spreads,totals` 加回去。`commenceTimeFrom/To` 用来限定比赛窗口，减少无关赛事和 quota 消耗。

默认 sport key 是 `soccer_fifa_world_cup`，接口参考 The Odds API v4 文档。

如果要显示金额化建议，再显式开启：

```bash
ENABLE_STAKE_SUGGESTION=true
```

### Sportmonks

- `SPORTMONKS_API_TOKEN`
- `SPORTMONKS_START_DATE`
- `SPORTMONKS_END_DATE`

实时赛况 provider 当前使用 `fixtures/between/{start}/{end}` 并请求 `participants;scores`。

### football-data.org

- `FOOTBALL_DATA_API_KEY`
- `FOOTBALL_DATA_COMPETITION_CODE`
- `FOOTBALL_DATA_DATE_FROM`
- `FOOTBALL_DATA_DATE_TO`

当前 live provider 会优先使用 `football-data.org`，按赛事 code 和日期窗口请求完整赛程；如果未配置，再退回到 `Sportmonks` 适配器。

如果需要在不连实时 live provider 的情况下跑离线 research，可以显式开启：

```bash
LIVE_SNAPSHOT_REPLAY_ENABLED=true
LIVE_SNAPSHOT_REPLAY_FILE=./fixtures/snapshots/latest/live-data.json
```

这会让 A 侧优先消费 B 侧的 `latest/live-data.json` 回放文件；默认仍然是 fail-fast，不会静默替代真实 live。

### 竞彩足球官方盘

- `JINGCAI_OFFICIAL_FEED_MODE` — `file`（读 latest 快照）| `webapi`（实时拉体彩网关）| `fixture`
- `JINGCAI_OFFICIAL_FEED_FILE`
- `SPORTTERY_CLIENT_CODE`（默认 `3001`）
- `JINGCAI_WEBAPI_LEAGUE_FILTER`（默认 `世界杯`）

**主数据源**：体彩官网 JSON 网关 `webapi.sporttery.cn`（见 [docs/SPORTTERY_JINGCAI_WEBAPI.md](./docs/SPORTTERY_JINGCAI_WEBAPI.md)）。

```bash
npm run fetch:jingcai-webapi   # 刷新 latest/jingcai-official-feed.json + raw 落盘
```

`latest/jingcai-official-feed.json` 当前为 `source=sporttery_webapi`、`sourceMode=real`；2026-06-09 已覆盖原人工快照中的过期/错误赔率。

QA 验证：

```bash
JINGCAI_OFFICIAL_FEED_MODE=file \
JINGCAI_OFFICIAL_FEED_FILE=fixtures/snapshots/latest/jingcai-official-feed.json \
npm run qa:providers
```

`webapi` 模式会实时请求官网；research 离线联调推荐 `file` + 上述 latest 快照。

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

## 量化模块文档

| 文档 | 用途 |
|------|------|
| [docs/QUANT_STRATEGY_SPEC.md](docs/QUANT_STRATEGY_SPEC.md) | 算法、体彩收敛、输出契约（WHAT） |
| [docs/QUANT_IMPLEMENTATION_PLAN.md](docs/QUANT_IMPLEMENTATION_PLAN.md) | 分阶段实施、QA 门禁、**pick-up 状态**（HOW） |
| [docs/DATA_SOURCE_REALITY_TRACKER.md](docs/DATA_SOURCE_REALITY_TRACKER.md) | 输入数据真实度、mock/fixture 替换进度（REALITY） |
| [docs/RESEARCH_EXECUTION_PLAN.md](docs/RESEARCH_EXECUTION_PLAN.md) | Agent A/B 分工下的 research 启动执行计划与接口对齐标准 |

接手量化开发时：先读 plan 顶部 **Pick-up 状态**，本实施计划的 Phase 0-7 已全部完成。Phase 0 / Phase 1 / Phase 2 / Phase 3 / Phase 4 / Phase 5 / Phase 6 / Phase 7 都已在代码树中落地并可通过 `npm test` 与 `npm run qa:research-guardrails` 验证；当前主链路已经迁移到 quant baseline + decision layer + Jingcai 收敛输出 + portfolio/backtest review。纯数学模块在 `quant/`，验证用 `npm test`（无需 API）。

如果你关心当前到底有多少输入是真实数据、哪些还是 `mock/fixture`，先看 [docs/DATA_SOURCE_REALITY_TRACKER.md](docs/DATA_SOURCE_REALITY_TRACKER.md)。

## QA

可运行：

```bash
npm test
npm run qa:research-guardrails
npm run qa:providers
```

它会：
- 验证纯函数/模块级测试
- 验证 demo/research 模式下的 fallback 护栏
- 检查已配置的真实 provider 是否可访问
- 对未配置的 provider 标记为 skipped
- 验证 mock 数据仍符合 schema

## 推荐的下一步

**A/B research 执行计划**（优先）：先读 [docs/RESEARCH_EXECUTION_PLAN.md](docs/RESEARCH_EXECUTION_PLAN.md) 或 `/api/data/research-execution-plan`。这个入口会直接告诉你当前 research 还差什么、Agent A 应做什么、Agent B 应交付什么。

**量化主线**：见 [docs/QUANT_IMPLEMENTATION_PLAN.md](docs/QUANT_IMPLEMENTATION_PLAN.md) — 当前实施计划已完成；现有实现覆盖 Phase 0/1/2/3/4/5/6/7 的基础数学、研究护栏、市场快照标准化、基础 pricing、决策层、Jingcai 收敛输出、Layer A/B/C 契约与 portfolio/backtest foundation。

**Dashboard / Provider 维护**（并行）：

1. 接真实 provider 时，优先先看 `/api/data/quality-report` 和 `/api/data/provider-coverage`，其中 `quality-report` 现在会附带 `researchSafeStatus`、`researchSafeBlockReasons`，以及 `marketSourceMode/liveSourceMode/jingcaiSourceMode`，方便判断为什么还不能进入 research 安全态。
2. 新接入的市场数据先通过 `schemas/market-board.js` 校验，再进入聚合层。
3. 真实 provider 联调：`npm run qa:providers`（需 key）；本地重复开发用 `npm run snapshot:providers` 写 `fixtures/snapshots/`。
4. 如果要离线跑 research，显式开启 `LIVE_SNAPSHOT_REPLAY_ENABLED=true`，让 A 侧消费 `fixtures/snapshots/latest/live-data.json`。
5. 如果要跑单场黄金路径 replay，直接把 `MARKET_DATA_MODE=replay`、`LIVE_DATA_MODE=replay`，然后执行 `npm run qa:pipeline-replay` 或 `npm run pipeline:replay`。

### Layer A 输出契约

`/api/data/quality-report` 会把每场比赛的 Layer A readiness 显式暴露出来，供 A/B 两侧共用：

- `canEnterLayerA`：是否可以进入基础胜平负研究
- `canEnterLayerAFull`：是否可以进入完整比分矩阵 / 让球 / 大小球校准
- `layerAProfile`：`blocked` / `lite` / `full`
- `blockReasons`：基础 Layer A 阻断原因
- `fullBlockReasons`：从 lite 升级到 full 的阻断原因

汇总字段：

- `layerAReadyCount`
- `layerAProfileCounts.full`
- `layerAProfileCounts.lite`
- `layerAProfileCounts.blocked`

默认的消费顺序是：

1. `full` 场次优先进入 Layer A-full
2. `lite` 场次只进入基础胜平负研究
3. `blocked` 场次只保留质量信号，不进入主链路
