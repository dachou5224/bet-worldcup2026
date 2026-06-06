# 世界杯量化投资分析与策略输出规格说明

> 本文档用于定义项目中“盘口数据 → 概率建模 → 定价偏差 → 风险控制 → 策略解释”的研究流程。当前输出层先限定为文字分析，不直接生成投注指令；后续若映射到中国大陆地区合法公开销售的彩票玩法，应仅以中国体育彩票/竞彩等合规渠道和官方规则为边界。

## 1. 总体目标

本项目不以“预测某队一定获胜”为核心目标，而是把世界杯相关盘口视为一组关于比分分布、净胜球分布和总进球分布的市场报价。量化模块的任务是将不同来源的市场价格统一转化为概率，再与模型概率比较，识别可能存在的定价偏差，并用风险约束控制表达方式。

完整链路为：

```text
Raw Inputs
  -> Normalized Market Snapshots
  -> Implied Probability / Devig
  -> Score Distribution Model
  -> Fair Pricing by Market Type
  -> Mispricing / EV / Confidence
  -> Portfolio & Risk Layer
  -> Textual Strategy Explanation
```

## 2. Input：输入层

输入层分为六类：赛事基础数据、市场盘口数据、预测市场数据、球队与球员数据、赛事情境数据、历史训练与复盘数据。

### 2.1 赛事基础数据

赛事基础数据用于确定比赛对象和结算边界。

核心字段：

```js
{
  fixtureId,
  competition,
  stage,
  group,
  homeTeam,
  awayTeam,
  kickoffUtc,
  venue,
  neutralVenue,
  status
}
```

注意事项：

- 世界杯大量比赛为中立场，不能简单套用传统主场优势。
- 同一场比赛必须建立内部稳定 `fixtureId`，避免不同数据源使用不同队名导致错配。
- 淘汰赛要区分“90 分钟赛果”“加时后赛果”“点球后晋级结果”。

### 2.2 市场盘口数据

盘口数据是系统的核心输入。每条盘口都应被保存为独立快照，而不是只保留最新值。

建议统一结构：

```js
{
  snapshotId,
  fixtureId,
  provider,
  bookmaker,
  capturedAt,
  marketType,
  line,
  period,
  outcomes: [
    { name, price, point }
  ],
  sourceMeta: {
    region,
    rawEventId,
    rawMarketId,
    liquidity,
    volume
  }
}
```

其中 `marketType` 至少包括：

```text
h2h              胜平负
spread           让球 / 亚洲让球
total            大小球
correct_score    比分
half_full_time   半全场
qualification    晋级 / 出线
outright         冠军 / 小组第一等长期盘
```

优先级：

```text
closing odds > pre-match 1h > pre-match 24h > opening odds > mock data
```

### 2.3 预测市场数据

预测市场数据来自 Polymarket 等市场，主要用于补充公众定价、流动性、事件叙事和跨市场分歧。

核心字段：

```js
{
  fixtureId,
  marketId,
  question,
  outcomes,
  outcomePrices,
  liquidity,
  volume,
  openInterest,
  capturedAt,
  eventSlug,
  conditionId
}
```

注意事项：

- 预测市场问题不一定对应单场 90 分钟赛果，可能是晋级、冠军、小组出线或球员奖项。
- 必须先做语义映射，再进入概率比较。
- 流动性过低的市场只能作为情绪信号，不能直接作为强定价基准。

### 2.4 球队与球员数据

用于构建非市场模型概率，避免系统完全跟随盘口。

可选字段：

```text
FIFA/Elo rating
近期战绩
进攻强度
防守强度
预期进球 xG
预期失球 xGA
伤停
首发阵容
旅行距离
休息天数
阵容轮换
红黄牌停赛
门将质量
定位球强弱
```

初期不必追求全量机器学习模型，可以先用少量高价值变量构建基准修正。

### 2.5 赛事情境数据

世界杯和联赛最大区别在于赛事情境强烈影响战意。

核心字段：

```text
小组积分
净胜球压力
是否已出线
是否必须争胜
是否可接受平局
淘汰赛阶段
潜在对阵路径
天气
场地
裁判尺度
```

这些字段主要进入“情境修正层”，不宜直接手工拍脑袋改概率，而应作为模型参数或风险标签。

### 2.6 历史训练与复盘数据

用于校准模型和评估策略，不应和未来数据混用。

核心字段：

```js
{
  fixtureId,
  preMatchSnapshots,
  closingSnapshot,
  finalScore,
  settlementByMarket,
  modelPredictionBeforeKickoff,
  realizedReturn,
  closingLineValue
}
```

必须避免 look-ahead bias。任何赛后才知道的数据，不得进入赛前模型。

## 3. Algorithm：计算公式与算法层

算法层分为七个模块：去水、比分分布、盘口定价、市场聚合、偏差识别、置信度、资金与风险约束。

### 3.1 赔率转隐含概率

十进制赔率 `O_i` 的原始隐含概率为：

```math
q_i = \frac{1}{O_i}
```

盘口总抽水为：

