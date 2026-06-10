# Research 执行计划（Agent A / Agent B）

> 目的：把当前 research pipeline 的缺口拆成可执行项，并明确哪些由 Agent A 继续实现，哪些由 Agent B 负责真实数据源与快照交付。
>
> 对应当前运行时：`/api/data/quality-report`、`/api/data/research-execution-plan`

## 当前状态

- `researchSafeStatus = partial_verified_file`（jingcai=file 时预期，不算 full safe）
- `sourceMode.market = real`（或 Bzzoiro composite）
- `sourceMode.live = real` 或 `real_snapshot_replay`（research 默认开启 live 快照回放）
- `sourceMode.jingcai = file`（fixtureId 已与 odds 对齐）
- `layerAProfileCounts` 仍依赖 Agent A 产出 signalCandidate

结论：B 侧快照契约已就绪；完整 research pipeline 仍待 A 侧 Layer A 与 settlement 对齐。

Agent B 任务入口：`GET /api/data/research-execution-plan` → `agentB.tasks`

## Agent A 负责的事项

Agent A 继续负责算法、流程、契约消费和运行态收口：

1. 保持 `Layer A-lite / Layer A-full` 语义不变，不把 fallback 误判成 full research。
2. 继续把 `quality-report` 作为 A 侧研究启动入口。
3. 默认隐藏金额化建议，仅在 `ENABLE_STAKE_SUGGESTION=true` 时展示。
4. 继续优先消费 B 侧 snapshot，而不是直接依赖未验证 live provider。
5. 需要离线跑 research 时，显式开启 `LIVE_SNAPSHOT_REPLAY_ENABLED=true`，让 A 侧优先消费 `latest/live-data.json`。
6. 保持 `partial_verified_file` 的语义，只允许作为 partial，不允许冒充 full research safe。

## Agent B 负责的事项

Agent B 负责真实数据源、快照落盘和 provider 状态输出：

1. 提供 `fixtures/snapshots/latest/live-data.json`
   - 必须包含 `liveData.liveMatches[]`
   - `sourceMode.live` 应可读
2. 提供 `fixtures/snapshots/latest/provider-status.json`
   - 必须包含 `sourceMode.market/live/jingcai`
   - 必须包含 `fallbackUsed.market/live/jingcai/any`
3. 提供 `fixtures/snapshots/latest/jingcai-official-feed.json`
   - 必须包含 `matches[].fixtureId`
   - 必须支持与 odds `event.id` 对齐
4. 提供 `fixtures/snapshots/latest/raw/the-odds-api-h2h.json`
   - 必须包含 `body[]`
   - 必须包含 `request.markets[]`
   - 必须可被 A 侧回放

## 接口对齐标准

### 1. `live-data.json`

- `capturedAt`
- `sourceMode`
- `liveData.liveMatches[]`
- 兼容 `payload.liveMatches`

### 2. `provider-status.json`

- `sourceMode.market`
- `sourceMode.live`
- `sourceMode.jingcai`
- `fallbackUsed.market`
- `fallbackUsed.live`
- `fallbackUsed.jingcai`
- `fallbackUsed.any`

### 3. `jingcai-official-feed.json`

- `capturedAt`
- `sourceMode`
- `matches[].fixtureId`
- `matches[].availablePlays.spf`
- `matches[].availablePlays.rqspf`
- `manualReviewed` 或 `sourceUrl` / `feedUrl`

### 4. `raw/the-odds-api-h2h.json`

- `body[]` 或 `payload[]`
- `request.markets[]`
- `request.commenceTimeFrom`
- `request.commenceTimeTo`
- `quota`

## A/B 交付标准

- `Layer A-lite`：真实 `h2h` 链路可用即可进入基础胜平负研究。
- `Layer A-full`：必须再有 `closing snapshot` 与 `spread/total`。
- `Jingcai` `file`：仅算 `partial_verified_file`，不算 full research safe。
- `researchSafe=true`：需要 `market=real`、`live=real`、`jingcai=real` 且无 fallback。

## 当前执行优先级

### P0

- Agent B：`jingcai-official-feed.json` 使用 `file` + fixtureId 对齐；live 失败时 research 默认回放 `latest/live-data.json`。
- Agent A：维持 `researchSafeBlockReasons` 与 `layerAReadiness` 的严格边界。

