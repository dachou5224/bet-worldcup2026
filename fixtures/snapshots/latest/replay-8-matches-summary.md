# Replay 8 场审计摘要
- 生成时间：2026-06-10T07:16:19.641Z
- replay 模式：local
- riskProfile：strict
- researchSafeStatus：partial_verified_file
- sourceMode：market=real_snapshot_replay, live=real_snapshot_replay, jingcai=file
- 行数：8
- expressionLevel 分布：{"OBSERVE_ONLY":8}
- WATCH 子类型分布：{"watch_negative_ev":3,"watch_negative_ev|watch_gs_divergence":4,"watch_negative_ev|watch_market_baseline_only":1}
- GS 一致性分布：{"aligned":4,"divergent":4}
## 结论
- 当前 8 场在 strict profile 下均未进入正式可执行建议，但已可在 balanced/aggressive profile 下输出探索型表达。
- 其中 `prediction_market_missing` 仍是主要风险标签之一，说明该组样本主要由 bookmaker baseline 与盘口校准模型驱动。
- GS 先验采用 modal forecast one-hot 形式，仅用于方向对照，不替代单场概率模型。
## 行级明细
| 比赛 | 关注方向 | expressionLevel | WATCH子类型 | GS一致性 | 主胜edge_pp | 平局edge_pp | 客胜edge_pp | 关注方向EV | watch说明 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 墨西哥 vs 南非 | away | OBSERVE_ONLY | watch_negative_ev | aligned | -0.20 | 0.11 | 0.09 | -3.66 | 盘口拆解：主胜-0.20个百分点，平局+0.11个百分点，客胜+0.09个百分点。 三项边际都不到 0.5 个百分点，说明模型与市场几乎一致，适合继续观察，不宜直接下单。 |
| 韩国 vs 捷克 | away | OBSERVE_ONLY | watch_negative_ev\|watch_gs_divergence | divergent | 0.02 | -0.09 | 0.07 | -3.96 | 盘口拆解：主胜+0.02个百分点，平局-0.09个百分点，客胜+0.07个百分点。 三项边际都不到 0.5 个百分点，说明模型与市场几乎一致，适合继续观察，不宜直接下单。 |
| 加拿大 vs 波黑 | home | OBSERVE_ONLY | watch_negative_ev\|watch_market_baseline_only | aligned | 0.13 | -0.07 | -0.06 | -4.44 | 盘口拆解：主胜+0.13个百分点，平局-0.07个百分点，客胜-0.06个百分点。 三项边际都不到 0.5 个百分点，说明模型与市场几乎一致，适合继续观察，不宜直接下单。 |
| 美国 vs 巴拉圭 | draw | OBSERVE_ONLY | watch_negative_ev\|watch_gs_divergence | divergent | -0.25 | 0.18 | 0.08 | -4.43 | 盘口拆解：主胜-0.25个百分点，平局+0.18个百分点，客胜+0.08个百分点。 三项边际都不到 0.5 个百分点，说明模型与市场几乎一致，适合继续观察，不宜直接下单。 |
| 卡塔尔 vs 瑞士 | home | OBSERVE_ONLY | watch_negative_ev | aligned | 0.02 | -0.02 | -0.00 | -2.82 | 盘口拆解：主胜+0.02个百分点，平局-0.02个百分点，客胜-0.00个百分点。 三项边际都不到 0.5 个百分点，说明模型与市场几乎一致，适合继续观察，不宜直接下单。 |
| 巴西 vs 摩洛哥 | away | OBSERVE_ONLY | watch_negative_ev | aligned | -0.43 | 0.22 | 0.21 | -3.79 | 盘口拆解：主胜-0.43个百分点，平局+0.22个百分点，客胜+0.21个百分点。 三项边际都不到 0.5 个百分点，说明模型与市场几乎一致，适合继续观察，不宜直接下单。 |
| 海地 vs 苏格兰 | draw | OBSERVE_ONLY | watch_negative_ev\|watch_gs_divergence | divergent | 0.05 | 0.21 | -0.25 | -4.39 | 盘口拆解：主胜+0.05个百分点，平局+0.21个百分点，客胜-0.25个百分点。 三项边际都不到 0.5 个百分点，说明模型与市场几乎一致，适合继续观察，不宜直接下单。 |
| 澳大利亚 vs 土耳其 | home | OBSERVE_ONLY | watch_negative_ev\|watch_gs_divergence | divergent | 0.01 | -0.08 | 0.07 | -4.24 | 盘口拆解：主胜+0.01个百分点，平局-0.08个百分点，客胜+0.07个百分点。 三项边际都不到 0.5 个百分点，说明模型与市场几乎一致，适合继续观察，不宜直接下单。 |