# 世界杯量化投资分析与策略输出规格说明

> 本文档用于定义项目中“海外盘口数据 → 概率建模 → 定价偏差 → 风险控制 → **中国体育彩票竞彩足球（2026 世界杯）具体投注建议**”的完整研究流程。中间层允许使用 Pinnacle、Polymarket 等海外定价作研究基准；**最终对用户可见的输出必须收敛到合规体彩玩法**（胜平负、让球胜平负、总进球数、比分、半全场等），并以当期官方赛程、赔率、停售时间与游戏规则为准。系统不执行自动代购；输出定位为**研究型投注建议**，购买动作由用户自行在合法渠道完成。
>
> **阅读指引：** 足球盘口与概率术语见 **§1.1**；各算法公式后的 **「概念说明」** 解释数学含义；**§6** 定义从海外盘到体彩建议的收敛规则；**附录 A** 为符号速查，**附录 B** 为常见误区。  
> **工程落地：** 分阶段实施与 pick-up 状态见 [QUANT_IMPLEMENTATION_PLAN.md](./QUANT_IMPLEMENTATION_PLAN.md)。

## 1. 总体目标

本项目不以“预测某队一定获胜”为核心目标，而是把世界杯相关盘口视为一组关于比分分布、净胜球分布和总进球分布的市场报价。量化模块的任务是将不同来源的市场价格统一转化为概率，再与模型概率比较，识别可能存在的定价偏差，并用风险约束控制表达方式。

完整链路为：

```text
Raw Inputs（海外盘 + 预测市场 + 基本面）
  -> Normalized Market Snapshots
  -> Implied Probability / Devig
  -> Score Distribution Model
  -> Fair Pricing by Market Type
  -> Mispricing / EV / Confidence
  -> Recommendation Decision Layer（研究信号）
  -> Portfolio & Risk Layer
  -> PlayMapping（海外 outcome -> 竞彩玩法/选项）
  -> Official Odds Re-pricing（用体彩官方赔率重算 EV/Kelly）
  -> Jingcai Recommendation（2026 世界杯具体投注建议）
  -> Textual Strategy Explanation + Post-settlement Review
```

这里最重要的一点是：**海外算法结果不是最终投注建议**。海外信号只说明“在 global market 定价下某 outcome 可能被低估”；**对中国大陆用户有意义的最终建议**必须再经过：（1）竞彩玩法映射；（2）官方赔率二次定价；（3）销售/停售校验；（4）概率收缩、安全边际、Kelly、组合约束。任一环节失败则降级为 WATCH 或仅保留海外研究视角，不得输出“请购买某体彩选项”的强指令。

### 1.1 概念基础：足球盘口、概率与量化用语

本节为后文公式和字段提供统一语义。若已熟悉体育博彩与基础概率论，可跳过；实现代码时建议把此处术语与 schema 字段一一对应。

#### 1.1.1 赔率、隐含概率与“公平价格”

**十进制赔率（Decimal Odds）** 记为 `O`。若某选项赔率为 `2.50`，表示：下注 1 单位，猜中后连本带利收回 2.50 单位，净赢 1.50 单位。本项目统一使用十进制赔率；若数据源为港盘、马来盘或美式赔率，必须先换算再进入算法层。

**隐含概率（Implied Probability）** 是把赔率“倒过来”读成市场对该结果发生可能性的报价：

```text
隐含概率 q = 1 / O
```

例如 `O=2.00` 对应 `q=50%`，`O=4.00` 对应 `q=25%`。注意：这是“价格语言”，不是经过去偏后的真实概率估计。

**抽水 / 水钱 / Overround（Margin）** 庄家会在同一盘口各选项的隐含概率之和上留出安全边际。胜平负三项去水前常见 `q_H + q_D + q_A ≈ 1.03 ~ 1.08`，多出来的部分就是 `M = Σq_i - 1`。Margin 越高，玩家长期期望越差；量化研究必须先去掉这部分“结构性溢价”，再谈 Edge。

**去水概率（Devigged / Fair Probability）** 是在承认 Margin 存在的前提下，把 `{q_i}` 重新归一化到总和为 1 的 `{p_i^{market}}`。去水后的概率才可当作“市场共识的无抽水估计”，用于和模型概率对比。

**公平赔率（Fair Odds）** 是去水概率的倒数：`O_i^{fair} = 1 / p_i^{market}`。若实际可买赔率 `O` 高于公平赔率，说明该选项相对市场共识可能被低估；反之可能被高估。

#### 1.1.2 足球盘口类型与它们在概率空间中的含义

足球博彩不是只有一个“谁赢”，而是对**同一场比赛的多种随机变量**分别报价。理解每种玩法的随机变量，是后面“比分矩阵投影”的前提。

| 玩法 | 英文/字段 | 随机变量（简化） | 典型结算口径 |
|------|-----------|------------------|--------------|
| 胜平负 | `h2h` / 1X2 | 90 分钟主胜/平/客胜 | 常规时间，不含加时点球 |
| 让球盘 | `spread` / 亚洲盘 | 调整后的净胜球 `D+L` | 让球数 `L` 可为 0.25/0.5/0.75 等 |
| 大小球 | `total` / O/U | 总进球 `G_h+G_a` 与线 `L` 比较 | 2.5 球线最常见 |
| 比分 | `correct_score` | 联合事件 `(G_h,G_a)=(i,j)` | 精确比分 |
| 半全场 | `half_full_time` | 半场结果 × 全场结果 | 如“胜/平” |
| 晋级/出线 | `qualification` | 是否晋级下一轮 | 可能含加时/点球 |
| 冠军/小组第一 | `outright` | 长期结果 | 多场比赛复合事件 |

**胜平负（1X2）**：只问 90 分钟内谁没输、谁赢。世界杯淘汰赛若 90 分钟平局进入加时，1X2 仍按平局结算；这与“晋级盘”不同。

**让球盘（Asian Handicap / Spread）**：强队让弱队若干球。设真实净胜球 `D = G_h - G_a`，盘口线为 `L`（主队视角，负值表示主队让球）。主队“赢盘”近似指 `D + L > 0`（半赢/半输盘需按 0.25 球拆分，实现层要单独处理 push/半赢规则）。让球盘的价值在于：当 1X2 三项概率极度倾斜时，仍可对“赢几个球”定价。

**大小球（Totals / Over-Under）**：对 `T = G_h + G_a` 与盘口线 `L` 比较。`Over 2.5` 即 `T ≥ 3`；`Under 2.5` 即 `T ≤ 2`。2.5、3.5 等“半球线”可避免走水；整数线（如 2.0、3.0）可能出现退款（push）。

**比分盘**：直接买 `(i:j)`。单个 outcome 概率通常很低，赔率高、方差大；在组合层应限制权重。

**半全场**：是“半场 1X2”与“全场 1X2”的笛卡尔积，共 9 种组合（胜胜、胜平等）。需要联合分布，不能简单用两个独立 1X2 相乘（除非模型假设半场与全场独立，通常不成立）。

**预测市场 vs 传统庄家盘**：Polymarket 等是连续交易的“事件合约价格”，价格在 0~1 之间时可近似看作概率；但其问题表述可能与 90 分钟 1X2 不一致（如“是否晋级”），必须先做**语义映射**再与赔率盘比较。

#### 1.1.3 时间维度：开盘、临盘、封盘与 CLV

| 术语 | 含义 | 研究用途 |
|------|------|----------|
| Opening odds | 开盘赔率 | 观察初始定价、早期偏差 |
| Pre-match 24h / 1h | 赛前 24 小时 / 1 小时 | 跟踪信息流入 |
| Closing odds | 封盘/开球前最后有效赔率 | 通常视为效率最高的市场基准 |
| Line movement | 盘口或赔率变动 | 识别资金流向与信息更新 |
| CLV（Closing Line Value） | 所取赔率相对封盘线的优势 | 衡量是否“买在了好价格” |

**Closing Line Value** 的直觉：若你在 `O_taken=2.20` 买入，而封盘线为 `O_closing=2.00`，则 CLV 为正，说明相对终盘你拿到了更好价格。长期正 CLV 往往比短期命中率更能衡量研究质量。

#### 1.1.4 模型概率、市场概率与“优势”

