# 数据源真实度与替换跟踪

> 目的：记录每类输入是 `real / file / fixture / mock`，是否可用于 research、是否 direct EV eligible，以及 Agent B 快照交付进度。
>
> 更新时间：2026-06-09
>
> Issue：[#4 Agent B：真实数据源获取、快照与 research 模式联调](https://github.com/dachou5224/bet-worldcup2026/issues/4)

## 结论摘要

**Agent B P0 已落地：统一快照目录、raw payload 落盘、research QA 护栏。**

- `fixtures/snapshots/latest/` 为统一回放入口
- raw provider payload 写入 `fixtures/snapshots/latest/raw/`
- 版本化快照写入 `fixtures/snapshots/YYYY-MM-DD/HHmm/`
- `npm run qa:providers` 在 `APP_MODE=research` 下检测 silent fallback
- Polymarket 标记 `sentiment_only=true`、`directEVEligible=false`
- `quality-report` 额外输出 `researchSafeStatus` 和 `researchSafeBlockReasons`，便于定位为什么还没进入 research 安全态

## 快照目录结构

```text
fixtures/snapshots/latest/
├── live-data.json
├── provider-status.json
├── market-snapshots.json
├── jingcai-official-feed.json
├── prediction-pipeline.json
├── recommendation-snapshots.json
├── recommendation-settlements.json
└── raw/
    ├── football-data-matches.json
    ├── the-odds-api-h2h.json
    └── polymarket-worldcup.json   # 仅 POLYMARKET_PUBLIC_ENABLED=true 时生成

fixtures/snapshots/YYYY-MM-DD/HHmm/   # 每次 snapshot:providers 的版本副本
```

每个 raw / normalized 快照包含：

```json
{
  "capturedAt": "...",
  "source": "...",
  "sourceMode": "real | file | fixture | mock",
  "rawPayloadHash": "...",
  "parserVersion": "2026.06.08-agent-b"
}
```

## Provider 真实度矩阵

| 输入项 | 代码入口 | sourceMode | research 可用 | direct EV | fallback | 覆盖率 / 备注 |
|---|---|---|---|---|---|---|
| 赛程 / 比分 | `providers/live/football-data.js` | `real` | 是（需 API key） | N/A | demo 可回退 mock | WC 窗口 2026-06-11 ~ 2026-07-19 |
| 海外 h2h 赔率 | `providers/odds/composite.js` | `real` / `real_snapshot_replay` | 是 | 是 | demo 可回退 mock | `ODDS_PROVIDER=auto`：The Odds API → Bzzoiro → snapshot；详见 [ODDS_PROVIDER_ALTERNATIVES.md](./ODDS_PROVIDER_ALTERNATIVES.md) |
| 竞彩官方盘 | `providers/jingcai/official-feed.js` | `file` / `fixture` / `real` | file/fixture 可用 | 是（stop-sale 赔率） | 无 silent fallback | spf + rqspf，`latest/jingcai-official-feed.json` |
| Polymarket | `providers/polymarket/gamma.js` | `real`（默认关闭） | 是（sentiment only） | **否** | 跳过 | `sentiment_only=true` |
| 补充信号 Bzzoiro | `providers/context/bzzoiro.js` | `real` | 是 | N/A | 跳过 | 可选 |
| 专家观点 / analysis | `providers/mock/` | `mock` | 展示用 | N/A | 始终 mock | 保留 |

## 环境变量（research 最小闭环）

```bash
APP_MODE=research
MARKET_DATA_MODE=real
LIVE_DATA_MODE=real
ODDS_MARKETS=h2h
JINGCAI_OFFICIAL_FEED_MODE=file
JINGCAI_OFFICIAL_FEED_FILE=fixtures/snapshots/latest/jingcai-official-feed.json
```

## 验收命令

```bash
npm run bootstrap:odds-snapshot   # Odds API 配额耗尽时，从 Bzzoiro 真实 bookmaker 1x2 生成回放文件

APP_MODE=research \
MARKET_DATA_MODE=real \
LIVE_DATA_MODE=real \
JINGCAI_OFFICIAL_FEED_MODE=file \
JINGCAI_OFFICIAL_FEED_FILE=fixtures/snapshots/latest/jingcai-official-feed.json \
npm run qa:providers

APP_MODE=research \
MARKET_DATA_MODE=real \
LIVE_DATA_MODE=real \
JINGCAI_OFFICIAL_FEED_MODE=file \
JINGCAI_OFFICIAL_FEED_FILE=fixtures/snapshots/latest/jingcai-official-feed.json \
npm run snapshot:providers
```

期望 quality-report 指标：

- `market = real`（非 fallback）
- `live = real`
- `jingcai = file`
- `fallbackUsed.market = false`
- `fallbackUsed.live = false`
- `marketSnapshotSummary.marketTypeCounts.h2h > 0`
- `recommendationSnapshotCount > 0`

## 已知限制

1. 竞彩官方盘当前为 **人工整理 file snapshot**，非实时 API。
2. Polymarket 仅 sentiment，不进 direct EV；默认 `POLYMARKET_PUBLIC_ENABLED=false`。
3. `fixtures/snapshots/*.json`（扁平旧路径）仍保留兼容，新写入同时镜像到 `latest/`。
4. football-data 免费 tier 有 rate limit；快照脚本会分窗请求并尊重 Wait 头。
5. **The Odds API 配额耗尽时**，运行 `npm run bootstrap:odds-snapshot` 从 Bzzoiro cache 生成 `fixtures/snapshots/latest/raw/the-odds-api-h2h.json`，再走 `real_snapshot_replay` 回放，不算 mock fallback。
6. 如需离线跑 research，research 模式下默认开启 live 快照回放（可用 `LIVE_SNAPSHOT_REPLAY_ENABLED=false` 关闭）；A 侧消费 `fixtures/snapshots/latest/live-data.json`。

## 进度看板

| 模块 | 状态 | 备注 |
|---|---|---|
| B-1 football-data | `done` | raw + normalized 落盘；live 失败时可回放 `latest/raw/football-data-matches.json` |
| B-2 The Odds API h2h | `file_replay` | live 配额耗尽时 bootstrap + `real_snapshot_replay`（5 场 / 15 家 bookmaker） |
| B-3 竞彩 file snapshot | `done` | wrapper envelope + schema 校验 |
| B-4 Polymarket sentiment | `partial` | raw 占位落盘（`sourceMode=unavailable`）；Gamma API 当前网络超时 |
| A/B 接口契约 | `done` | `lib/snapshot-ab-contract.js` + qa 校验；竞彩 fixtureId 与 odds 对齐 |
| 快照 versioning | `done` | latest + YYYY-MM-DD/HHmm |
| research QA 护栏 | `done` | qa:providers 检测 fallback |

## 当前 A/B 接口约定

协作 issue：[#5 Agent A/B 协作接口](https://github.com/dachou5224/bet-worldcup2026/issues/5)

Agent B 快照契约实现于 `lib/snapshot-ab-contract.js`，`npm run qa:providers` 会校验：

| 文件 | Agent A 消费字段 | Agent B 兼容字段 |
|------|------------------|------------------|
| `live-data.json` | `liveData.liveMatches[]` | 保留 `payload.liveMatches` |
| `raw/the-odds-api-h2h.json` | `body[]`, `request`, `quota` | 保留 `payload` |
| `provider-status.json` | `sourceMode`, `fallbackUsed` | 嵌套 `providerStatus` 详情 |
| `jingcai-official-feed.json` | `matches[].fixtureId` | 与 odds `event.id` 对齐（8287 等） |

Agent A 侧待消费（不由 B 修改）：

- `layerAReadiness.*` / `researchSafeBlockReasons` — 见 `data-hub.js`
- `recommendationSnapshotCount > 0` — 需 A 侧 signalCandidate 产出
- `officialMatchAlignedCount` — 竞彩 fixtureId 对齐后由 A 侧映射提升

- `Layer A-lite` 只要求真实 `h2h` 赔率链路可用，用于基础胜平负研究。
- `Layer A-full` 额外要求 `closing snapshot` 与 `spread/total`，用于完整比分矩阵和让球/大小球校准。
- `Jingcai` `file` 模式只能算 `partial_verified_file`，不应当被标成 `researchSafe=true`。
- `ENABLE_STAKE_SUGGESTION=false` 是默认值，只有显式开启时才展示金额化建议。

### Layer A readiness contract

`/api/data/quality-report` 需要同时暴露单场与汇总两层口径，供 Agent A 直接消费：

- 单场字段：
  - `layerAReadiness.canEnterLayerA`
  - `layerAReadiness.canEnterLayerAFull`
  - `layerAReadiness.layerAProfile`
  - `layerAReadiness.blockReasons`
  - `layerAReadiness.fullBlockReasons`
- 汇总字段：
  - `layerAReadyCount`
  - `layerAProfileCounts.full`
  - `layerAProfileCounts.lite`
  - `layerAProfileCounts.blocked`

解释口径：

- `full`：可进入完整比分矩阵、让球和大小球校准
- `lite`：仅适合基础胜平负研究
- `blocked`：只保留质量信号，不进入主研究链路

## 相关文档

- 量化主线：[QUANT_IMPLEMENTATION_PLAN.md](./QUANT_IMPLEMENTATION_PLAN.md)
- 算法规格：[QUANT_STRATEGY_SPEC.md](./QUANT_STRATEGY_SPEC.md)
- A/B 启动执行计划：[RESEARCH_EXECUTION_PLAN.md](./RESEARCH_EXECUTION_PLAN.md)
