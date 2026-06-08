# 数据源真实度与替换跟踪

> 目的：记录每类输入是 `real / file / fixture / mock`，是否可用于 research、是否 direct EV eligible，以及 Agent B 快照交付进度。
>
> 更新时间：2026-06-08
>
> Issue：[#4 Agent B：真实数据源获取、快照与 research 模式联调](https://github.com/dachou5224/bet-worldcup2026/issues/4)

## 结论摘要

**Agent B P0 已落地：统一快照目录、raw payload 落盘、research QA 护栏。**

- `fixtures/snapshots/latest/` 为统一回放入口
- raw provider payload 写入 `fixtures/snapshots/latest/raw/`
- 版本化快照写入 `fixtures/snapshots/YYYY-MM-DD/HHmm/`
- `npm run qa:providers` 在 `APP_MODE=research` 下检测 silent fallback
- Polymarket 标记 `sentiment_only=true`、`directEVEligible=false`
- `quality-report` 额外输出 `researchSafeBlockReasons`，便于定位为什么还没进入 research 安全态

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
| 海外 h2h 赔率 | `providers/odds/the-odds-api.js` | `real` | 是（需 API key） | 是 | demo 可回退 mock | 记录 quota headers + bookmaker diversity |
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
5. **The Odds API 配额耗尽时**（`OUT_OF_USAGE_CREDITS`），live 拉取会失败；可写入 `fixtures/snapshots/latest/raw/the-odds-api-h2h.json` 后通过 `real_snapshot_replay` 模式回放，不算 mock fallback。

## 进度看板

| 模块 | 状态 | 备注 |
|---|---|---|
| B-1 football-data | `done` | raw + normalized 落盘 |
| B-2 The Odds API h2h | `blocked_quota` | quota + coverage 报告已实现；当前 key 配额耗尽 |
| B-3 竞彩 file snapshot | `done` | wrapper envelope + schema 校验 |
| B-4 Polymarket sentiment | `done` | raw 落盘 + sentiment 标记 |
| 快照 versioning | `done` | latest + YYYY-MM-DD/HHmm |
| research QA 护栏 | `done` | qa:providers 检测 fallback |

## 相关文档

- 量化主线：[QUANT_IMPLEMENTATION_PLAN.md](./QUANT_IMPLEMENTATION_PLAN.md)
- 算法规格：[QUANT_STRATEGY_SPEC.md](./QUANT_STRATEGY_SPEC.md)
