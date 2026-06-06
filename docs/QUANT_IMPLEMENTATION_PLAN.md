# 量化模块实施计划（Implementation Plan）

> **规格（WHAT）：** [QUANT_STRATEGY_SPEC.md](./QUANT_STRATEGY_SPEC.md)  
> **本文件（HOW）：** 分阶段落地路线、QA 门禁与 pick-up 状态  
> **来源：** 自 Copilot backend agent plan 迁入（`~/.copilot/session-state/.../plan.md`），2026-06-06

---

## Pick-up 状态（接手从这里读）

**当前阶段：** Phase 1 基本完成，Phase 2（MarketSnapshot 标准化）尚未开始

| Phase | 目标 | 状态 | 验证命令 |
|-------|------|------|----------|
| 0 | APP_MODE、research 护栏、snapshot 脚本 | ✅ 已落地 | `npm run qa:research-guardrails` |
| 1 | `quant/` devig / ev / kelly + 单元测试 | ✅ 已落地 | `npm test` |
| 2 | `MarketSnapshot` 标准化 | ⬜ **下一步** | （待建）`tests/market-snapshot.test.js` |
| 3 | score-matrix + pricing + jingcai-rqspf | ⬜ | — |
| 4 | decision-layer → `SignalCandidate` | ⬜ | — |
| 5 | Jingcai 收敛 Layer B/C | ⬜ | — |
| 6 | API Layer A/B/C 输出 | ⬜ | — |
| 7 | portfolio / backtest | ⬜ 在 MVP 之后 | — |

**Phase 2 首批任务（可直接开工）：**

1. 新建 `quant/normalization/market-snapshot.js`（或 `schemas/market-snapshot.js`）— 对齐 spec §2.2 字段
2. 从 `fixtures/raw-market-board.json` / provider 输出写 normalizer，产出 `h2h` / `spread` / `total` 快照流
3. 扩展 `data-hub.js` 质量报告：bookmaker 多样性、必备盘口、快照是否可用于 Layer A
4. 添加 fixture 驱动测试，**零 API 调用**

**本地验证（接手后先跑）：**

```bash
npm test
npm run qa:research-guardrails
npm run snapshot:providers   # 可选；需 API key 时才跑
```

**已落地的 Phase 0/1 文件：**

- `lib/app-mode.js`
- `quant/odds/devig.js`, `quant/edge/ev.js`, `quant/portfolio/kelly.js`
- `tests/quant-*.test.js`, `tests/app-mode.test.js`
- `scripts/qa_research_guardrails.js`, `scripts/refresh_provider_snapshots.js`
- `fixtures/snapshots/.gitkeep`

**当前真实进度判断：**

- Phase 0 和 Phase 1 已经在代码树中落地，可通过现有 `npm test` 与 `npm run qa:research-guardrails` 验证
- Phase 2 仍然是第一个明确的未实现大项：`MarketSnapshot` 标准化、统一 snapshot 流、相关测试都还没有进入代码树
- 现有 dashboard 仍主要依赖 `market-pipeline.js` 的启发式聚合输出，不是文档里定义的 `SignalCandidate` / `JingcaiRecommendation` 主链路

**实现约定（与 spec 对齐）：**

- 概率收缩参数在 spec 中为 `alpha`；现有 `shrinkProbability(..., lambda)` 在 Phase 4 前可保留，decision-layer 对外统一 `alpha`
- 模块先放顶层 `quant/`，**暂不**整体迁 `src/`（见文末 Trade-offs）
- Layer C `JingcaiRecommendation` 为默认用户卡片；海外 `SignalCandidate` 作可展开上下文

---

## Problem

Current provider, schema, cache, and dashboard layers are strong enough for a World Cup market dashboard, but the quantitative core is still embedded in `market-pipeline.js` as presentation-oriented heuristics. The tagged spec changes the target from a generic overseas market dashboard into a **three-layer system**:

- **Layer A**: overseas research outputs (`SignalCandidate`, market/model summaries)
- **Layer B**: play mapping + official re-pricing
- **Layer C**: `JingcaiRecommendation` as the default user-facing output

So the next milestone is not only extracting a deterministic quant core, but doing it in a way that reaches the spec's MVP loop:

```text
Overseas snapshots -> P_market / P_model / P_adj -> SignalCandidate
-> PlayMapping -> Official Odds Re-pricing -> Jingcai Gates
-> JingcaiRecommendation -> Jingcai settlement review
```