| 符号 | 含义 |
|------|------|
| `P^{market}` | 去水并聚合后的市场隐含概率 |
| `P^{model}` | 结构模型（如双泊松）或基本面修正得到的原始概率 |
| `P^{adj}` | 向市场收缩后的可用概率，用于 EV/Kelly |
| Edge | `P^{model} - P^{market}` 或收缩后的差值，表示绝对优势 |
| EV | 按某概率和赔率计算的每单位下注期望回报 |
| Kelly | 在重复下注假设下，最大化长期对数财富的最优仓位比例 |

**关键区分**：`P^{model} > P^{market}` 只说明“模型比市场更看好该 outcome”，不等于“应该下注”。世界杯样本短、模型误差大、市场含更多信息，因此必须先收缩到 `P^{adj}`，再过 EV 阈值、Kelly 和组合约束。

#### 1.1.5 世界杯场景下的特殊概念

- **中立场（neutralVenue）**：世界杯大量比赛无真正主场，传统“主场优势”参数应关闭或大幅下调。
- **90 分钟 vs 晋级**：淘汰赛 1X2 按 90 分钟；晋级盘可能含加时/点球，不能把两种问题的概率混用。
- **战意与情境**：小组末轮“已出线仍要争第一”与“保平即可”会改变进球分布，属于**情境修正**而非简单改 1X2 三项百分比。
- **Look-ahead bias（前视偏差）**：用赛后数据（最终首发、实际伤病、终场比分）回头“预测”赛前，会虚高模型表现；训练与复盘必须严格按时间切分。

## 2. Input：输入层

输入层分为六类：赛事基础数据、市场盘口数据、预测市场数据、球队与球员数据、赛事情境数据、历史训练与复盘数据。

### 2.1 赛事基础数据

赛事基础数据用于确定比赛对象和结算边界。

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

注意事项：世界杯大量比赛为中立场，不能简单套用传统主场优势；同一场比赛必须建立内部稳定 `fixtureId`；淘汰赛要区分“90 分钟赛果”“加时后赛果”“点球后晋级结果”。

### 2.2 市场盘口数据

盘口数据是系统的核心输入。每条盘口都应保存为独立快照，而不是只保留最新值。

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

`marketType` 至少包括：

```text
h2h              胜平负
spread           让球 / 亚洲让球
total            大小球
correct_score    比分
half_full_time   半全场
qualification    晋级 / 出线
outright         冠军 / 小组第一等长期盘
```

**各玩法补充说明（输入层视角）：**

- **`h2h`**：最基础的“赛果三向”盘。市场效率高、数据多，适合作为 baseline；但三项和相关性高，单独看一项 Edge 时应注意另两项的联动。
- **`spread`**：字段 `line` 表示让球线（主队视角）。同一比赛常有 `-0.5 / -1 / -1.25` 等多条线并存；聚合时必须 **marketType + line** 联合键，不能把不同线混平均。
- **`total`**：字段 `line` 为大小球线（如 2.5）。Over/Under 两项互补（忽略 push）；与 1X2、让球盘共享同一场进球过程，因此信号往往相关。
- **`correct_score`**：outcome 数量多、单格概率小，对模型校准误差敏感；适合观察，不宜作为核心仓位来源。
- **`half_full_time`**：需要半场与全场的联合结构；第一版可用 `λ` 缩放近似，精度有限，置信度应偏低。
- **`qualification` / `outright`**：时间跨度长，受后续对阵影响；与单场 90 分钟模型不是同一随机变量，默认 **不自动映射** 到单场信号。

数据优先级：

```text
closing odds > pre-match 1h > pre-match 24h > opening odds > mock data
```

**优先级含义：** 越接近开球的快照，通常包含越多公开信息（首发、伤病、天气、资金流向），因此作为 `P^{market}` 基准更可靠。复盘时应用 `closingSnapshot` 评估 CLV；回测策略时若假设“可在赛前某时刻下注”，必须使用该时刻之前可见的快照，不能用封盘线代替。

### 2.3 预测市场数据

预测市场数据来自 Polymarket 等市场，主要用于补充公众定价、流动性、事件叙事和跨市场分歧。

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

预测市场问题不一定对应单场 90 分钟赛果，可能是晋级、冠军、小组出线或球员奖项。进入模型前必须先做语义映射。流动性过低的市场只能作为情绪信号，不能直接作为强定价基准。

**概念说明：** 预测市场价格 `p ∈ [0,1]` 时可近似看作“群体认为事件发生的概率”，但受流动性、手续费、参与者结构影响。`volume` / `openInterest` 过低时，价格可被小额交易拉动，**不能**与 Pinnacle 等 deep book 的 closing line 同等权重。映射步骤示例：将 “Will Team A win?” 映射到 `(fixtureId, marketType=h2h, outcome=home)`，并记录 `mappingConfidence`；无法唯一映射的问题只进入 Dispersion 或叙事层，不进入 EV 计算。

### 2.4 球队与球员数据

用于构建非市场模型概率，避免系统完全跟随盘口。

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

初期不必追求复杂机器学习模型，可以先用少量高价值变量构建基准修正。

**概念说明：**

- **xG / xGA（预期进球/失球）：** 基于射门位置、角度、防守压力等估计的“进球期望值”，比实际进球更稳定，适合估计泊松强度 `λ` 的先验。
- **Elo / FIFA Rating：** 综合历史胜负的强弱指标，可映射为进球差期望，但世界杯国家队样本短，评级滞后性需警惕。
- **伤停 / 首发：** 影响 `λ` 的即时修正；未确认首发时，模型应打 `riskTags: lineup_unconfirmed` 并降低置信度。
- **与本项目关系：** 这些变量用于生成 `P^{model}` 或对 `λ` 做小幅偏移，**不替代**市场去水概率作为基准。

### 2.5 赛事情境数据

世界杯和联赛最大区别在于赛事情境强烈影响战意。

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

这些字段主要进入“情境修正层”和“风险标签层”，不宜直接手工拍脑袋改概率。

### 2.6 历史训练与复盘数据

用于校准模型和评估策略，不应和未来数据混用。

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

**概念说明：** **Look-ahead bias（前视偏差）** 指在模拟“赛前决策”时使用了当时不可见的信息。典型错误包括：用终场比分调参、用赛后公布的准确首发回填赛前模型、用整届世界杯结束后的 Elo 回头算小组赛。正确做法：每条 `preMatchSnapshots` 带 `capturedAt`，模型输入只能 ≤ 该时刻；复盘字段 `modelBeforeKickoff` 必须与开球前最后一次运行结果一致。`closingLineValue` 与 `realizedReturn` 属于 **赛后标签**，只用于评估，不能回流训练赛前特征（除非走严格 walk-forward 协议）。

## 3. Algorithm：计算公式与算法层

算法层分为八个模块：去水、市场聚合、比分分布、盘口定价、偏差识别、概率收缩、资金管理、组合风控。

### 3.1 赔率转隐含概率

十进制赔率 `O_i` 的原始隐含概率为：

```math
q_i = \frac{1}{O_i}
```

盘口总抽水为：

```math
M = \sum_i q_i - 1
```

比例去水：

```math
p_i^{market} = \frac{q_i}{\sum_j q_j}
```

公平赔率：

```math
O_i^{fair} = \frac{1}{p_i^{market}}
```

比例去水可以作为第一版 baseline。后续可以加入 Shin method、power method 或按盘口类型区分的去水方法。

**概念说明：**

- **为什么要去水：** 若直接用 `q_i=1/O_i`，三项之和大于 1，相当于默认“世界比真实更确定”。去水是把 Margin 按某种规则分摊回各 outcome，得到可比较、可相加的概率测度。
- **比例去水（Proportional / Multiplicative）：** 假设庄家对每一项的“压价比例”相同，因此把 `{q_i}` 等比例缩放至总和为 1。实现简单、可解释，是本阶段默认方法。
- **Shin method：** 假设一部分概率质量来自“内幕/知情交易者”，对热门项去水更多。适用于热门队比赛，但参数估计更复杂。
- **Power method：** 对 `q_i` 做幂变换后再归一化，介于比例去水与更复杂模型之间。
- **数值例：** 主胜 `O_H=2.10`、平 `3.40`、客胜 `3.60` → `q_H=0.476, q_D=0.294, q_A=0.278`，总和 `1.048`，Margin `4.8%`。比例去水后 `p_H≈0.454, p_D≈0.281, p_A≈0.265`。

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

