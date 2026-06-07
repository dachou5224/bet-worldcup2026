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

如需做完整本地 QA，可运行：

```bash
npm test
npm run qa:research-guardrails
npm run qa:frontend
```

其中 `qa:frontend` 需要本地已有 `npm run dev` 服务在 `http://127.0.0.1:3000` 提供页面与 API；如需覆盖地址，可设置 `FRONTEND_QA_BASE_URL`。

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

它会把当前 provider 状态、pipeline、live 数据和 supplemental signals 落到 `fixtures/snapshots/`，后续做 quant/QA 时可以优先用这些本地快照而不是重复请求外部 API。

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

## 量化模块文档

| 文档 | 用途 |
|------|------|
| [docs/QUANT_STRATEGY_SPEC.md](docs/QUANT_STRATEGY_SPEC.md) | 算法、体彩收敛、输出契约（WHAT） |
| [docs/QUANT_IMPLEMENTATION_PLAN.md](docs/QUANT_IMPLEMENTATION_PLAN.md) | 分阶段实施、QA 门禁、**pick-up 状态**（HOW） |
| [docs/DATA_SOURCE_REALITY_TRACKER.md](docs/DATA_SOURCE_REALITY_TRACKER.md) | 输入数据真实度、mock/fixture 替换进度（REALITY） |

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

**量化 / 体彩建议主线**（优先）：见 [docs/QUANT_IMPLEMENTATION_PLAN.md](docs/QUANT_IMPLEMENTATION_PLAN.md) — 当前实施计划已完成；现有实现覆盖 Phase 0/1/2/3/4/5/6/7 的基础数学、研究护栏、市场快照标准化、基础 pricing、决策层、Jingcai 收敛输出、Layer A/B/C 契约与 portfolio/backtest foundation。

**Dashboard / Provider 维护**（并行）：

1. 接入真实赛程/比分 API，把 `liveMatches` 替换成实时数据。
2. 如果要开始接接口，建议优先抽成这 4 个 endpoint：
   - `/api/live-matches`
   - `/api/tomorrow-predictions`
   - `/api/market-sources`
   - `/api/post-match-review`
3. 接真实 provider 时，优先先看 `/api/data/quality-report` 和 `/api/data/provider-coverage`。
4. 新接入的市场数据先通过 `schemas/market-board.js` 校验，再进入聚合层。
5. 真实 provider 联调：`npm run qa:providers`（需 key）；本地重复开发用 `npm run snapshot:providers` 写 `fixtures/snapshots/`。
