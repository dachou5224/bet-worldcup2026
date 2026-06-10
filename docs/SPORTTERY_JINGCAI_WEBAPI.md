# 竞彩官方盘：体彩 webapi 数据源

> 更新时间：2026-06-09

## 数据源

| 项 | 值 |
|---|---|
| 类型 | 中国体育彩票官网公开 JSON 网关（非 Gemini、非转载站） |
| 基址 | `https://webapi.sporttery.cn` |
| 列表接口 | `GET /gateway/uniform/football/getMatchListV1.qry?clientCode=3001` |
| 页面入口 | https://www.sporttery.cn/jc/jsq/zqspf/ |
| 代码 | `lib/sporttery-webapi.js`、`lib/sporttery-webapi-normalize.js` |
| 快照 raw | `fixtures/snapshots/latest/raw/sporttery-football-match-list.json` |
| 归一化 feed | `fixtures/snapshots/latest/jingcai-official-feed.json` |

## 字段映射

| 体彩 API | 项目 schema | 说明 |
|----------|-------------|------|
| `poolCode=HAD` | `availablePlays.spf` | h→3 主胜, d→1 平, a→0 客胜 |
| `poolCode=HHAD` | `availablePlays.rqspf` | 含 `goalLine` → `handicap` |
| `matchStatus=Selling` | `saleStatus=on_sale` | |
| `matchId` | `sportteryMeta.matchId` | 体彩内部场次 ID |
| `matchNumStr` | `sportteryMeta.matchNumStr` | 如「周四001」 |
| baseline | `fixtureId` / `stopSaleTime` | API 不提供 stopSaleTime，从 baseline 继承 |

## 命令

```bash
# 拉取官方数据 → raw + draft + diff + 更新 latest/jingcai-official-feed.json
npm run fetch:jingcai-webapi

# pipeline 实时读官网（fixtureId 仍与 baseline 对齐）
JINGCAI_OFFICIAL_FEED_MODE=webapi npm run qa:providers

# 离线读已落盘快照（推荐 research 默认）
JINGCAI_OFFICIAL_FEED_MODE=file \
JINGCAI_OFFICIAL_FEED_FILE=fixtures/snapshots/latest/jingcai-official-feed.json \
npm run qa:providers
```

## 环境变量

```env
SPORTTERY_CLIENT_CODE=3001
JINGCAI_WEBAPI_LEAGUE_FILTER=世界杯
JINGCAI_WEBAPI_ALIGN_BASELINE_TEAMS=true
JINGCAI_WEBAPI_WRITE_LATEST=true
JINGCAI_OFFICIAL_FEED_MODE=file   # 或 webapi
```

## 2026-06-09 数据更正

原 `manual_official_snapshot`（人工整理）存在：

- 墨西哥 vs 南非：赔率过期（如 SPF 主胜 1.48 → 官方 1.31）
- 海地 vs 苏格兰、澳大利亚 vs 土耳其：**主客赔率颠倒**

已由 `sporttery_webapi` 覆盖写入 `fixtures/snapshots/latest/jingcai-official-feed.json`，`sourceMode=real`，`manualReviewed=true`。

## 已知限制

1. `stopSaleTime` 不在 list API 中，当前从旧 baseline 继承，后续可补规则或详情接口。
2. 仅覆盖 `JINGCAI_WEBAPI_LEAGUE_FILTER`（默认「世界杯」）且与 baseline 队名对齐的场次。
3. 请勿将 Gemini Search 转载站数据直接写入 `latest/`；Gemini 仅作 semi-auto 草稿（`draft:jingcai-gemini`）。