```math
M = \sum_i q_i - 1
```

最简单的比例去水：

```math
p_i^{market} = \frac{q_i}{\sum_j q_j}
```

公平赔率：

```math
O_i^{fair} = \frac{1}{p_i^{market}}
```

比例去水可以作为第一版 baseline。后续可以加入 Shin method、power method 或按盘口类型区分的去水方法。

### 3.2 市场聚合

同一场比赛、同一盘口类型、同一盘口线，可能有多个 provider。

基础平均：

```math
p_i^{avg} = \frac{1}{N}\sum_k p_{i,k}
```

加权平均：

```math
p_i^{w} = \frac{\sum_k w_k p_{i,k}}{\sum_k w_k}
```

权重可由以下因素决定：

```text
provider 可靠性
赔率新鲜度
盘口流动性
历史校准误差
是否接近临盘
```

时间衰减权重：

```math
w_t = \exp(-\lambda \Delta t)
```

### 3.3 比分分布模型

所有盘口都可以看成比分矩阵的投影。

```math
P(G_h=i, G_a=j)
```

第一版可用双泊松模型：

```math
G_h \sim Poisson(\lambda_h)
```

```math
G_a \sim Poisson(\lambda_a)
```

```math
P(i,j)=\frac{e^{-\lambda_h}\lambda_h^i}{i!}\cdot\frac{e^{-\lambda_a}\lambda_a^j}{j!}
```

其中 `lambda_h` 和 `lambda_a` 可以由球队强度、市场大小球、胜平负盘口共同校准。

后续可升级为 Dixon-Coles 修正，以改善低比分相关性：

```math
P_{DC}(i,j)=\tau(i,j,\rho)P_{Poisson}(i,j)
```

### 3.4 各类玩法的公平定价

胜平负：

```math
P(H)=\sum_{i>j}P(i,j)
```

```math
P(D)=\sum_{i=j}P(i,j)
```

```math
P(A)=\sum_{i<j}P(i,j)
```

总进球大于盘口线 `L`：

```math
P(Over_L)=\sum_{i+j>L}P(i,j)
```

总进球小于盘口线 `L`：

```math
P(Under_L)=\sum_{i+j<L}P(i,j)
```

亚洲让球或让球胜平负可以转化为净胜球分布：

```math
D = G_h - G_a
```

```math
P(HomeCover_L)=P(D+L>0)
```

比分玩法：

```math
P(Score=i:j)=P(G_h=i,G_a=j)
```

半全场需要半场比分矩阵和全场比分矩阵联合估计。第一版可以用半场进球比例近似：

```math
\lambda_{h,HT}=r\lambda_h
```

```math
\lambda_{a,HT}=r\lambda_a
```

其中 `r` 可由历史世界杯或国际比赛数据估计。

### 3.5 定价偏差与期望收益

模型概率与市场概率的差值：

```math
Edge_i = P_i^{model} - P_i^{market}
```

相对优势：

```math
RelativeEdge_i = \frac{P_i^{model}}{P_i^{market}} - 1
```

十进制赔率下的期望收益：

```math
EV_i = P_i^{model}(O_i-1) - (1-P_i^{model})
```

等价写法：

```math
EV_i = P_i^{model}O_i - 1
```

只有当 `EV` 超过安全边际，才进入候选池：

```math
EV_i > \theta
```

安全边际 `theta` 用于覆盖模型误差、盘口滑点、数据延迟和实际可购买限制。

### 3.6 概率收缩与置信度

裸模型容易过度自信，需要向市场基准收缩：

```math
P_i^{adj}=\alpha P_i^{model}+(1-\alpha)P_i^{market}
```

其中 `alpha` 是模型信任度。早期建议取较低值，例如 0.2 到 0.5。

置信度可以由以下因素综合打分：

```text
市场分歧程度
盘口新鲜度
provider 数量
模型与市场偏差是否跨盘口一致
是否存在低流动性噪声
是否临近开赛
是否有关键伤停未确认
```

一个简单分歧指标：

```math
Dispersion = \sum_i |P_{i}^{odds} - P_{i}^{predictionMarket}|
```

### 3.7 资金管理与组合约束

单注 Kelly：

```math
f^*=\frac{bp-q}{b}
```

其中：

```math
b=O-1
```

```math
p=P^{adj}
```

```math
q=1-p
```

实际仓位使用分数 Kelly：

```math
f = c f^*
```

其中 `c` 可取 0.25 或更低。

组合层必须加入暴露限制：

```text
单场最大风险
单比赛日最大风险
同一球队暴露
同一盘口类型暴露
同一策略因子暴露
小球/大球方向暴露
强队溢价/弱队受让因子暴露
淘汰赛平局因子暴露
```

组合暴露可写为：

```math
Exposure_f=\sum_i w_i\beta_{i,f}
```

超过限制时，即使单项 EV 为正，也应降低权重或排除。

## 4. Output：输出层

当前输出层暂定为文字解释，不直接输出投注建议。输出应服务于研究、复盘和策略判断。