时间衰减权重：

```math
w_t = \exp(-\lambda \Delta t)
```

权重可由 provider 可靠性、赔率新鲜度、盘口流动性、历史校准误差、是否接近临盘共同决定。

**概念说明：**

- **为何聚合：** 单一庄家盘可能受限额、客户结构、滞后定价影响；多源平均可降低单点噪声。Pinnacle 等常被视为“sharp line”参考，但本项目仍应用统一 schema 而非硬编码某一家。
- **简单平均 vs 加权平均：** 等权平均隐含“各源同等可信”；加权平均把更 sharp、更新更快、历史校准更好的源权重调高。
- **时间衰减 `w_t = exp(-λΔt)`：** Δt 为快照距当前或距开球的时间差。越旧的赔率权重越低，避免用 48 小时前的盘与临盘混算。
- **注意：** 聚合前必须保证 **同一 fixture、同一 marketType、同一 line、同一 period**；否则是在对不可比事件求平均。

### 3.3 比分分布模型

所有盘口都可以看成比分矩阵的投影：

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

其中 `lambda_h` 和 `lambda_a` 可以由球队强度、市场大小球、胜平负盘口共同校准。后续可升级为 Dixon-Coles 修正，以改善低比分相关性：

```math
P_{DC}(i,j)=\tau(i,j,\rho)P_{Poisson}(i,j)
```

**概念说明：**

- **比分矩阵 `P(G_h=i, G_a=j)`：** 是整场比赛的“生成模型”。1X2、大小球、让球、比分盘都是对这个矩阵的不同**线性投影**（对格子求和）。先建联合分布再推各玩法，可保证玩法间逻辑一致。
- **泊松进球假设：** 在固定强度 `λ_h, λ_a` 下，某队进 `k` 球概率为 `Poisson(k; λ)`。独立双泊松意味着两队进球数独立，实现快，但会高估 `0:0`、`1:1` 等低比分以外的某些组合误差。
- **`λ_h, λ_a` 的校准：** 可先用市场 1X2 + 大小球反推隐含 `λ`，再叠加球队 xG、休息天数等小幅修正。本质是“以市场为锚，模型做偏离”。
- **Dixon-Coles 修正：** 低比分（0:0、1:0、0:1、1:1）在真实足球中比独立泊松更常见；`τ(i,j,ρ)` 对这些格子做相关性修正，改善 1X2 与 Under 盘的联合拟合。
- **截断网格：** 实现时对 `i,j` 取 0..N（如 N=8 或 10），尾部概率并入最后一格或丢弃；N 过小会低估大比分 Outcome。

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

让球盘可以转化为净胜球分布：

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

**概念说明：**

- **胜平负投影：** `P(H)` 把所有“主队进球多于客队”的格子求和；`P(D)` 是对角线 `i=j`；`P(A)` 是 `i<j`。这是 1X2 与比分模型的严格一致关系。
- **大小球：** `Over_L` 对满足 `i+j > L` 的格子求和。半球线（2.5）无走水；整数线需单独处理 `i+j = L` 的 push 退款。
- **让球盘：** `P(HomeCover_L) = P(D + L > 0)` 等价于在比分矩阵上把主队“虚拟加 L 球”后再数主胜格子。亚洲四分盘（±0.25）需拆成两个半盘加权。
- **比分盘：** 直接读 `P(i,j)` 单格；概率低、估计方差大。
- **半全场近似：** 设全场 `λ` 已知，半场 `λ_HT = r·λ`（常见 r≈0.45），再独立假设两个半场泊松——这是第一版近似，置信度应低于纯 1X2/O-U。

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

**概念说明：**

- **Edge（绝对边缘）：** `P^{model} - P^{market}`，单位是“概率点”。例如 +5pp 表示模型比市场高 5 个百分点。注意：后续决策层默认用 **收缩后** 的 Edge，即 `P^{adj} - P^{market}`。
- **Relative Edge（相对边缘）：** 比例意义的优势，便于比较不同概率水平 outcome（如 10% vs 40% 的选项）。
- **EV 推导：** 下注 1 单位，赔率为 `O`，猜中净赚 `O-1`，猜错亏 1。期望为 `EV = P·(O-1) - (1-P)·1 = P·O - 1`。`EV>0` 表示长期重复下注的数学期望为正，**不代表单场必赢**。
- **为何 EV 要用 `P^{adj}`：** 裸 `P^{model}` 往往过度自信；用收缩概率算 EV 相当于对模型误差做保守折扣。
- **安全边际 `θ`：** 即使 `EV` 略大于 0，仍可能不足以覆盖：模型错估、赔率滑点、延迟抓盘、无法成交、映射到竞彩后赔率变差等摩擦。只有 `EV > θ` 才进入强候选；`0 < EV ≤ θ` 常归为 WATCH。
- **数值例：** `P=0.45, O=2.30` → `EV = 0.45×2.30 - 1 = 0.035`（+3.5%）。即每下注 100 单位，长期平均期望回报约 3.5 单位（忽略方差与破产风险）。

### 3.6 概率收缩与置信度

裸模型容易过度自信，需要向市场基准收缩：

```math
P_i^{adj}=\alpha P_i^{model}+(1-\alpha)P_i^{market}
```

其中 `alpha` 是模型信任度。早期建议取较低值，例如 0.2 到 0.5。后续所有 EV 和 Kelly 计算都必须使用 `P_i^{adj}`，不能直接使用裸模型概率 `P_i^{model}`。

分歧指标：

```math
Dispersion = \sum_i |P_{i}^{odds} - P_{i}^{predictionMarket}|
```

置信度由以下因素综合打分：市场分歧程度、盘口新鲜度、provider 数量、模型与市场偏差是否跨盘口一致、是否存在低流动性噪声、是否临近开赛、是否有关键伤停未确认。

**概念说明：**

- **概率收缩（Shrinkage）：** 统计学上相当于把模型估计拉向“先验/基准”（此处是市场概率）。`α` 越小，越信市场；`α` 越大，越信模型。世界杯短期样本下建议 **低 α（0.2~0.5）**，避免少量数据造成假 Edge。
- **与贝叶斯的关系：** 可粗略理解为：市场吸收了大量交易者信息，模型只是补充；收缩后的 `P^{adj}` 是“模型观点”和“市场观点”的 convex 组合，而非对模型纠错的一次性手工调整。
- **Dispersion 分歧指标：** 比较 **去水后的赔率盘** 与 **映射后的预测市场** 在同一 outcome 空间上的 L1 距离。Dispersion 大说明公开信息源不一致，此时即使模型与市场有 Edge，置信度也应下调。
- **置信度不是概率：** `confidence: low/medium/high` 是对“信号可执行性”的标签，与 `P^{adj}` 数值无关。低置信度信号可保留为 WATCH，不应直接升仓。

