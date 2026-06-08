/** ISO 3166-1 alpha-2（英格兰/苏格兰用 flagcdn 分区码） */
const TEAM_FLAG_CODES = {
  Algeria: "dz",
  阿尔及利亚: "dz",
  Argentina: "ar",
  阿根廷: "ar",
  Australia: "au",
  澳大利亚: "au",
  Austria: "at",
  奥地利: "at",
  Belgium: "be",
  比利时: "be",
  "Bosnia & Herzegovina": "ba",
  "Bosnia-Herzegovina": "ba",
  波黑: "ba",
  Canada: "ca",
  加拿大: "ca",
  Colombia: "co",
  哥伦比亚: "co",
  Croatia: "hr",
  克罗地亚: "hr",
  Curaçao: "cw",
  库拉索: "cw",
  "Cape Verde": "cv",
  "Cape Verde Islands": "cv",
  佛得角: "cv",
  Czechia: "cz",
  "Czech Republic": "cz",
  捷克: "cz",
  Ecuador: "ec",
  厄瓜多尔: "ec",
  Egypt: "eg",
  埃及: "eg",
  England: "gb-eng",
  英格兰: "gb-eng",
  France: "fr",
  法国: "fr",
  Germany: "de",
  德国: "de",
  Ghana: "gh",
  加纳: "gh",
  Haiti: "ht",
  海地: "ht",
  Iran: "ir",
  伊朗: "ir",
  Iraq: "iq",
  伊拉克: "iq",
  "Ivory Coast": "ci",
  "Côte d'Ivoire": "ci",
  科特迪瓦: "ci",
  Japan: "jp",
  日本: "jp",
  Jordan: "jo",
  约旦: "jo",
  Mexico: "mx",
  墨西哥: "mx",
  Morocco: "ma",
  摩洛哥: "ma",
  Netherlands: "nl",
  荷兰: "nl",
  "New Zealand": "nz",
  新西兰: "nz",
  Norway: "no",
  挪威: "no",
  Panama: "pa",
  巴拿马: "pa",
  Paraguay: "py",
  巴拉圭: "py",
  Portugal: "pt",
  葡萄牙: "pt",
  Qatar: "qa",
  卡塔尔: "qa",
  "Saudi Arabia": "sa",
  沙特阿拉伯: "sa",
  Scotland: "gb-sct",
  苏格兰: "gb-sct",
  Senegal: "sn",
  塞内加尔: "sn",
  "South Africa": "za",
  南非: "za",
  "South Korea": "kr",
  韩国: "kr",
  Spain: "es",
  西班牙: "es",
  Sweden: "se",
  瑞典: "se",
  Switzerland: "ch",
  瑞士: "ch",
  Tunisia: "tn",
  突尼斯: "tn",
  Turkey: "tr",
  土耳其: "tr",
  Uruguay: "uy",
  乌拉圭: "uy",
  Uzbekistan: "uz",
  乌兹别克斯坦: "uz",
  "United States": "us",
  USA: "us",
  美国: "us",
  "DR Congo": "cd",
  "Congo DR": "cd",
  "刚果（金）": "cd",
};

const DEFAULT_FLAG_CDN = "https://flagcdn.com";
const ALLOWED_WIDTHS = new Set([20, 40, 80, 160, 320]);

export function getTeamFlagCode(teamName) {
  const trimmed = String(teamName || "").trim();
  if (!trimmed || trimmed.includes("待定")) {
    return null;
  }
  return TEAM_FLAG_CODES[trimmed] || null;
}

export function getTeamFlagUrl(teamName, { width = 40, cdnBase = DEFAULT_FLAG_CDN } = {}) {
  const code = getTeamFlagCode(teamName);
  if (!code) {
    return null;
  }
  const size = ALLOWED_WIDTHS.has(width) ? width : 40;
  return `${cdnBase.replace(/\/$/, "")}/w${size}/${code}.png`;
}

export function splitFixtureTeams(fixtureLabel) {
  const text = String(fixtureLabel || "").trim();
  if (!text) {
    return { home: "", away: "" };
  }
  const parts = text.split(/\s+vs\s+/i);
  if (parts.length >= 2) {
    return { home: parts[0].trim(), away: parts.slice(1).join(" vs ").trim() };
  }
  return { home: text, away: "" };
}