### P1

- Agent B：持续输出可回放 snapshot，保证版本化与 `latest/` 目录同步。
- Agent A：继续消费快照优先的接口，保持 stake suggestion 默认隐藏。

## 最终执行清单

### Agent A

- [x] 维持 `Layer A-lite / Layer A-full / blocked` 语义，不把 fallback 误判成 full research。
- [x] 继续把 `quality-report` 作为 A 侧研究启动入口。
- [x] 默认隐藏金额化建议，仅在 `ENABLE_STAKE_SUGGESTION=true` 时展示。
- [x] 继续优先消费 B 侧 snapshot，而不是直接依赖未验证 live provider。
- [x] 显式支持 `LIVE_SNAPSHOT_REPLAY_ENABLED=true`，让离线 research 优先消费 `latest/live-data.json`。
- [x] 保持 `partial_verified_file` 的语义，只允许作为 partial，不允许冒充 full research safe。
- [ ] 在 `research` 模式下补足更严格的启动检查，若 `market/live/jingcai` 任一项不满足契约，则直接返回 `researchSafeStatus=blocked` 并附带精确 `blockReasons`。
- [ ] 把 `calibrationMode / calibrationConfidence / homeLambda / awayLambda / repriceError` 在推荐快照与质量报告中的展示口径统一。
- [ ] 为 `recommendation snapshot / settlement / backtest artifact` 建立稳定版本化策略，避免单文件覆盖式写入导致历史丢失。

### Agent B

- [x] 提供 `fixtures/snapshots/latest/live-data.json`，并确保可被 A 侧 replay。
- [x] 提供 `fixtures/snapshots/latest/provider-status.json`，并暴露 source / fallback 状态。
- [x] 提供 `fixtures/snapshots/latest/jingcai-official-feed.json`，并与 odds fixtureId 对齐。
- [x] 提供 `fixtures/snapshots/latest/raw/the-odds-api-h2h.json`，并满足 A 侧回放字段需求。
- [ ] 持续生成可验证的真实快照，确保 `latest/` 目录中的文件不是长期静态样本。
- [ ] 为 live / odds / jingcai 三类快照补充时间戳、来源标记、覆盖率摘要，便于 A 侧做 research safety 判断。
- [ ] 保证快照与 raw payload 的版本化同步，避免 `latest/` 与历史版本脱节。

### 接口验收标准

- [x] `live-data.json` 兼容 `capturedAt`、`sourceMode`、`liveData.liveMatches[]`、`payload.liveMatches`。
- [x] `provider-status.json` 兼容 `sourceMode.market/live/jingcai` 与 `fallbackUsed.market/live/jingcai/any`。
- [x] `jingcai-official-feed.json` 兼容 `capturedAt`、`sourceMode`、`matches[].fixtureId`、`matches[].availablePlays.spf/rqspf`。
- [x] `raw/the-odds-api-h2h.json` 兼容 `body[]` / `payload[]`、`request.markets[]`、`request.commenceTimeFrom/To`、`quota`。
- [ ] `researchSafe=true` 仅在 `market=real`、`live=real`、`jingcai=real` 且无 fallback 时成立。
- [ ] `Layer A-lite` 仅要求真实 `h2h` 链路可用；`Layer A-full` 额外要求 `closing snapshot` 与 `spread/total`。
- [ ] `Jingcai` `file` 仅算 `partial_verified_file`，不得被前端或 API 误展示为 full research safe。
- [ ] `research` 模式下若 backtest artifact 缺失，应返回空/警告，而不是 mock 回退。

### 交付顺序建议

1. 先确保 Agent B 的 `latest/` 快照稳定输出并有时间戳。
2. 再让 Agent A 仅消费快照与 artifact，不直接触碰未验证 live provider。
3. 最后统一收紧 `researchSafeStatus`、`Layer A-lite/full` 与推荐快照的展示口径。

## 相关接口

- `GET /api/data/quality-report`
- `GET /api/data/research-execution-plan`
- `GET /api/data/provider-coverage`
- `GET /api/data/recommendation-snapshots`
- `GET /api/data/recommendation-settlements`