### 3.7 资金管理与 Kelly

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
f_{raw} = c f^*
```

其中 `c` 可取 0.25 或更低。

如果 `f^* <= 0`，说明在收缩概率下该选项没有正期望，建议层必须输出 `skip_negative_kelly`，不得进入投注候选。若 `f^* > 0`，也只代表“数学上可进入仓位计算”，不代表最终建议一定执行。

**概念说明：**

- **Kelly 准则直觉：** 在重复独立下注、概率与赔率准确的理想条件下，Kelly 比例 `f*` 使长期财富对数期望最大化。足球世界杯 **不满足独立重复**（样本少、相关性强），因此 Kelly 在本项目中只作 **仓位上限参考**，不是最优真实仓位。
- **公式对应：** `b = O-1` 为净赔率；`p = P^{adj}`；`q = 1-p`。`f* = (bp - q)/b` 与 `EV>0` 等价（同一 `p` 下）。
- **分数 Kelly：** 全 Kelly 波动极大；实务常用 `c=0.25`（四分之一 Kelly）或更低，相当于承认概率估计误差。
- **`f*` 与建议等级：** `f*` 很小（如 0.3%）时，即使 EV 为正，经济意义可能不足，对应 `watch_stake_too_small`；`f*` 被 cap 截断后得到 `f_final`，才是组合层认可的“可表达强度”。
- **破产与方差：** Kelly 优化的是渐近对数效用，不约束短期回撤。世界杯场景下必须配合 `singleCap`、`dayCap` 和因子暴露上限。

### 3.8 组合约束

组合层必须加入暴露限制：单场最大风险、单比赛日最大风险、同一球队暴露、同一盘口类型暴露、同一策略因子暴露、小球/大球方向暴露、强队溢价/弱队受让因子暴露、淘汰赛平局因子暴露。

组合暴露可写为：

```math
Exposure_f=\sum_i w_i\beta_{i,f}
```

超过限制时，即使单项 EV 为正，也应降低权重或排除。

**概念说明：**

- **为何需要组合层：** 三场比赛的“Under 2.5”可能共享同一因子（低节奏、强队小胜）；一场爆冷可能同时击穿多个信号。组合约束控制的是 **相关性风险**，不是单场 EV。
- **因子暴露 `Exposure_f = Σ w_i β_{i,f}`：** 每个信号 `i` 对因子 `f`（如“弱队受让”“低总进球”）有载荷 `β_{i,f}`，乘以建议权重 `w_i` 求和。超过因子上限则降级或剔除。
- **典型 cap：** 单场 ≤1% 总资金、单日 ≤3%、同一球队/同一 marketType 分别设顶。具体数值由产品风险预算配置，写入 `provider-config` 或决策层常量。
- **与串关的区别：** 本项目第一阶段不做串关优化；若未来映射竞彩串关，组合层需单独建模 **联合概率与方差放大**，不能将单场 Kelly 简单相加。

## 4. Recommendation Decision Layer：算法结果到投注建议的转换层

本节专门定义“计算结果如何推导出建议”。系统不得从模型概率直接跳到投注建议，必须经过以下决策管线：

```text
modelProbability
  -> adjustedProbability
  -> expectedValue（海外赔率）
  -> edgeThreshold
  -> kellyFraction
  -> riskCaps
  -> overseasSignalLevel（研究信号等级）
  -> playMapping（映射竞彩玩法）
  -> officialExpectedValue（体彩官方赔率重算）
  -> jingcaiDecisionCode
  -> jingcaiRecommendationLevel
  -> jingcaiRecommendationText（最终对用户建议）
```

**两层决策：** `overseasSignalLevel` 基于海外聚合盘；`jingcaiRecommendationLevel` 基于官方赔率与销售状态。前者可高于后者（例如海外有 Edge，但体彩官方赔率更差），**以前者展示研究、以后者决定是否给出体彩具体选项**。

### 4.1 单个选项的标准计算流程

对某一场比赛、某一玩法、某一个 outcome，先生成一个 `SignalCandidate`：

```js
{
  fixtureId,
  marketType,
  line,
  outcome,
  offeredOdds,
  marketProbability,
  modelProbability,
  adjustedProbability,
  edge,
  relativeEdge,
  expectedValue,
  rawKelly,
  fractionalKelly,
  cappedStakeFraction,
  confidence,
  riskTags,
  decisionCode,
  recommendationLevel,
  recommendationText
}
```

其中核心计算顺序必须固定：

```math
P^{adj}=\alpha P^{model}+(1-\alpha)P^{market}
```

```math
EV=P^{adj}O-1
```

```math
f^*=\frac{(O-1)P^{adj}-(1-P^{adj})}{O-1}
```

```math
f_{fractional}=c f^*
```

```math
f_{final}=\min(f_{fractional}, f_{singleCap}, f_{fixtureCapRemain}, f_{dayCapRemain}, f_{factorCapRemain})
```

解释关系如下：

`P^{model}` 只表示模型原始判断；`P^{adj}` 表示经过市场基准收缩后的可用概率；`EV` 判断是否值得进入候选；`f^*` 判断理论仓位方向；`f_final` 才是经过风险约束之后的可表达强度。最终建议只能依据 `f_final`、置信度和合规玩法映射共同生成。

### 4.2 决策门槛

建议层至少设置六道门槛。

```text
Gate 1: 数据有效性
Gate 2: 玩法可映射性
Gate 3: 概率收缩后仍有优势
Gate 4: EV 超过安全边际
Gate 5: Kelly 为正且不过小
Gate 6: 组合风险未超限
```

对应规则：

```js
if (!dataOk) decisionCode = "skip_bad_data";
else if (!playMappable) decisionCode = "skip_unmapped_play";
else if (adjustedProbability <= marketProbability) decisionCode = "skip_no_adjusted_edge";
else if (expectedValue <= evThreshold) decisionCode = "watch_ev_too_low";
else if (rawKelly <= 0) decisionCode = "skip_negative_kelly";
else if (fractionalKelly < minStakeFraction) decisionCode = "watch_stake_too_small";
else if (riskCapBreached) decisionCode = "skip_risk_cap";
else decisionCode = "candidate_positive_ev";
```

这段逻辑的含义是：模型概率高于市场概率并不自动产生建议；只有收缩后仍有优势、EV 超过阈值、Kelly 为正、组合约束未超限，才进入候选。

**六道 Gate 白话说明：**

| Gate | 拒绝/观察含义 | 典型触发场景 |
|------|---------------|--------------|
| 1 数据有效 | `skip_bad_data` | 快照过期、缺 line、provider 全失败 |
| 2 玩法可映射 | `skip_unmapped_play` | 信号无法映射到当期竞彩已开售玩法 |
| 3 收缩后仍有优势 | `skip_no_adjusted_edge` | 裸模型看好，但 `P_adj ≤ P_market` |
| 4 EV 过阈值 | `watch_ev_too_low` | EV 为正但 `< θ`，摩擦成本可能吃掉优势 |
| 5 Kelly 为正 | `skip_negative_kelly` | 收缩后数学期望已为负 |
| 6 组合未超限 | `skip_risk_cap` | 当日同类因子暴露已满 |

`watch_*` 与 `skip_*` 的区别：`skip` 表示不应再考虑执行；`watch` 表示值得跟踪（赔率变动、信息更新后可能升级），但当前不进入候选池。

### 4.3 建议等级

建议等级不直接使用“买入/重仓”这种语言，而使用研究系统中的分级表达。

```text
NO_ACTION       不行动
WATCH           观察
CANDIDATE       候选
SMALL_POSITION  小权重表达
AVOID           回避
HEDGE_ONLY      仅作为对冲
```

建议等级由 `decisionCode`、`confidence` 和 `f_final` 决定：

```js
if (decisionCode.startsWith("skip")) level = "NO_ACTION";
else if (decisionCode.startsWith("watch")) level = "WATCH";
else if (confidence === "low") level = "WATCH";
else if (f_final <= 0) level = "NO_ACTION";
else if (f_final < minActionStake) level = "CANDIDATE";
else level = "SMALL_POSITION";
```

其中 `SMALL_POSITION` 表示模型允许小权重表达，不表示系统自动执行投注。若后续接入中国大陆合法公开彩票玩法，这一级别仍需要经过官方赔率、停售时间、赛事是否入选、玩法规则和用户风险预算的二次确认。

**等级语义（研究输出，非交易指令）：**

- **NO_ACTION：** 数据或逻辑上不支持表达观点；前端可隐藏或折叠。
- **WATCH：** 存在叙事或弱 Edge，但未过执行阈值；适合进入观察列表与推送。
- **CANDIDATE：** 过门槛但 `f_final` 偏小，或置信度中等；可展示“研究候选”。
- **SMALL_POSITION：** 通过全部 Gate 且 `f_final` 达到 `minActionStake`；仅用“小权重”措辞，禁止“重仓/必买”。
- **AVOID / HEDGE_ONLY：** 模型显著不认同市场方向，或仅用于对冲另一暴露；常规世界杯单场研究较少使用。

### 4.4 数值示例：从概率收缩到建议

假设某选项的公开赔率为 `O=2.10`，去水后市场概率为 `P_market=0.455`，模型原始概率为 `P_model=0.540`。由于模型仍在早期，取 `alpha=0.40`：

```math
P^{adj}=0.4\times0.540+0.6\times0.455=0.489
```

用收缩后概率计算 EV：

```math
EV=0.489\times2.10-1=0.0269
```

若安全边际 `theta=0.03`，则虽然 EV 为正，但没有超过安全边际，输出应为：

```text
WATCH：模型原始概率显示存在优势，但经过市场收缩后，期望收益未超过安全边际，暂不进入可执行候选。
```

再看另一个选项，公开赔率 `O=2.50`，市场概率 `P_market=0.370`，模型概率 `P_model=0.500`，`alpha=0.40`：

```math
P^{adj}=0.4\times0.500+0.6\times0.370=0.422
```

```math
EV=0.422\times2.50-1=0.055
```

Kelly：

```math
f^*=\frac{(2.50-1)\times0.422-(1-0.422)}{2.50-1}=0.0367
```

如果使用四分之一 Kelly：

```math
f_{fractional}=0.25\times0.0367=0.0092
```

若单场上限为 1%，组合风险未超限，则：

```math
f_{final}=0.92\%
```

输出可以写成：

```text
SMALL_POSITION：该选项在收缩概率下仍有正期望，EV 约 5.5%，四分之一 Kelly 对应风险预算约 0.92%。由于模型优势主要来自弱队受让因子，需检查当日是否已有同类暴露；若同类暴露已接近上限，则降级为候选或观察。
```

这个示例说明：Kelly 分数不是“推荐买入”的充分条件，它只是建议强度的一个输入。真正的建议必须看 `EV` 是否过阈值、`P_adj` 是否稳健、`f_final` 是否被组合约束截断。

### 4.5 文字输出模板

单个信号的输出应包含四句话：

```text
市场定价：该选项当前赔率为 O，去水后市场隐含概率约为 P_market。
模型判断：模型原始概率为 P_model，经过 alpha 收缩后，可用概率为 P_adj。
决策结果：按 P_adj 计算 EV 为 X，分数 Kelly 风险预算为 Y，当前等级为 LEVEL。
风险说明：该建议受哪些风险标签约束，是否因组合暴露、低置信度或玩法不可映射而降级。
```

示例：

```text
市场定价显示，某队受让方向的去水概率约为 37%。模型原始概率为 50%，但考虑到世界杯短样本和市场信息优势，按 40% 模型权重收缩后，可用概率降至 42.2%。在当前赔率 2.50 下，EV 约为 5.5%，四分之一 Kelly 对应风险预算约 0.92%。该信号进入小权重候选，但因其暴露在“弱队受让”和“低节奏比赛”两个因子上，若当日已有同类信号，应优先降权。
```

### 4.6 玩法映射与体彩建议表达（收敛入口）

海外 `SignalCandidate` 通过 Gate 1~6 后，进入 **PlayMapping + 官方二次定价**，产出 **`JingcaiRecommendation`**。完整收敛规则见 **§6**；本节定义决策层与收敛层的接口。

**PlayMapping 中间对象：**

```js
{
  signalMarketType: "h2h",
  signalOutcome: "home",
  mappedPlay: "竞彩足球胜平负",
  mappedOutcome: "胜",
  mappedOutcomeCode: "3",
  officialOdds,
  officialHandicap,
  officialSaleStatus,
  officialStopTime,
  mappingConfidence,
  settlementRuleVersion
}
```

**最终体彩建议对象（对用户可见）：**

```js
{
  fixtureId,
  jingcaiMatchId,
  competition: "2026 FIFA World Cup",
  homeTeam,
  awayTeam,
  kickoffLocal,
  playType: "胜平负",
  selection: "胜",
  selectionCode: "3",
  handicap: null,
  officialOdds: 2.15,
  fairOddsFromModel: 2.28,
  adjustedProbability: 0.422,
  officialExpectedValue: 0.042,
  recommendationLevel: "CANDIDATE",
  suggestedStakeUnits: 1,
  suggestedStakeAmountCny: 2,
  maxStakeUnitsByRisk: 5,
  saleStatus: "on_sale",
  stopSaleTime: "2026-06-15T19:55:00+08:00",
  mappingConfidence: "high",
  overseasSignalSummary: "Pinnacle/Polymarket 聚合盘主胜去水概率 37%，模型收缩后 42.2%",
  jingcaiRecommendationText: "...",
  disclaimers: ["研究建议，非代购", "以终端官方赔率和停售时间为准"]
}
```

**输出原则：**

1. **必须写清玩法与选项**：如「竞彩足球 · 2026 世界杯 · 小组赛 · 阿根廷 vs 某队 · **让球胜平负（-1）· 胜**」。
2. **必须写清官方赔率与 EV**：海外 EV 仅作参考；**对用户展示的 EV 必须用 `officialOdds` 重算**。
3. **必须写清停售时间**：开赛前约 5~30 分钟停售（以中体彩当期公告为准），建议中显式给出 `stopSaleTime`。
4. **禁止越级措辞**：不得使用「必买」「稳胆」「重仓」；`SMALL_POSITION` 对应「可考虑单关小额关注（建议 N 注 × 2 元）」。
5. **映射失败则不出体彩选项**：仅输出海外研究视角 + `noJingcaiReason`（如未入选赛程、玩法未开售、让球数不一致）。

**体彩建议文字模板（在 §4.5 四句话之后追加第五句）：**

```text
体彩收敛：该海外信号映射为竞彩足球【玩法】【选项】，官方赔率 O_off，按 P_adj 重算 EV 为 X_off。销售状态【在售/停售】，停售时间 T_stop。建议等级 LEVEL，参考仓位 N 注×2 元（不超过风险预算）。海外盘与体彩盘存在差异时，以体彩官方数据为准。
```

**示例（完整收敛）：**

```text
【海外研究】Pinnacle + Polymarket 聚合后主胜去水概率约 37%，模型收缩后 42.2%，海外参考 EV 约 +5.5%（O=2.50）。

