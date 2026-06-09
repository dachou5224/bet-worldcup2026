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

## 相关接口

- `GET /api/data/quality-report`
- `GET /api/data/research-execution-plan`
- `GET /api/data/provider-coverage`
- `GET /api/data/recommendation-snapshots`
- `GET /api/data/recommendation-settlements`