### 4.1 单场分析输出

建议字段：

```js
{
  fixtureId,
  fixture,
  kickoff,
  marketSummary,
  modelSummary,
  mispricingSummary,
  riskSummary,
  confidence,
  explanation,
  noActionReason
}
```

示例文字结构：

```text
本场市场基准显示，主胜概率约为 X%，平局 Y%，客胜 Z%。模型在收缩后给出的主胜概率为 X2%，与市场差异不大，因此胜平负主盘暂不构成明显偏差。

更值得关注的是让球与大小球之间的结构性关系。当前盘口隐含强队小胜概率较高，但大小球市场并未同步抬高总进球预期，说明市场更偏向“强队控制局面”而非“开放式大胜”。

风险上，本场存在小组积分形势不确定、首发未确认等因素，置信度应下调。当前输出为观察，不进入策略候选。
```

### 4.2 策略候选输出

即便后续生成建议，也应先输出候选信号，而不是直接输出“买什么”。

建议字段：

```js
{
  signalId,
  fixtureId,
  marketType,
  line,
  outcome,
  marketProbability,
  modelProbability,
  adjustedProbability,
  edge,
  expectedValue,
  confidence,
  riskTags,
  suggestedActionText
}
```

` suggestedActionText` 第一阶段只写成：

```text
进入观察池
进入候选池
因置信度不足跳过
因相关性暴露过高跳过
因盘口新鲜度不足跳过
```

不直接写成具体金额或强制执行语句。

### 4.3 组合输出

组合输出用于说明某一类定价偏差如何被表达。

示例：

```text
当前组合主要暴露在“强队难以穿深盘”和“低总进球”两个因子上。虽然单项信号分散在三场比赛，但底层风险高度相关，若强队早段集体进球，组合可能同步受损。因此组合层建议降低同类信号权重，保留观察，不扩大敞口。
```

字段：

```js
{
  portfolioId,
  generatedAt,
  candidateSignals,
  totalRiskBudget,
  exposureByFactor,
  exposureByFixture,
  exposureByMarketType,
  rejectedSignals,
  portfolioCommentary
}
```

### 4.4 复盘输出

复盘比预测更重要。每场结束后都应生成复盘记录。

字段：

```js
{
  fixtureId,
  finalScore,
  marketClose,
  modelBeforeKickoff,
  settlement,
  realizedReturn,
  closingLineValue,
  calibrationError,
  reviewText
}
```

核心指标：

```math
Brier = \sum_i (p_i-y_i)^2
```

```math
LogLoss = -\log(p_{actual})
```

```math
CLV = O_{taken} - O_{closing}
```

复盘文字不要只写“中了/没中”，而要回答：

```text
模型概率是否校准？
市场是否比模型更早反映信息？
偏差来自数据、模型、情境判断还是随机波动？
这个信号未来应该加强、降权还是删除？
```

## 5. 与中国大陆合法公开彩票玩法的后续映射

后续如需映射到中国大陆地区合法公开销售的世界杯相关竞猜彩票，应只考虑官方公开销售、规则明确、可合法购买的玩法。系统内部仍应保持“研究信号”与“具体投注动作”分离。

可能映射关系：

```text
h2h            -> 竞彩足球胜平负
handicap h2h   -> 竞彩足球让球胜平负
correct_score  -> 竞彩足球比分
total goals    -> 竞彩足球总进球数
half_full_time -> 竞彩足球半全场
```

注意：

- 官方玩法与海外盘口并不完全等价。
- 让球胜平负不是亚洲让球盘的简单复制，结算规则要按官方口径处理。
- 总进球数通常是离散档位，而不是连续大小球线。
- 比分玩法存在赔率高、概率低、方差大的问题，适合小权重观察，不适合作为核心策略。
- 串关会显著放大方差，组合层必须单独建模。
- 合法性、销售状态、赛事是否入选、赔率更新时间、停售时间，都必须以当期官方数据为准。

## 6. 第一阶段最小可实现版本

建议第一阶段只实现以下闭环：

```text
输入：h2h / spread / total 快照
计算：去水概率 + 市场聚合 + 简单双泊松比分矩阵
定价：胜平负、让球、大小球
信号：edge、EV、置信度
输出：文字解释 + 观察池/候选池
复盘：赛果结算 + Brier + LogLoss + CLV
```

暂时不要做：

```text
复杂机器学习模型
滚球高频交易
自动下单
大规模串关优化
LLM 直接生成概率
```

## 7. 推荐工程落地模块

```text
src/quant/odds/devig.js
src/quant/models/score-matrix.js
src/quant/pricing/h2h.js
src/quant/pricing/spread.js
src/quant/pricing/total.js
src/quant/edge/ev.js
src/quant/portfolio/kelly.js
src/quant/portfolio/exposure.js
src/quant/backtest/settlement.js
src/quant/output/text-summary.js
```

现有 dashboard 可以继续作为展示层，但应逐步从 `market-pipeline.js` 的启发式逻辑迁移到 `src/quant/` 的结构化结果。