【体彩建议】本场已入选 2026 世界杯竞彩赛程。映射为「竞彩足球 · 让球胜平负 · 主队（-1）· 胜」，官方赔率 2.15，按 P_adj 重算 EV 约 +4.2%，过安全边际。销售中，停售 6/15 19:55。建议等级：CANDIDATE；参考 1 注（2 元）单关关注，不构成代购指令。若临停售前官方赔率下调至 2.05 以下，EV 将低于阈值，自动降级为 WATCH。
```

**官方赔率变化导致降级：**

```text
海外信号仍有效，但体彩官方赔率更新后 officialEV 已低于安全边际，体彩建议从 CANDIDATE 降级为 WATCH；请仅在官方赔率改善或模型更新后重新评估。
```

## 5. Output：输出层

输出层分 **三层**，由宽到窄收敛；前端默认展示最窄层（体彩建议），可展开查看海外研究细节。

```text
Layer A  海外研究输出（marketSummary / SignalCandidate）
Layer B  映射与二次定价（PlayMapping / officialEV）
Layer C  体彩投注建议（JingcaiRecommendation）  ← 默认主输出
```

当前不执行自动代购；Layer C 为**文字 + 结构化字段**的具体投注建议，用户自行至合法体彩渠道完成购买。

### 5.1 单场分析输出

```js
{
  fixtureId,
  fixture,
  kickoff,
  marketSummary,
  modelSummary,
  mispricingSummary,
  recommendationSummary,
  riskSummary,
  confidence,
  noActionReason
}
```

示例：

```text
【海外研究】本场市场基准显示，主胜概率约为 45%，平局 28%，客胜 27%。模型收缩后主胜 47%，与市场差异不大，海外胜平负暂无明显偏差。

【体彩建议】官方开售「让球胜平负（-1）」；比分矩阵投影后「让球胜」officialEV 约 +3.8%（官方赔率 2.28），等级 CANDIDATE。主推：竞彩足球 · 让球胜平负（-1）· 胜 · 1 注单关（2 元）· 停售 6/18 22:55。若用户仅看胜平负，同场「胜」选项 officialEV 为负，不作主推。