## Planning Principles

- Keep the current dashboard/provider stack running while introducing the quant core behind stable interfaces.
- Prefer cache-first and fixture-first development. Real APIs should only be hit when validating a completed slice.
- Every phase ends with a QA gate. If real provider data is unavailable or quota-limited, use dummy/fixture snapshots to prove the flow first.
- Separate demo-safe behavior from research-safe behavior. Dashboard fallback to mock is fine for demo mode, but not for research mode.
- LLM stays in the explanation layer only. Deterministic probability and portfolio decisions live in quant modules.
- Follow the spec's **Layer A / B / C** contract explicitly. Do not stop at overseas EV if the implementation phase is supposed to reach Jingcai mapping or official repricing.
- The first production-grade user-facing card should become `JingcaiRecommendation`; overseas research stays available as expandable context.

## Chosen Implementation Strategy

Start by introducing a top-level `quant/` area in the current structure, keep current routes/providers intact, and progressively route dashboard outputs through the new modules. After the quant interfaces and research outputs stabilize, migrate the tree to `src/` in a separate phase.

The spec's recommended modules (`devig`, `score-matrix`, `pricing/*`, `decision-layer`, `play-mapping`, `jingcai-gates`, `jingcai-settlement`, `official-feed`) should be mirrored in the current tree now, even if the eventual file move to `src/` happens later.

## Phase-by-Phase Plan

### Phase 0 — Stabilize the development loop and research boundaries

Goal: make further work quota-safe and prevent accidental mixing of mock/demo logic into research outputs.

Work:

- Add `APP_MODE=demo|research` config.
- In `demo`, keep current fallback-to-mock behavior.
- In `research`, provider failure must error instead of silently substituting mock.
- Add a small cache/fixture policy doc in code comments/config defaults:
  - provider JSON cache is the default read path for repeated runs
  - dummy fixtures are the default test input for quant modules
- Add one script for fixture refresh or fixture generation so future QA does not require repeated API access.

QA gate:

- `qa:providers` still passes in demo mode.
- A research-mode smoke check fails fast when a required real provider is unavailable.
- Repeated runs do not create unnecessary provider traffic because cache files are reused.

### Phase 1 — Introduce the quant foundation modules

Goal: move core math out of `market-pipeline.js` into deterministic modules with tests.

Work:

- Create `quant/odds/devig.js`
  - `decimalOddsToRawProbabilities(outcomes)`
  - `proportionalDevig(outcomes)`
  - `margin(outcomes)`
  - `fairOdds(outcomes)`
- Create `quant/edge/ev.js`
  - `expectedValue(decimalOdds, modelProbability)`
  - `edge(modelProbability, marketProbability)`
  - `relativeEdge(modelProbability, marketProbability)`
  - `shrinkProbability(modelProbability, marketProbability, lambda)`
- Create `quant/portfolio/kelly.js`
  - `fullKelly`
  - `fractionalKelly`
  - `capStake`
- Add deterministic `node:test` coverage for all pure functions.
- Keep all tests fixture/dummy-driven so no API calls are needed.

QA gate:

- Unit tests for devig/EV/Kelly all pass.
- Existing dashboard/provider flow remains unchanged.
- No real provider call is required to validate this phase.

### Phase 2 — Standardize market snapshots

Goal: create a single normalized market snapshot format that all pricing logic can consume.

Work:

- Define a canonical `MarketSnapshot` structure that matches the spec input schema:
  - `snapshotId`
  - `fixtureId`
  - `provider`
  - `bookmaker`
  - `capturedAt`
  - `marketType`
  - `line`
  - `period`
  - `outcomes[]`
  - `sourceMeta { region, rawEventId, rawMarketId, liquidity, volume }`
- Scope the first normalized market types to:
  - `h2h`
  - `spread`
  - `total`
  - keep placeholders/typing for future `correct_score`, `half_full_time`, `qualification`, `outright`
- Add normalization helpers under `data/normalization/` or `quant/normalization/`.
- Refactor provider outputs into a unified snapshot stream without removing the current raw structures yet.
- Add stable fixture IDs / resolver support so cross-provider matching is not only string-based.
- Extend schema validation to cover the normalized snapshot surface and the spec's `period + line + marketType` grouping rules.
- Carry prediction-market semantics separately so low-liquidity or non-90-minute markets can be excluded from direct EV use.

