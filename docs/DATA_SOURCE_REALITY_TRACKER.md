# 数据源真实度与替换跟踪

> 目的：把当前项目里哪些输入是 `real`、哪些还是 `mock/fixture`、哪些是 `derived` 记录清楚，并持续跟踪真实数据替换进度。
>
> 更新时间：2026-06-07

## 结论摘要

当前算法链路已经跑通，但输入侧并不是全真实数据驱动。

- **真实优先、允许回退**：赔率/盘口、实时赛况、补充信号
- **始终是样本/fixture**：专家观点、analysis items、modeling steps、赛后复盘、Jingcai 官方盘样本、回测样本
- **算法派生结果**：`marketSnapshots`、`SignalCandidate`、`JingcaiRecommendation`、`layeredOutputs`、`portfolioReview`、`backtestReview`

当前默认运行模式是 `APP_MODE=demo`，所以即便真实 provider 已配置，真实源失败时也会回退到 mock。

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
| Jingcai 官方盘样本 | `providers/jingcai/official-feed.js` | `fixture-backed` | 当前不是实时官方接口 | **待替换为真实 feed** |
| 回测样本 | `fixtures/mock-backtest-run.js` | `fixture` | 离线回测样本 | **待扩充真实回测样本** |

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
- `layeredOutputs`
- `portfolioReview`
- `backtestReview`

## 真实数据替换进度

### A. 已具备真实接入能力

- 赔率/盘口：已接 `The Odds API`
- live：已接 `football-data.org`，并保留备用 live provider
- 补充信号：已接 `Bzzoiro`

### B. 仍需真实化的内容

- `Jingcai` 官方盘：当前仍是 fixture-backed 样本
- 回测样本：当前仍是 mock fixture
- 专家观点/analysis/modeling/post-match review：当前仍是 mock 数据，适合保留为展示与测试样本

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
| Jingcai 官方盘 | `fixture` | 后续需要真实 feed 或稳定适配器 |
| 回测样本 | `fixture` | 后续需要更多真实赛后样本 |
| 专家观点 / analysis / modeling | `mock` | 目前保留为演示和测试素材 |

## 建议的后续跟踪方式

1. 每次接入或替换一个真实 provider，就在本文件对应表格中更新状态。
2. 如果某个输入仍依赖 mock 回退，明确写出回退原因。
3. 若新增真实数据源，优先写 fixture 再接 API，避免把调试流量打到线上 provider。
4. 对外展示前，先看：
   - `/api/data/quality-report`
   - `/api/data/provider-coverage`
   - `/api/data/portfolio-review`
   - `/api/data/backtest-review`

## 和算法主线的关系

这份 tracker 只关注“输入数据真实度”，不替代量化实施计划。

- 量化主线请看：[QUANT_IMPLEMENTATION_PLAN.md](./QUANT_IMPLEMENTATION_PLAN.md)
- 算法规格请看：[QUANT_STRATEGY_SPEC.md](./QUANT_STRATEGY_SPEC.md)

如果后续要继续推进真实数据替换，优先顺序建议是：

1. 稳定赔率/盘口真实源命中率
2. 稳定 live matches 真实源命中率
3. 用稳定官方接口替换 Jingcai fixture
4. 扩充回测样本和赛后样本
5. 再考虑把更多展示层 mock 逐步收敛