风险：小组形势未明、首发未确认，置信度 medium。海外 Under 2.5 与让球胜方向相关，当日同类暴露需控制。
```

### 5.2 策略候选输出

```js
{
  signalId,
  fixtureId,
  marketType,
  line,
  outcome,
  offeredOdds,
  marketProbability,
  modelProbability,
  adjustedProbability,
  edge,
  relativeEdge,
  expectedValue,
  rawKelly,
  fractionalKelly,
  cappedStakeFraction,
  confidence,
  riskTags,
  decisionCode,
  recommendationLevel,
  recommendationText
}
```

### 5.3 组合输出

组合输出用于说明某一类定价偏差如何被表达。

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

示例：

```text
当前组合主要暴露在“强队难以穿深盘”和“低总进球”两个因子上。虽然单项信号分散在三场比赛，但底层风险高度相关，若强队早段集体进球，组合可能同步受损。因此组合层建议降低同类信号权重，保留观察，不扩大敞口。
```

### 5.4 复盘输出

复盘比预测更重要。每场结束后都应生成复盘记录。

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

复盘文字不要只写“中了/没中”，而要回答：模型概率是否校准、市场是否比模型更早反映信息、偏差来自数据还是模型、这个信号未来应该加强还是降权。

**复盘指标说明：**

- **Brier Score：** 对多类 outcome 的概率预测，计算 `Σ (p_i - y_i)²`，其中 `y_i` 为 0/1 实现指示。越小越好；0 为完美，均匀瞎猜约 0.67（三类）。适合比较 1X2 整体校准。
- **Log Loss：** 对实际发生 outcome 的 `-log(p_actual)`。对低概率却发生的事件惩罚更重，比 Brier 更“严厉”。若给发生项只赋 5% 概率，Log Loss 会显著升高。
- **CLV（Closing Line Value）：** 常用定义之一为 `O_taken - O_closing`（十进制赔率口径，越大说明相对封盘买得越好）。长期 CLV 为正，说明抓取价格优于市场终盘，是策略可持续性的重要指标；单场输赢噪声大，不宜仅凭 CLV 一次判定模型好坏。
- **closingLineValue 字段：** 存储单场信号相对封盘线的数值，供聚合统计“是否系统性买到好价”。
- **calibrationError：** 可定义为 `|p_predicted - y_actual|` 或分桶校准误差（把预测概率分档，看各档实际频率是否接近）。

- **calibrationError：** 可定义为 `|p_predicted - y_actual|` 或分桶校准误差（把预测概率分档，看各档实际频率是否接近）。

### 5.5 体彩投注建议输出（Layer C · 默认主输出）

对 2026 世界杯每场入选竞彩的赛事，在 Layer A 信号存在时，尝试生成 **`JingcaiRecommendation`**。若无可用映射或官方 EV 不足，则 `jingcaiRecommendation: null`，并给出 `noJingcaiReason`。

```js
{
  fixtureId,
  jingcaiMatchId,
  matchLabel: "2026世界杯 小组赛 第2轮",
  homeTeam,
  awayTeam,
  kickoffLocal,
  primaryRecommendation: {
    playType: "让球胜平负",
    handicap: -1,
    selection: "胜",
    selectionCode: "3",
    officialOdds: 2.15,
    officialExpectedValue: 0.042,
    recommendationLevel: "CANDIDATE",
    suggestedStakeUnits: 1,
    suggestedStakeAmountCny: 2,
    stopSaleTime,
    recommendationText
  },
  alternativeRecommendations: [],
  overseasContext: {
    signalMarketType: "spread",
    overseasLine: -1.0,
    overseasExpectedValue: 0.055,
    recommendationLevel: "SMALL_POSITION"
  },
  noJingcaiReason: null,
  disclaimers
}
```

**字段约定：**

- **`suggestedStakeUnits`：** 整数注数，每注 2 元；由 `f_final` 与风险预算换算，且受单票上限（官方单票最高 20000 元）约束。
- **`alternativeRecommendations`：** 同场其他玩法但等级更低的备选（如比分、半全场），默认不并列主推，避免方差叠加。
- **`overseasContext`：** 保留海外研究上下文，供用户理解「为何映射到此体彩选项」，但不替代 Layer C 决策。

**单场无体彩建议时的输出示例：**

```text
【海外研究 WATCH】主胜方向海外 EV 略正，但本场尚未入选竞彩足球销售赛程（noJingcaiReason: not_in_jingcai_schedule）。暂无体彩具体选项，请仅作市场研究参考。
```

## 6. 从海外盘收敛到中国体育彩票（2026 世界杯）投注建议

本章定义 **Layer A → Layer C** 的完整收敛规则。2026 世界杯期间，中体彩中心通常将「国际重要足球赛事」纳入竞彩足球销售范围；**是否开售、开售玩法、让球数、赔率与停售时间均以当期官方公布为准**，本系统通过 `JingcaiOfficialFeed` 接入，不得硬编码赛程。

### 6.1 收敛链路（七步）

```text
Step 1  海外多源快照聚合 -> P_market, P_model, P_adj（§3）
Step 2  海外 EV/Kelly + 六道 Gate -> SignalCandidate（§4）
Step 3  查询本场是否入选竞彩赛程 + 已开售玩法列表
Step 4  海外 signal -> 竞彩 (playType, handicap, selection) 映射
Step 5  读取体彩官方赔率 O_off，用 P_adj 重算 officialEV / officialKelly
Step 6  体彩专属 Gate（销售状态、停售时间、让球一致、EV_off > θ_off）
Step 7  生成 JingcaiRecommendation + 文字建议（注数×2元、单关/过关类型）
```

**收敛原则：** 海外有信号 ≠ 体彩有建议。Step 3~6 任一失败，Layer C 为空或降级，Layer A 仍可保留。

### 6.2 合规边界与产品定位

| 项目 | 要求 |
|------|------|
| 合法渠道 | 仅引用 **中国体育彩票 · 竞彩足球** 公开玩法与规则 |
| 发行主体 | 国家体育总局体育彩票管理中心（中体彩中心）组织管理 |
| 系统角色 | 研究工具 + 建议生成；**不代购、不支付、不连接投注接口** |
| 用户动作 | 自行至体彩实体店或官方授权终端购买 |
| 未成年人 | 不得向未成年人出售彩票（规则要求；产品侧需年龄提示） |
| 免责声明 | 每条 Layer C 输出必须含「研究建议，非投注指令」 |

海外盘（Pinnacle、Bet365、Polymarket 等）在本项目中定位为 **定价参考与模型输入**，不作为中国大陆用户的最终购买价格。

### 6.3 2026 世界杯竞彩足球可售玩法

世界杯入选竞彩后，常见可映射玩法如下（与海外 `marketType` 对应）：

| 竞彩玩法 | 官方说明要点 | 海外主要来源 | 2026 世界杯优先级 |
|----------|--------------|--------------|-------------------|
| **胜平负** | 90 分钟（含伤停补时）主胜/平/负；赛果 3/1/0 | `h2h` | **P0 核心** |
| **让球胜平负** | 官方公布让球数（整数）；调整后净胜球定 3/1/0 | `spread`（亚洲盘） | **P0 核心** |
| **总进球数** | 离散档位：0~7 球及 7+ | `total`（O/U 线） | **P1** |
| **比分** | 精确比分选项（含「胜其他」「平其他」「负其他」） | `correct_score` | **P2 观察** |
| **半全场胜平负** | 半场 3/1/0 × 全场 3/1/0，共 9 项 | `half_full_time` | **P2 观察** |

**不纳入 Layer C 的海外信号：**

- `qualification`（晋级）、`outright`（冠军/小组第一）—— 竞彩单场玩法通常无直接对应；可保留 Layer A 研究。
- 滚球、角球、黄牌等衍生盘 —— 竞彩足球标准玩法不包含。
- 加时/点球结果 —— 竞彩标准玩法按 **90 分钟含伤停补时** 结算，与淘汰赛「晋级」问题不同。

**结算口径（与海外 1X2 对齐部分）：**

- 竞彩足球胜平负 / 让球胜平负 / 总进球数 / 比分 / 半全场，均以 **全场 90 分钟 + 伤停补时** 为准。
- **不含加时赛及点球大战**（若比赛进入加时，仍按 90 分钟比分结算竞彩标准玩法）。
- 世界杯中立场：竞彩仍标注主客队；`neutralVenue` 只影响模型，不改变竞彩主客字段。

### 6.4 海外信号 → 竞彩选项映射规则

#### 6.4.1 胜平负（h2h → 竞彩胜平负）

| 海外 outcome | 竞彩选项 | 代码 |
|--------------|----------|------|
| home | 胜 | 3 |
| draw | 平 | 1 |
| away | 负 | 0 |

**条件：** 该场开售「胜平负」玩法；海外 1X2 与竞彩主客定义一致。

#### 6.4.2 让球（spread → 竞彩让球胜平负）

竞彩让球数 **只能使用官方公布值** `H_off ∈ {…,-2,-1,+1,+2,…}`，不能直接把 Pinnacle -0.75 / -1.25 等亚洲四分盘线当作竞彩让球。

**映射算法：**

1. 从 `JingcaiOfficialFeed` 读取本场 `H_off`。
2. 在比分矩阵上计算竞彩让球后的 3/1/0 概率：`P_jc(3/1/0 | H_off)`（见 §3.4 让球投影，`L = H_off`）。
3. 海外 signal 的 `line` 与 `H_off` 不一致时：
   - 若 `|line - H_off| ≥ 1`：`mappingConfidence = low`，默认 **不输出 Layer C**；
   - 若相差 0.5 以内：用 `P_jc(·|H_off)` 重算模型侧概率，海外 Edge 仅作参考。
4. 选择 `officialEV` 最大的竞彩选项（3/1/0 之一）作为候选，仍须过 Gate 6。

**竞彩让球判定示例（主队让 1 球，即 `-1`）：**

```text
实际比分 2:1 -> 调整后 1:1 -> 平（1）
实际比分 3:1 -> 调整后 2:1 -> 胜（3）
实际比分 1:1 -> 调整后 0:1 -> 负（0）
```

#### 6.4.3 大小球（total → 竞彩总进球数）

海外连续线（如 Over 2.5）→ 竞彩离散档位：

```text
P(总进球 = k) = Σ_{i+j=k} P(i,j)   （k = 0,1,…,6）
P(7+) = Σ_{i+j≥7} P(i,j)
```

将 Over 2.5 的模型概率 **分配/比较** 到 `{2球, 3球, 4球, …}` 档位，选取与海外 signal 方向一致且 `officialEV` 最高的 **单一档位** 作为 Layer C 输出。禁止把 2.5 球 Over 直接写成「买 2 球」 unless 模型对 2 球赋予最高正 EV。

**优先级：** 总进球数方差大、档位多；2026 世界杯 **默认主推胜平负/让球**，总进球数为 P1 备选。

#### 6.4.4 比分与半全场

- **比分：** 仅当 `P(i,j)` 单格 `officialEV` 过阈值且 `mappingConfidence = high` 时输出；默认 `recommendationLevel ≤ CANDIDATE`，不建议作为单场主推。
- **半全场：** 用 §3.4 半场近似矩阵计算 9 格概率；与海外半全场 line 一致时方可映射。

### 6.5 官方赔率二次定价

海外 Gate 4 使用 `O_overseas`；**体彩 Gate 使用 `O_official`**：

```math
EV_{official} = P^{adj} \cdot O_{official} - 1
```

```math
f^*_{official} = \frac{(O_{official}-1)P^{adj}-(1-P^{adj})}{O_{official}-1}
```

**关键规则：**

- Layer C 的 `recommendationLevel` **只认 `EV_official` 与 `f*_official`**。
- 若 `EV_overseas > θ` 但 `EV_official ≤ θ_off`：Layer A = CANDIDATE/SMALL_POSITION，Layer C = WATCH 或 null。
- `fairOddsFromModel = 1 / P_adj`：当 `O_official < fairOddsFromModel` 时，体彩端无优势，映射失效。
- 体彩赔率更新频率低于 Pinnacle；**临停售前必须刷新 `O_official`**，否则 `decisionCode = skip_stale_official_odds`。

### 6.6 体彩专属 Gate（Step 6）

在 §4.2 六道 Gate 之上，Layer C 额外执行：

```js
if (!inJingcaiSchedule) code = "skip_not_in_schedule";
else if (!playOnSale) code = "skip_play_not_on_sale";
else if (mappingConfidence !== "high") code = "skip_mapping_low_confidence";
else if (officialOddsMissing) code = "skip_no_official_odds";
else if (now >= stopSaleTime) code = "skip_past_stop_sale";
else if (EV_official <= evThresholdOff) code = "watch_official_ev_low";
else if (rawKellyOfficial <= 0) code = "skip_official_negative_kelly";
else if (riskCapBreached) code = "skip_risk_cap";
else code = "jingcai_candidate_ok";
```

### 6.7 注数、单关与过关

**第一阶段（2026 世界杯 MVP）：仅输出单关建议。**

| 概念 | 规则 |
|------|------|
| 单注金额 | 2 元人民币 |
| 单关 | 1 场比赛 1 种玩法 1 个选项 |
| 建议注数 | `suggestedStakeUnits = max(1, floor(f_final / stakeUnitFraction))`，且 ≤ `maxStakeUnitsByRisk` |
| 单票上限 | 官方单票最高 20000 元（10000 注）；系统建议应远低于此 |
| 过关 | Phase 2+；若做串关须单独 `ParlayRecommendation`，组合概率相乘、方差放大，默认关闭 |

**过关约束备忘（Phase 2）：** 胜平负/让球胜平负自由过关最多 8 关；总进球数最多 6 关；比分/半全场最多 4 关；混合过关以最低关次为准。**MVP 不生成过关建议。**

### 6.8 官方数据源（JingcaiOfficialFeed）

实现层需维护与当期官方一致的只读 feed（来源由产品配置，如竞彩网公开赛程/赔率 API 或经合规授权的数据服务）：

```js
{
  jingcaiMatchId,
  fixtureId,
  competition: "2026 FIFA World Cup",
  stage,
  homeTeam,
  awayTeam,
  kickoffLocal,
  saleStatus: "on_sale" | "stopped" | "not_listed",
  stopSaleTime,
  availablePlays: {
    spf: { onSale, odds: { "3", "1", "0" } },
    rqspf: { onSale, handicap: -1, odds: { "3", "1", "0" } },
    zjq: { onSale, odds: { "0", "1", ..., "7+" } },
    bf: { onSale, odds: { ... } },
    bqc: { onSale, odds: { ... } }
  },
  ruleVersion: "2026-jczq-football",
  fetchedAt
}
```

**世界杯主客与中立场：** feed 中主客队以官方登记为准；模型侧 `neutralVenue` 不改变 feed 字段。

### 6.9 完整收敛数值示例

**设定：** 2026 世界杯小组赛，阿根廷（主）vs 对手；海外 Pinnacle 主 -1 亚洲盘主胜隐含 42%；模型 `P_model=48%`，`P_market=42%`，`α=0.4` → `P_adj=44.4%`。

**Step 1~2（海外）：** 海外 `O=2.38`，`EV_overseas=+5.7%`，过 Gate → `overseasSignalLevel = SMALL_POSITION`。

**Step 3~4（映射）：** 官方公布让球 **主 -1**，开售让球胜平负；比分矩阵算得「让球胜（3）」概率 44.4%，与 signal 一致，`mappingConfidence = high`。

**Step 5~6（体彩定价）：** 官方「让球胜」赔率 `O_off=2.12` → `EV_official = 0.444×2.12-1 = -5.9%` **为负**。

**Step 7（输出）：**

```text
【海外研究 · SMALL_POSITION】主让 -1 方向海外盘 EV 约 +5.7%（O=2.38）。