QA gate:

- Fixture-based tests prove one match can normalize into consistent `h2h`, `spread`, and `total` snapshots.
- Data quality report adds research-relevant checks such as bookmaker diversity, required market presence, and whether snapshots are safe for Layer A research.
- Real API calls are optional; fixture snapshots are enough to validate structure.

### Phase 3 — Build score-matrix pricing

Goal: price markets from a common state distribution instead of hand-tuned display formulas.

Work:

- Create pricing modules that align to the spec's recommended split:
  - `quant/pricing/h2h.js`
  - `quant/pricing/spread.js`
  - `quant/pricing/total.js`
  - optional shared `quant/pricing/markets.js` wrapper
- Implement:
  - `priceH2H(scoreMatrix)`
  - `priceSpread(scoreMatrix, line)`
  - `priceTotal(scoreMatrix, line)`
  - `priceCorrectScore(scoreMatrix, homeGoals, awayGoals)`
- Add first-round Jingcai projection helpers required by the spec MVP:
  - `quant/pricing/jingcai-rqspf.js`
  - leave `jingcai-zjq.js` as Phase 5 / P1 unless trivial to derive once totals are stable
- Create a first score-matrix implementation:
  - `quant/models/score-matrix.js`
  - `quant/models/poisson.js`
- Keep the first model intentionally simple and deterministic; the spec calls for a simple double-Poisson / simple Dixon-Coles-upgradeable baseline.
- Feed it with dummy expected-goal inputs first.

QA gate:

- Deterministic tests confirm pricing functions produce probabilities summing correctly and matching simple known cases.
- Dummy score matrices can fully drive pricing without real provider access.
- A fixture-backed end-to-end smoke test prices overseas `h2h/spread/total` and can also project one official Jingcai handicap case from the same matrix.

### Phase 4 — Decision layer and Layer A research outputs

Goal: convert normalized market/model inputs into `SignalCandidate` objects using the spec's decision gates and recommendation levels.

Work:

- Create `quant/models/market-baseline.js`.
- Use normalized market snapshots to derive:
  - devigged market probabilities
  - bookmaker consensus
  - basic disagreement metrics
- Create `quant/recommendation/decision-layer.js`.
- Implement the six overseas gates from the spec:
  - bad data
  - unmapped play
  - no adjusted edge
  - EV below threshold
  - negative/small Kelly
  - risk cap
- Output `SignalCandidate` with:
  - `marketProbability`
  - `modelProbability`
  - `adjustedProbability`
  - `edge`
  - `relativeEdge`
  - `expectedValue`
  - `rawKelly`
  - `fractionalKelly`
  - `cappedStakeFraction`
  - `decisionCode`
  - `recommendationLevel`
  - `recommendationText`
- Replace the arithmetic heuristics in `market-pipeline.js` with calls into quant modules, but keep a thin adapter so the current dashboard does not break immediately.

QA gate:

- Existing dashboard endpoints still return valid payloads.
- Fixture tests prove that `SignalCandidate` generation follows the spec's gate ordering and level mapping (`NO_ACTION`, `WATCH`, `CANDIDATE`, `SMALL_POSITION`).
- Comparison tests show the new quant baseline produces sensible output on cached real data and dummy fixtures.
- Real provider QA is run only once after the fixture-backed flow passes.

### Phase 5 — Jingcai convergence (Layer B / Layer C MVP)

Goal: implement the spec's MVP loop from overseas research signals to compliant single-match Jingcai recommendations.

Work:

- Add `providers/jingcai/official-feed.js` as a read-only `JingcaiOfficialFeed` adapter or fixture-backed stub if real official data is not yet available.
- Create:
  - `quant/recommendation/play-mapping.js`
  - `quant/recommendation/jingcai-gates.js`
  - `quant/output/jingcai-recommendation.js`
- Implement the seven-step convergence chain from the spec:
  - overseas signal
  - in-schedule check
  - play mapping
  - official odds repricing
  - Jingcai gates
  - recommendation text
  - `noJingcaiReason`
- Scope MVP output exactly as the spec recommends:
  - P0: `胜平负`, `让球胜平负`
  - P1/P2: `总进球数`, `比分`, `半全场` remain Layer A or secondary output only
  - no parlays in MVP
- Make Layer C the default frontend/display output, with Layer A overseas research shown as explainable context.

