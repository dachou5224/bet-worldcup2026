# 数据源真实度与替换跟踪

> 目的：把**远端 GitHub 仓库状态快照**里哪些输入是 `real`、哪些还是 `mock/fixture`、哪些是 `derived` 记录清楚，并持续跟踪真实数据替换进度。
>
> 更新时间：2026-06-07
>
> 说明：本文件记录的是你提供的远端仓库 review 口径，不等同于后续本地分支可能推进出来的更高版本实现。

## 结论摘要

当前判断是：**量化 Phase 已落地，真实 provider 骨架也已接好，但 mock -> real 还没有完成。**

- **真实优先、允许回退**：赔率/盘口、实时赛况、补充信号
- **始终是样本/fixture**：专家观点、analysis items、modeling steps、赛后复盘、Jingcai 官方盘样本、回测样本
- **算法派生结果**：`marketSnapshots`、`SignalCandidate`、`JingcaiRecommendation`、`layeredOutputs`、`portfolioReview`、`backtestReview`

当前默认运行模式是 `APP_MODE=demo`，所以即便真实 provider 已配置，真实源失败时也会回退到 mock。  
这对演示有用，但对研究验证来说，`research` 模式才是判断真实数据是否接通的准绳。

## 当前配置快照

| 项目 | 当前值 | 影响 |
|---|---|---|
| `APP_MODE` | `demo` | 真实 provider 失败时允许回退到 mock |
| `MARKET_DATA_MODE` | `real` | 市场数据优先尝试真实源 |
| `LIVE_DATA_MODE` | `real` | live 数据优先尝试真实源 |
| `ODDS_API_KEY` | 已配置 | 赔率/盘口真实源可用 |
| `FOOTBALL_DATA_API_KEY` | 已配置 | 实时赛况真实源可用 |
| `BZZOIRO_API_TOKEN` | 已配置 | 补充信号真实源可用 |
| `POLYMARKET_PUBLIC_ENABLED` | `false` | 公开 Polymarket 抓取默认关闭 |
| `SPORTMONKS_API_TOKEN` | 未配置 | Sportmonks 真实源当前不可用 |

## 输入数据清单

### 1. 真实优先的数据源

| 输入项 | 代码入口 | 当前状态 | 说明 | 替换进度 |
|---|---|---|---|---|
| 赔率 / 盘口原始市场数据 | `data-sources.js -> getMarketDataBundle()` | `real` 先尝试，失败回退 `mock` | 由 `The Odds API` + `Polymarket Gamma` 组装 raw market board | **进行中** |
| live matches / 赛况 | `data-sources.js -> getStaticPageData()` | `real` 先尝试，失败回退 `mock` | 主要走 `football-data.org`，必要时再退到备用 live provider | **进行中** |
| 补充信号 | `data-sources.js -> getSupplementalSignals()` | `real` | 走 `Bzzoiro`，未配置则跳过 | **进行中** |

### 2. 仍然是 mock / fixture 的输入

| 输入项 | 代码入口 | 当前状态 | 说明 | 替换进度 |
|---|---|---|---|---|
| 专家观点 | `providers/mock/index.js -> mockExpertOpinions` | `mock` | 固定样本 | **保留 mock** |
| analysis items | `providers/mock/index.js -> mockAnalysisItems` | `mock` | 固定样本 | **保留 mock** |
| modeling steps | `providers/mock/index.js -> mockModelingSteps` | `mock` | 固定样本 | **保留 mock** |
| 赛后复盘样本 | `providers/mock/index.js -> mockPostMatchReview` | `mock` | 固定样本 | **保留 mock** |
| 原始 market board mock | `providers/mock/index.js -> mockMarketBoard` | `mock` | 真实源失败或显式 mock 模式时使用 | **保留 mock / 兜底** |
| Jingcai 官方盘样本 | `providers/jingcai/official-feed.js` | `fixture` / `file` / `real` | 默认仍是 fixture；`real` 需要配置合规授权 URL | **三态已通，继续提高 real 覆盖** |
| 回测样本 | `fixtures/mock-backtest-run.js` | `fixture` | 离线回测样本 | **待扩充真实回测样本** |
| Backtest run artifact | `BACKTEST_RUN_FILE` / `fixtures/snapshots/backtest-run.json` | `live_derived` 优先；无真实赛后条目时保留现有 artifact，不覆盖为 mock | 后端赛后结算与复盘输入 | **进行中** |

### 3. 文件型输入

| 输入项 | 代码入口 | 当前状态 | 说明 | 替换进度 |
|---|---|---|---|---|
| source catalog | `provider-config.js -> SOURCE_CATALOG_FILE` | `file` | 项目内信源目录 | **长期保留** |
| raw fixture market board | `fixtures/raw-market-board.json` | `file/fixture` | 本地 fixture，供测试和 fallback 使用 | **保留 fixture** |

### 4. 算法派生结果

这些不是“输入数据源”，但它们是后续页面和 API 的核心输出，因此也要一起跟踪真实输入的替换情况。

