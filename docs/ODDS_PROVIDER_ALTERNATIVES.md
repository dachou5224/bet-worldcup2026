# Odds API 备选方案调研

> 更新时间：2026-06-09  
> 背景：The Odds API 当前 key 配额耗尽（`OUT_OF_USAGE_CREDITS`），需要可切换的赔率输入源。

## 当前项目内的三层回退（已实现）

| 优先级 | 源 | 环境变量 | 模式 | direct EV |
|--------|-----|----------|------|-----------|
| 1 | The Odds API | `ODDS_API_KEY` + `ODDS_PROVIDER=auto` | `real` | 是 |
| 2 | Bzzoiro bookmaker 1x2 | `BZZOIRO_API_TOKEN` | `real` / `file_snapshot` | 是 |
| 3 | 本地回放快照 | `fixtures/snapshots/latest/raw/the-odds-api-h2h.json` | `real_snapshot_replay` | 是 |

切换命令：

```bash
# 默认：The Odds API 失败自动切 Bzzoiro
ODDS_PROVIDER=auto

# 强制只用 Bzzoiro（含快照回退）
ODDS_PROVIDER=bzzoiro

# 强制只用 The Odds API
ODDS_PROVIDER=the-odds-api

# 手动刷新回放文件
npm run bootstrap:odds-snapshot
```

## 外部备选 API 对比（2026）

| Provider | 免费额度 | 书商数量 | 世界杯 h2h | 优势 | 劣势 |
|----------|----------|----------|------------|------|------|
| **The Odds API**（当前） | ~500 credits/月 | ~15–40 | 支持 `soccer_fifa_world_cup` | schema 统一、文档成熟 | 配额小；无 Pinnacle 等 sharp book |
| **Bzzoiro**（已接入） | token 制 | 15+/场 | league=27 World Cup | 项目已有 token；含 Pinnacle/Bet365 | 按 event 拉取；live odds 偶发空 |
| **[Odds-API.io](https://odds-api.io/)** | 100 req/h 免费；付费 £99+/月 5000 req/h | 250+（免费仅 2 家） | 足球覆盖广 | 按请求数计费、无 credit 算术；含 Asian sharp | 免费仅 2 bookmaker；schema 不同，需新适配器 |
| **[OddsPapi](https://oddspapi.io/)** | 250 req/月 | 140+/场 | sport_id=10 足球 | 含 Pinnacle/Singbet；免费历史盘 | 免费额度很小 |
| **Sportmonks**（骨架已有） | 付费 trial | 部分 plan 含 odds | 需确认 WC plan | live+odds 一体 | 未配置 token；赔率非主路径 |
| **Polymarket Gamma**（已接入） | 公开 | N/A | sentiment | 无 key；情绪盘 | **不进 direct EV** |

### Odds-API.io 迁移要点（未实现，供评估）

```http
GET https://api.odds-api.io/v3/events?apiKey=KEY&sport=football
GET https://api.odds-api.io/v3/odds?apiKey=KEY&eventId=...
```

- 响应字段与 The Odds API v4 不同，需写 `lib/odds-api-io-normalize.js` 映射到现有 `rawMarketBoard` schema
- 免费层仅 2 家 bookmaker，research 联调够用；生产需 Starter £99/月（5 家 book）
- 可挂到 `composite.js` 作为 The Odds API 与 Bzzoiro 之间的第二 live 层

## 推荐策略

### 短期（现在）

1. **`ODDS_PROVIDER=auto`**：The Odds API → Bzzoiro → 本地 snapshot replay
2. 定期跑 `npm run snapshot:providers` 固化 Bzzoiro 有赔率时的快照
3. 配额恢复后无需改代码，自动回到 The Odds API

### 中期（若 The Odds API 长期不够用）

1. **Odds-API.io**：按小时限流（非 credit），适合作为第二 live 源；免费 100 req/h 可联调，生产需 £99+/月（需新增 `providers/odds/odds-api-io.js`）
2. **Sportmonks**：若同时需要赔率+赛果，可评估 premium odds add-on

### 不建议

- 网页直抓博彩公司（维护成本高、ToS 风险）— 已在 `data-source-catalog.json` 标记为 `deferred`
- 把 Polymarket 当 h2h 赔率源 — 仅 sentiment，不进 EV

## 代码入口

| 模块 | 路径 |
|------|------|
| 复合 odds 适配器 | `providers/odds/composite.js` |
| Bzzoiro odds 适配器 | `providers/odds/bzzoiro-odds.js` |
| 归一化 / wire format 转换 | `lib/bzzoiro-odds-normalize.js` |
| 快照回放 | `lib/snapshot-replay.js` |
| Bootstrap 脚本 | `scripts/bootstrap_odds_snapshot.js` |

## 验收

```bash
APP_MODE=research \
ODDS_PROVIDER=auto \
MARKET_DATA_MODE=real \
LIVE_DATA_MODE=real \
JINGCAI_OFFICIAL_FEED_MODE=file \
JINGCAI_OFFICIAL_FEED_FILE=fixtures/snapshots/latest/jingcai-official-feed.json \
npm run qa:providers
```

期望：`marketMode` 为 `real`（Bzzoiro 直出）或 `real_snapshot_replay`（回放），且 `fallbackUsed.market = false`。