QA gate:

- Dummy `JingcaiOfficialFeed` fixtures can drive end-to-end `SignalCandidate -> JingcaiRecommendation`.
- Mapping failures degrade cleanly to `WATCH`/`null` with explicit `noJingcaiReason`.
- Official odds repricing is tested separately from overseas EV.
- No hidden fallback-to-mock in research mode.

### Phase 6 — Output contracts and research-quality reporting

Goal: align API/dashboard outputs to the spec's Layer A / B / C model and add research-grade quality controls.

Work:

- Expose structured Layer A / B / Layer C outputs:
  - Layer A: overseas research (`marketSummary`, `SignalCandidate`)
  - Layer B: mapping + official repricing
  - Layer C: `JingcaiRecommendation`
- Extend `data-hub.js` with research quality metadata required by the spec:
  - has timestamped snapshots
  - has closing or pre-close snapshots
  - has settlement result
  - has spread line
  - has total line
  - stale odds
  - provider conflict level
  - mapping confidence
  - official schedule availability
- Add `text-summary` generation that follows the spec's 4-sentence overseas template plus 5th Jingcai convergence sentence when Layer C exists.

QA gate:

- API payload snapshot tests pass for Layer A/B/C.
- Frontend adapter still renders stable cards.
- Layer C is the default main card payload when available.

### Phase 7 — Portfolio and backtest foundation

Goal: move from single-signal recommendation into constrained portfolio logic and Jingcai-aware review metrics.

Work:

- Add portfolio aggregation and exposure tagging:
  - by match
  - by factor (favorite bias, low-total bias, upset exposure, knockout draw exposure)
  - by day risk budget
- Use `fractionalKelly + caps` as the first implementation.
- Add:
  - `quant/portfolio/exposure.js`
  - `quant/backtest/settlement.js`
  - `quant/backtest/jingcai-settlement.js`
  - `quant/backtest/metrics.js`
- Include spec-required review fields:
  - CLV
  - Brier
  - LogLoss
  - `officialReturn`
  - `jingcaiSettlement`
- Keep MVP execution single-match / single-bet; parlay remains explicitly deferred.

QA gate:

- Deterministic tests for caps, exposure aggregation, and negative-EV filtering.
- Offline dummy backtest runs end-to-end.
- Settlement logic is covered by tests, including Jingcai-specific settlement.
- No live API access is needed for backtest QA.

## API-Quota-Safe QA Strategy

- Pure math modules: test only with `node:test`.
- Provider normalization: test with checked-in dummy fixtures first.
- Provider integration: run targeted smoke checks only after fixture tests pass.
- Reuse `fixtures/cache/` as the default replay source during local development.
- Only refresh provider caches intentionally, not on every QA run.
- `JingcaiOfficialFeed` should start fixture-backed. Do not block Layer B/C development on a live official feed.
- When official data is absent, run Layer B/C with dummy official fixtures that cover:
  - listed vs not listed
  - on sale vs stopped
  - matching vs mismatched handicap
  - positive vs negative `EV_official`

## Suggested Execution Order for the First Implementation Wave

1. Phase 0 (`APP_MODE`, research guardrails, fixture/caching workflow)
2. Phase 1 (devig + EV + Kelly)
3. Phase 2 (MarketSnapshot normalization)
4. Phase 3 (score-matrix pricing)
5. Phase 4 (SignalCandidate decision layer)
6. Phase 5 (Jingcai convergence MVP)
7. Phase 6 (Layered outputs)

This matches the spec's MVP target: **overseas research -> official repricing -> Jingcai single-match recommendation** before portfolio/backtest work expands.

## Key Files Likely to Change

- `provider-config.js`
- `data-sources.js`
- `market-pipeline.js`
- `data-hub.js`
- `services/api-service.js`
- new `quant/` modules
- new tests using `node:test`
- new dummy fixtures for quant/pricing scenarios
- new `providers/jingcai/official-feed.js`
- dashboard adapters so the main card can pivot from heuristic summary to `JingcaiRecommendation`

## Important Trade-offs

- **Chosen:** keep the current top-level layout for the first quant wave and add `quant/` surgically.
- **Defer:** full `src/` tree migration until quant interfaces and research outputs stabilize.
- **Reason:** this lowers risk, preserves the working dashboard, and avoids mixing file-move churn with math/model changes.