【体彩建议 · 无主推】映射玩法「让球胜平负（-1）· 胜」官方赔率 2.12，按 P_adj 重算 EV 为负，不满足体彩安全边际。noJingcaiReason: watch_official_ev_low。建议：WATCH，临停售前若官方赔率升至 2.30 以上可重新评估。
```

此例说明：**海外收敛到体彩时，官方赔率劣于海外是常态**；Layer C 必须诚实为空或 WATCH，不能照搬海外 SMALL_POSITION。

**反例（体彩 EV 为正）：** 若 `O_off=2.35`，则 `EV_official=+4.4%`，过阈值 →

```text
【体彩建议 · CANDIDATE】竞彩足球 · 2026世界杯 · 阿根廷 vs XX · 让球胜平负（-1）· 胜 · 官方赔率 2.35 · EV_off +4.4% · 停售 6/20 23:25 · 参考 1 注单关（2 元）。研究建议，请自行至体彩渠道购买。
```

### 6.10 海外盘 vs 竞彩差异（收敛时必检）

| 维度 | 海外庄家/预测市场 | 中国竞彩足球 |
|------|-------------------|--------------|
| 让球 | 亚洲盘多线（-0.5/-1/-1.25…） | 官方单一整数让球 |
| 大小球 | 连续线 2.5/2.75/3.0 | 总进球数离散 0~7+ |
| 赔率 | Pinnacle 等 sharp 线 | 官方 SP，更新较慢 |
| 结算 | 多为 90 分钟 | 90 分钟 + 伤停补时（标准玩法） |
| 销售 | 24/7 在线 | 赛程公告 + 停售前 5~30 分钟截止 |
| 串关 | 自行组合 | 官方过关规则与关次上限 |

映射层必须输出 `mappingConfidence` 与 `mappingNotes`（如「海外 -0.75 近似映射官方 -1，存在半球偏差」）。低置信度 **禁止** 输出 Layer C 主推。

### 6.11 结算与复盘（竞彩口径）

赛后复盘除 §5.4 指标外，增加：

```js
{
  jingcaiSettlement: {
    playType,
    selection,
    handicap,
    officialOddsAtRecommendation,
    officialOddsAtStopSale,
    resultCode: "3" | "1" | "0" | "won" | "lost",
    stakeUnits,
    payoutMultiple,
    realizedReturnOfficial
  }
}
```

复盘问题扩展为：**海外 CLV 是否为正、体彩 officialEV 预测是否校准、映射是否因让球差异系统性偏差、体彩赔率相对海外折价多少**。

## 7. 第一阶段最小可实现版本

建议第一阶段实现 **海外研究 → 体彩单关建议** 闭环：

```text
输入：海外 h2h / spread / total 快照 + JingcaiOfficialFeed（2026 世界杯赛程/赔率）
计算：去水概率 + 市场聚合 + 简单双泊松比分矩阵
定价：胜平负、让球、大小球（海外）+ 竞彩让球/胜平负投影（官方 H_off）
信号：edge、EV、P_adj、Kelly、置信度（海外层）
收敛：PlayMapping + officialEV + 体彩专属 Gate
输出：JingcaiRecommendation（单关 · 主推胜平负/让球胜平负）+ 海外研究摘要
复盘：赛果结算（竞彩口径）+ Brier + LogLoss + CLV + officialReturn
```

**Phase 1 体彩输出范围：**

- ✅ 胜平负、让球胜平负的单关具体建议（含玩法、选项、官方赔率、建议注数、停售时间）
- ✅ 海外 vs 体彩 EV 对比与 noJingcaiReason 降级
- ⏸ 总进球数 / 比分 / 半全场（仅 Layer A，或 Layer C 备选）
- ❌ 过关/串关建议、自动代购、滚球

暂时不要做：复杂机器学习模型、滚球高频交易、自动下单、大规模串关优化、LLM 直接生成概率。

## 8. 推荐工程落地模块

```text
src/quant/odds/devig.js
src/quant/models/score-matrix.js
src/quant/pricing/h2h.js
src/quant/pricing/spread.js
src/quant/pricing/total.js
src/quant/pricing/jingcai-rqspf.js          # 竞彩让球 3/1/0 投影
src/quant/pricing/jingcai-zjq.js            # 总进球数档位投影
src/quant/edge/ev.js
src/quant/recommendation/decision-layer.js
src/quant/recommendation/play-mapping.js    # 海外 -> 竞彩玩法映射
src/quant/recommendation/jingcai-gates.js   # 体彩专属 Gate + officialEV
src/quant/portfolio/kelly.js
src/quant/portfolio/exposure.js
src/quant/backtest/settlement.js
src/quant/backtest/jingcai-settlement.js    # 竞彩赛果结算
src/quant/output/text-summary.js
src/quant/output/jingcai-recommendation.js  # Layer C 文案与 schema
providers/jingcai/official-feed.js          # JingcaiOfficialFeed 适配器
```

现有 dashboard 可以继续作为展示层，但应逐步从 `market-pipeline.js` 的启发式逻辑迁移到 `src/quant/` 的结构化结果。**前端主卡片应展示 `JingcaiRecommendation`**，海外 `SignalCandidate` 作为「展开研究依据」。

## 附录 A：符号表与公式速查

| 符号 | 名称 | 说明 |
|------|------|------|
| `O`, `O_i` | 十进制赔率 | 可买价格 |
| `q_i` | 原始隐含概率 | `1/O_i`，含 Margin |
| `M` | Margin / Overround | `Σq_i - 1` |
| `p_i^{market}` | 去水市场概率 | 比例去水后，Σ=1 |
| `P(i,j)` | 比分联合概率 | 主队 i 球、客队 j 球 |
| `λ_h, λ_a` | 泊松强度 | 预期进球参数 |
| `L` | 盘口线 | 让球或大小球线 |
| `P^{model}` | 模型原始概率 | 结构模型输出 |
| `P^{adj}` | 收缩概率 | `αP_model + (1-α)P_market` |
| `α` | 模型信任度 | 0~1，早期宜偏低 |
| `θ` | EV 安全边际 | 进入强候选的最小 EV |
| `Edge` | 绝对边缘 | 概率差 |
| `EV` | 期望收益率 | `P·O - 1`（用 `P_adj`） |
| `f*` | 全 Kelly 比例 | 理论最优仓位 |
| `c` | Kelly 分数 | 如 0.25 |
| `f_final` | 最终仓位上限 | 经 cap 截断后 |
| `O_official` | 体彩官方 SP 赔率 | Layer C 定价唯一依据 |
| `EV_official` | 体彩期望收益 | `P_adj·O_official - 1` |
| `H_off` | 竞彩官方让球数 | 整数，来自 JingcaiOfficialFeed |
| `JingcaiRecommendation` | 体彩投注建议 | Layer C 最终输出 |

**核心公式链（决策层必按此顺序）：**

```text
# 海外研究层
q_i = 1/O_i  →  p_i = q_i/Σq  →  P_adj = αP_model + (1-α)p_market
EV_overseas = P_adj·O_overseas - 1  →  六道 Gate  →  SignalCandidate

