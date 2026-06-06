export const mockModelingSteps = [
  {
    step: "Step 1",
    title: "统一抓取源",
    text: "先把赔率源、Polymarket 和实时比分源整理成统一 schema，所有记录都带来源名、抓取时间和赛事 id。",
  },
  {
    step: "Step 2",
    title: "生成 market baseline",
    text: "对 1X2 概率去水后做加权平均，再把预测市场概率映射进同一胜平负空间，得到最稳的基准预测。",
  },
  {
    step: "Step 3",
    title: "做轻量校准层",
    text: "用逻辑回归、梯度提升树或 ELO 衍生特征来校准 baseline，而不是直接让黑盒模型从零猜结果。",
  },
  {
    step: "Step 4",
    title: "让 LLM 负责解释",
    text: "LLM 输入结构化特征和概率变化，输出“为什么变”“哪里和市场分歧最大”“赛后怎么看错了”。",
  },
];