- `marketSnapshots`
- `SignalCandidate`
- `JingcaiRecommendation`
- `recommendationSnapshots`（后端 artifact，接口：`/api/data/recommendation-snapshots`）
- `recommendationSettlements`（后端 artifact，接口：`/api/data/recommendation-settlements`）
- `layeredOutputs`
- `portfolioReview`
- `backtestReview`

## 真实数据替换进度

### A. 已具备真实接入能力

- 赔率/盘口：已接 `The Odds API`
- live：已接 `football-data.org`，并保留备用 live provider
- 补充信号：已接 `Bzzoiro`
- 官方盘 `Jingcai`：已支持 `fixture / file / real` 三态，`npm run qa:providers` 会在 `real` 模式且配置 URL 时额外做一次 URL smoke check

### B. 仍需真实化的内容

- `Jingcai` 官方盘：已支持 `fixture` / `file` / `real` 三态，`real` 需要配置合规授权的官方源 URL
- 回测样本：当前仍是 mock fixture
- 专家观点 / analysis / modeling：当前仍是 mock 数据，适合保留为展示和测试素材
- post-match review：已支持真实 live 赛果 + 赛前预测派生，并输出 finished/matched/live-derived 覆盖率；没有可用已完场对齐数据时回退 artifact/mock
- recommendation settlements：已支持真实 live 赛果 + 官方盘 stop-sale 派生，并输出 liveMatch / officialMatch / officialSettlement 覆盖率，artifact 作为 fallback
- Backtest run：已支持 `live_derived` artifact 优先读取；无真实赛后条目时不覆盖现有样本，避免 mock 反写

### C. 当前模式限制

- `APP_MODE=demo` 下，真实 provider 失败会回退到 mock
- 这意味着“功能可用”不等于“全链路真实数据”
- 研究模式下可通过 fail-fast 更容易识别真实源缺口

## 进度看板

| 模块 | 状态 | 备注 |
|---|---|---|
| 赔率 / 盘口 | `real-ready` | 配置已到位，仍需按 provider 健康状态观察真实命中率 |
| live matches | `real-ready` | 配置已到位，仍需跟踪是否经常回退 mock |
| 补充信号 | `real-ready` | 配置已到位，可继续观察返回完整度 |
| Jingcai 官方盘 | `fixture` / `file` / `real` | 已支持三态；`real` 需要配置官方源 URL，当前仍以 fixture 为默认 |
| 赛后复盘 / post-match review | `live-derived` 优先，artifact/mock fallback | 现在可用真实 live 赛果 + 赛前预测生成，并输出覆盖率；未命中时回退文件或 mock |
| 推荐结算 / recommendation settlements | `live-derived` 优先，artifact/mock fallback | 已接真实 live 赛果 + 官方盘 stop-sale 赔率，并输出 liveMatch / officialMatch / officialSettlement 覆盖率 |
| 回测样本 / backtest run artifact | `live_derived` 优先；无真实条目时保留现有 artifact | 后续可继续扩充真实样本 |
| 专家观点 / analysis / modeling | `mock` | 目前保留为演示和测试素材 |

## 建议的后续跟踪方式

1. 每次接入或替换一个真实 provider，就在本文件对应表格中更新状态。
2. 如果某个输入仍依赖 mock 回退，明确写出回退原因。
3. 若新增真实数据源，优先写 fixture 再接 API，避免把调试流量打到线上 provider。
4. `npm run qa:providers` 会在 `JINGCAI_OFFICIAL_FEED_MODE=real` 且配置 `JINGCAI_OFFICIAL_FEED_URL` 时，额外做一次官方盘 URL smoke check。
5. 对外展示前，先看：
   - `/api/data/quality-report`
   - `/api/data/provider-coverage`
   - `/api/data/portfolio-review`
   - `/api/data/backtest-review`

## 和算法主线的关系

这份 tracker 只关注“输入数据真实度”，不替代量化实施计划。

- 量化主线请看：[QUANT_IMPLEMENTATION_PLAN.md](./QUANT_IMPLEMENTATION_PLAN.md)
- 算法规格请看：[QUANT_STRATEGY_SPEC.md](./QUANT_STRATEGY_SPEC.md)

如果后续要继续推进真实数据替换，优先顺序建议是：

1. 稳定赔率 / 盘口真实源命中率
2. 稳定 live matches 真实源命中率
3. 将 `Jingcai` 官方盘从 `fixture`/`file` 逐步切到 `real`
4. 扩充 post-match review 派生规则和 recommendation settlements 覆盖率
5. 再考虑把更多展示层 mock 逐步收敛

## 远端快照的下一步

基于你给出的远端仓库状态，下一步真正要补的是：

1. provider hardening
2. 将 `Jingcai` 官方盘从 `fixture`/`file` 逐步切到 `real`
3. 提高 `The Odds API` / `football-data.org` 的稳定命中率
4. 继续扩大 post-match review 派生规则和 recommendation settlements 覆盖率
5. 逐步收紧 mock 兜底的覆盖面