# 体彩收敛层
PlayMapping(signal → playType, selection, H_off)
EV_official = P_adj·O_official - 1  →  体彩 Gate  →  JingcaiRecommendation
f_final = min(c·f*_official, caps...)  →  suggestedStakeUnits（×2 元）
```

## 附录 B：延伸阅读与常见误区

**常见误区：**

1. **把隐含概率当真实概率：** 去水前或单一庄家盘的 `1/O` 不能直接与模型比。
2. **裸模型 Edge 直接下注：** 必须经过 `P_adj` 与 Gate；世界杯样本短，过度自信是最大风险。
3. **忽视玩法相关性：** 同场 Under 与让球受让方向往往同向；组合层不控因子会重复下注同一故事。
4. **用赛果反推赛前模型：** 训练或调参若混入赛后信息，回测会虚高。
5. **CLV 与命中率混谈：** 短期命中靠运气；长期 CLV 与校准度更反映研究质量。
6. **LLM 输出当概率：** LLM 适合解释结构化特征，不应替代 `P^{model}` 的数值来源。

**与实现对应的阅读顺序：**

1. §1.1 术语 → §2.2 盘口 schema → §3.1~3.4 去水与比分矩阵
2. §3.5~3.7 Edge/EV/Kelly → §4 决策层 → §5 输出（**§5.5 体彩建议**）
3. **§6 海外盘 → 体彩收敛（核心）** → §7 MVP → §8 模块路径
4. 分阶段落地与 pick-up：**[QUANT_IMPLEMENTATION_PLAN.md](./QUANT_IMPLEMENTATION_PLAN.md)**

**收敛相关常见误区（补充）：**

7. **把海外 SMALL_POSITION 直接当体彩建议：** 必须重算 `EV_official`；体彩赔率常折价。
8. **忽略官方让球数：** 海外 -0.75 与竞彩 -1 不是同一事件；须用 `H_off` 重投影。
9. **未检停售时间：** 开赛前数分钟停售，过期建议必须失效。
10. **把 research 信号写成代购指令：** Layer C 只能是「参考 N 注单关」，用户自行购买。