export const mockExpertOpinions = [
  {
    fixtureId: 1,
    fixture: "墨西哥 vs 日本",
    sourceType: "expert_opinions",
    opinions: [
      {
        pundit: "詹俊",
        region: "CN",
        stance: "slight_home",
        confidence: "medium",
        capturedAt: "2026-06-05T13:40:00+08:00",
        summary: "更看好主场氛围和比赛节奏优势，倾向墨西哥不败。",
        signalTags: ["主场", "节奏", "开赛氛围"],
      },
      {
        pundit: "张路",
        region: "CN",
        stance: "balanced",
        confidence: "medium",
        capturedAt: "2026-06-05T13:52:00+08:00",
        summary: "强调日本的组织性和反击效率，认为这场平局概率不低。",
        signalTags: ["组织性", "反击", "平局倾向"],
      },
    ],
  },
  {
    fixtureId: 2,
    fixture: "美国 vs 摩洛哥",
    sourceType: "expert_opinions",
    opinions: [
      {
        pundit: "海外编辑台",
        region: "Global",
        stance: "balanced",
        confidence: "low",
        capturedAt: "2026-06-05T14:05:00+08:00",
        summary: "双方都没有绝对压制力，更像一场取决于临场状态的均势对决。",
        signalTags: ["均势", "临场状态", "分歧高"],
      },
    ],
  },
];
