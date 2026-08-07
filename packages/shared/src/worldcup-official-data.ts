export type WorldCupOfficialTeamSeed = {
  id: string;
  code: string;
  nameEn: string;
  group: string;
  worldRanking: number;
  participations: number;
};

export type WorldCupOfficialMatchSeed = {
  dateLabel: string;
  homeCode: string;
  time: string;
  awayCode: string;
  group: string;
  venue: string;
  city: string;
};

export const worldCupOfficialTeamSeeds: WorldCupOfficialTeamSeed[] = [
  { id: "canada", code: "CAN", nameEn: "Canada", group: "Group B", worldRanking: 30, participations: 2 },
  { id: "mexico", code: "MEX", nameEn: "Mexico", group: "Group A", worldRanking: 15, participations: 17 },
  { id: "usa", code: "USA", nameEn: "USA", group: "Group D", worldRanking: 16, participations: 11 },
  { id: "algeria", code: "ALG", nameEn: "Algeria", group: "Group J", worldRanking: 28, participations: 4 },
  { id: "argentina", code: "ARG", nameEn: "Argentina", group: "Group J", worldRanking: 3, participations: 18 },
  { id: "australia", code: "AUS", nameEn: "Australia", group: "Group D", worldRanking: 27, participations: 6 },
  { id: "austria", code: "AUT", nameEn: "Austria", group: "Group J", worldRanking: 24, participations: 7 },
  { id: "belgium", code: "BEL", nameEn: "Belgium", group: "Group G", worldRanking: 9, participations: 13 },
  { id: "bosnia-herzegovina", code: "BIH", nameEn: "Bosnia and Herzegovina", group: "Group B", worldRanking: 65, participations: 1 },
  { id: "brazil", code: "BRA", nameEn: "Brazil", group: "Group C", worldRanking: 6, participations: 22 },
  { id: "cabo-verde", code: "CPV", nameEn: "Cabo Verde", group: "Group H", worldRanking: 69, participations: 0 },
  { id: "colombia", code: "COL", nameEn: "Colombia", group: "Group K", worldRanking: 13, participations: 6 },
  { id: "congo-dr", code: "COD", nameEn: "Congo DR", group: "Group K", worldRanking: 46, participations: 1 },
  { id: "cote-divoire", code: "CIV", nameEn: "Cote d'Ivoire", group: "Group E", worldRanking: 34, participations: 3 },
  { id: "croatia", code: "CRO", nameEn: "Croatia", group: "Group L", worldRanking: 11, participations: 6 },
  { id: "curacao", code: "CUW", nameEn: "Curacao", group: "Group E", worldRanking: 82, participations: 0 },
  { id: "czechia", code: "CZE", nameEn: "Czechia", group: "Group A", worldRanking: 41, participations: 9 },
  { id: "ecuador", code: "ECU", nameEn: "Ecuador", group: "Group E", worldRanking: 23, participations: 4 },
  { id: "egypt", code: "EGY", nameEn: "Egypt", group: "Group G", worldRanking: 29, participations: 3 },
  { id: "england", code: "ENG", nameEn: "England", group: "Group L", worldRanking: 4, participations: 16 },
  { id: "france", code: "FRA", nameEn: "France", group: "Group I", worldRanking: 1, participations: 16 },
  { id: "germany", code: "GER", nameEn: "Germany", group: "Group E", worldRanking: 10, participations: 20 },
  { id: "ghana", code: "GHA", nameEn: "Ghana", group: "Group L", worldRanking: 74, participations: 4 },
  { id: "haiti", code: "HAI", nameEn: "Haiti", group: "Group C", worldRanking: 83, participations: 1 },
  { id: "ir-iran", code: "IRN", nameEn: "IR Iran", group: "Group G", worldRanking: 21, participations: 6 },
  { id: "iraq", code: "IRQ", nameEn: "Iraq", group: "Group I", worldRanking: 57, participations: 1 },
  { id: "japan", code: "JPN", nameEn: "Japan", group: "Group F", worldRanking: 18, participations: 7 },
  { id: "jordan", code: "JOR", nameEn: "Jordan", group: "Group J", worldRanking: 63, participations: 0 },
  { id: "korea-republic", code: "KOR", nameEn: "Korea Republic", group: "Group A", worldRanking: 25, participations: 10 },
  { id: "morocco", code: "MAR", nameEn: "Morocco", group: "Group C", worldRanking: 8, participations: 6 },
  { id: "netherlands", code: "NED", nameEn: "Netherlands", group: "Group F", worldRanking: 7, participations: 10 },
  { id: "new-zealand", code: "NZL", nameEn: "New Zealand", group: "Group G", worldRanking: 85, participations: 2 },
  { id: "norway", code: "NOR", nameEn: "Norway", group: "Group I", worldRanking: 31, participations: 3 },
  { id: "panama", code: "PAN", nameEn: "Panama", group: "Group L", worldRanking: 33, participations: 1 },
  { id: "paraguay", code: "PAR", nameEn: "Paraguay", group: "Group D", worldRanking: 40, participations: 8 },
  { id: "portugal", code: "POR", nameEn: "Portugal", group: "Group K", worldRanking: 5, participations: 8 },
  { id: "qatar", code: "QAT", nameEn: "Qatar", group: "Group B", worldRanking: 55, participations: 1 },
  { id: "saudi-arabia", code: "KSA", nameEn: "Saudi Arabia", group: "Group H", worldRanking: 61, participations: 6 },
  { id: "scotland", code: "SCO", nameEn: "Scotland", group: "Group C", worldRanking: 43, participations: 7 },
  { id: "senegal", code: "SEN", nameEn: "Senegal", group: "Group I", worldRanking: 14, participations: 3 },
  { id: "south-africa", code: "RSA", nameEn: "South Africa", group: "Group A", worldRanking: 60, participations: 3 },
  { id: "spain", code: "ESP", nameEn: "Spain", group: "Group H", worldRanking: 2, participations: 16 },
  { id: "sweden", code: "SWE", nameEn: "Sweden", group: "Group F", worldRanking: 38, participations: 12 },
  { id: "switzerland", code: "SUI", nameEn: "Switzerland", group: "Group B", worldRanking: 19, participations: 12 },
  { id: "tunisia", code: "TUN", nameEn: "Tunisia", group: "Group F", worldRanking: 44, participations: 6 },
  { id: "turkiye", code: "TUR", nameEn: "Turkiye", group: "Group D", worldRanking: 22, participations: 2 },
  { id: "uruguay", code: "URU", nameEn: "Uruguay", group: "Group H", worldRanking: 17, participations: 14 },
  { id: "uzbekistan", code: "UZB", nameEn: "Uzbekistan", group: "Group K", worldRanking: 50, participations: 0 }
];

export const worldCupOfficialMatchSeeds: WorldCupOfficialMatchSeed[] = [
  { dateLabel: "Thursday 11 June 2026", homeCode: "MEX", time: "22:00", awayCode: "RSA", group: "Group A", venue: "Mexico City Stadium", city: "Mexico City" },
  { dateLabel: "Friday 12 June 2026", homeCode: "KOR", time: "05:00", awayCode: "CZE", group: "Group A", venue: "Guadalajara Stadium", city: "Guadalajara" },
  { dateLabel: "Friday 12 June 2026", homeCode: "CAN", time: "22:00", awayCode: "BIH", group: "Group B", venue: "Toronto Stadium", city: "Toronto" },
  { dateLabel: "Saturday 13 June 2026", homeCode: "USA", time: "04:00", awayCode: "PAR", group: "Group D", venue: "Los Angeles Stadium", city: "Los Angeles" },
  { dateLabel: "Saturday 13 June 2026", homeCode: "QAT", time: "22:00", awayCode: "SUI", group: "Group B", venue: "San Francisco Bay Area Stadium", city: "San Francisco Bay Area" },
  { dateLabel: "Sunday 14 June 2026", homeCode: "BRA", time: "01:00", awayCode: "MAR", group: "Group C", venue: "New York/New Jersey Stadium", city: "New York" },
  { dateLabel: "Sunday 14 June 2026", homeCode: "HAI", time: "04:00", awayCode: "SCO", group: "Group C", venue: "Boston Stadium", city: "Boston" },
  { dateLabel: "Sunday 14 June 2026", homeCode: "AUS", time: "07:00", awayCode: "TUR", group: "Group D", venue: "BC Place Vancouver", city: "Vancouver" },
  { dateLabel: "Sunday 14 June 2026", homeCode: "GER", time: "20:00", awayCode: "CUW", group: "Group E", venue: "Houston Stadium", city: "Houston" },
  { dateLabel: "Sunday 14 June 2026", homeCode: "NED", time: "23:00", awayCode: "JPN", group: "Group F", venue: "Dallas Stadium", city: "Dallas" },
  { dateLabel: "Monday 15 June 2026", homeCode: "CIV", time: "02:00", awayCode: "ECU", group: "Group E", venue: "Philadelphia Stadium", city: "Philadelphia" },
  { dateLabel: "Monday 15 June 2026", homeCode: "SWE", time: "05:00", awayCode: "TUN", group: "Group F", venue: "Monterrey Stadium", city: "Monterrey" },
  { dateLabel: "Monday 15 June 2026", homeCode: "ESP", time: "19:00", awayCode: "CPV", group: "Group H", venue: "Atlanta Stadium", city: "Atlanta" },
  { dateLabel: "Monday 15 June 2026", homeCode: "BEL", time: "22:00", awayCode: "EGY", group: "Group G", venue: "Seattle Stadium", city: "Seattle" },
  { dateLabel: "Tuesday 16 June 2026", homeCode: "KSA", time: "01:00", awayCode: "URU", group: "Group H", venue: "Miami Stadium", city: "Miami" },
  { dateLabel: "Tuesday 16 June 2026", homeCode: "IRN", time: "04:00", awayCode: "NZL", group: "Group G", venue: "Los Angeles Stadium", city: "Los Angeles" },
  { dateLabel: "Tuesday 16 June 2026", homeCode: "FRA", time: "22:00", awayCode: "SEN", group: "Group I", venue: "New York/New Jersey Stadium", city: "New York" },
  { dateLabel: "Wednesday 17 June 2026", homeCode: "IRQ", time: "01:00", awayCode: "NOR", group: "Group I", venue: "Boston Stadium", city: "Boston" },
  { dateLabel: "Wednesday 17 June 2026", homeCode: "ARG", time: "04:00", awayCode: "ALG", group: "Group J", venue: "Kansas City Stadium", city: "Kansas City" },
  { dateLabel: "Wednesday 17 June 2026", homeCode: "AUT", time: "07:00", awayCode: "JOR", group: "Group J", venue: "San Francisco Bay Area Stadium", city: "San Francisco Bay Area" },
  { dateLabel: "Wednesday 17 June 2026", homeCode: "POR", time: "20:00", awayCode: "COD", group: "Group K", venue: "Houston Stadium", city: "Houston" },
  { dateLabel: "Wednesday 17 June 2026", homeCode: "ENG", time: "23:00", awayCode: "CRO", group: "Group L", venue: "Dallas Stadium", city: "Dallas" },
  { dateLabel: "Thursday 18 June 2026", homeCode: "GHA", time: "02:00", awayCode: "PAN", group: "Group L", venue: "Toronto Stadium", city: "Toronto" },
  { dateLabel: "Thursday 18 June 2026", homeCode: "UZB", time: "05:00", awayCode: "COL", group: "Group K", venue: "Mexico City Stadium", city: "Mexico City" },
  { dateLabel: "Thursday 18 June 2026", homeCode: "CZE", time: "19:00", awayCode: "RSA", group: "Group A", venue: "Atlanta Stadium", city: "Atlanta" },
  { dateLabel: "Thursday 18 June 2026", homeCode: "SUI", time: "22:00", awayCode: "BIH", group: "Group B", venue: "Los Angeles Stadium", city: "Los Angeles" },
  { dateLabel: "Friday 19 June 2026", homeCode: "CAN", time: "01:00", awayCode: "QAT", group: "Group B", venue: "BC Place Vancouver", city: "Vancouver" },
  { dateLabel: "Friday 19 June 2026", homeCode: "MEX", time: "04:00", awayCode: "KOR", group: "Group A", venue: "Guadalajara Stadium", city: "Guadalajara" },
  { dateLabel: "Friday 19 June 2026", homeCode: "USA", time: "22:00", awayCode: "AUS", group: "Group D", venue: "Seattle Stadium", city: "Seattle" },
  { dateLabel: "Saturday 20 June 2026", homeCode: "SCO", time: "01:00", awayCode: "MAR", group: "Group C", venue: "Boston Stadium", city: "Boston" },
  { dateLabel: "Saturday 20 June 2026", homeCode: "BRA", time: "03:30", awayCode: "HAI", group: "Group C", venue: "Philadelphia Stadium", city: "Philadelphia" },
  { dateLabel: "Saturday 20 June 2026", homeCode: "TUR", time: "06:00", awayCode: "PAR", group: "Group D", venue: "San Francisco Bay Area Stadium", city: "San Francisco Bay Area" },
  { dateLabel: "Saturday 20 June 2026", homeCode: "NED", time: "20:00", awayCode: "SWE", group: "Group F", venue: "Houston Stadium", city: "Houston" },
  { dateLabel: "Saturday 20 June 2026", homeCode: "GER", time: "23:00", awayCode: "CIV", group: "Group E", venue: "Toronto Stadium", city: "Toronto" },
  { dateLabel: "Sunday 21 June 2026", homeCode: "ECU", time: "03:00", awayCode: "CUW", group: "Group E", venue: "Kansas City Stadium", city: "Kansas City" },
  { dateLabel: "Sunday 21 June 2026", homeCode: "TUN", time: "07:00", awayCode: "JPN", group: "Group F", venue: "Monterrey Stadium", city: "Monterrey" },
  { dateLabel: "Sunday 21 June 2026", homeCode: "ESP", time: "19:00", awayCode: "KSA", group: "Group H", venue: "Atlanta Stadium", city: "Atlanta" },
  { dateLabel: "Sunday 21 June 2026", homeCode: "BEL", time: "22:00", awayCode: "IRN", group: "Group G", venue: "Los Angeles Stadium", city: "Los Angeles" },
  { dateLabel: "Monday 22 June 2026", homeCode: "URU", time: "01:00", awayCode: "CPV", group: "Group H", venue: "Miami Stadium", city: "Miami" },
  { dateLabel: "Monday 22 June 2026", homeCode: "NZL", time: "04:00", awayCode: "EGY", group: "Group G", venue: "BC Place Vancouver", city: "Vancouver" },
  { dateLabel: "Monday 22 June 2026", homeCode: "ARG", time: "20:00", awayCode: "AUT", group: "Group J", venue: "Dallas Stadium", city: "Dallas" },
  { dateLabel: "Tuesday 23 June 2026", homeCode: "FRA", time: "00:00", awayCode: "IRQ", group: "Group I", venue: "Philadelphia Stadium", city: "Philadelphia" },
  { dateLabel: "Tuesday 23 June 2026", homeCode: "NOR", time: "03:00", awayCode: "SEN", group: "Group I", venue: "New York/New Jersey Stadium", city: "New York" },
  { dateLabel: "Tuesday 23 June 2026", homeCode: "JOR", time: "06:00", awayCode: "ALG", group: "Group J", venue: "San Francisco Bay Area Stadium", city: "San Francisco Bay Area" },
  { dateLabel: "Tuesday 23 June 2026", homeCode: "POR", time: "20:00", awayCode: "UZB", group: "Group K", venue: "Houston Stadium", city: "Houston" },
  { dateLabel: "Tuesday 23 June 2026", homeCode: "ENG", time: "23:00", awayCode: "GHA", group: "Group L", venue: "Boston Stadium", city: "Boston" },
  { dateLabel: "Wednesday 24 June 2026", homeCode: "PAN", time: "02:00", awayCode: "CRO", group: "Group L", venue: "Toronto Stadium", city: "Toronto" },
  { dateLabel: "Wednesday 24 June 2026", homeCode: "COL", time: "05:00", awayCode: "COD", group: "Group K", venue: "Guadalajara Stadium", city: "Guadalajara" },
  { dateLabel: "Wednesday 24 June 2026", homeCode: "SUI", time: "22:00", awayCode: "CAN", group: "Group B", venue: "BC Place Vancouver", city: "Vancouver" },
  { dateLabel: "Wednesday 24 June 2026", homeCode: "BIH", time: "22:00", awayCode: "QAT", group: "Group B", venue: "Seattle Stadium", city: "Seattle" },
  { dateLabel: "Thursday 25 June 2026", homeCode: "SCO", time: "01:00", awayCode: "BRA", group: "Group C", venue: "Miami Stadium", city: "Miami" },
  { dateLabel: "Thursday 25 June 2026", homeCode: "MAR", time: "01:00", awayCode: "HAI", group: "Group C", venue: "Atlanta Stadium", city: "Atlanta" },
  { dateLabel: "Thursday 25 June 2026", homeCode: "CZE", time: "04:00", awayCode: "MEX", group: "Group A", venue: "Mexico City Stadium", city: "Mexico City" },
  { dateLabel: "Thursday 25 June 2026", homeCode: "RSA", time: "04:00", awayCode: "KOR", group: "Group A", venue: "Monterrey Stadium", city: "Monterrey" },
  { dateLabel: "Thursday 25 June 2026", homeCode: "CUW", time: "23:00", awayCode: "CIV", group: "Group E", venue: "Philadelphia Stadium", city: "Philadelphia" },
  { dateLabel: "Thursday 25 June 2026", homeCode: "ECU", time: "23:00", awayCode: "GER", group: "Group E", venue: "New York/New Jersey Stadium", city: "New York" },
  { dateLabel: "Friday 26 June 2026", homeCode: "JPN", time: "02:00", awayCode: "SWE", group: "Group F", venue: "Dallas Stadium", city: "Dallas" },
  { dateLabel: "Friday 26 June 2026", homeCode: "TUN", time: "02:00", awayCode: "NED", group: "Group F", venue: "Kansas City Stadium", city: "Kansas City" },
  { dateLabel: "Friday 26 June 2026", homeCode: "TUR", time: "05:00", awayCode: "USA", group: "Group D", venue: "Los Angeles Stadium", city: "Los Angeles" },
  { dateLabel: "Friday 26 June 2026", homeCode: "PAR", time: "05:00", awayCode: "AUS", group: "Group D", venue: "San Francisco Bay Area Stadium", city: "San Francisco Bay Area" },
  { dateLabel: "Friday 26 June 2026", homeCode: "NOR", time: "22:00", awayCode: "FRA", group: "Group I", venue: "Boston Stadium", city: "Boston" },
  { dateLabel: "Friday 26 June 2026", homeCode: "SEN", time: "22:00", awayCode: "IRQ", group: "Group I", venue: "Toronto Stadium", city: "Toronto" },
  { dateLabel: "Saturday 27 June 2026", homeCode: "CPV", time: "03:00", awayCode: "KSA", group: "Group H", venue: "Houston Stadium", city: "Houston" },
  { dateLabel: "Saturday 27 June 2026", homeCode: "URU", time: "03:00", awayCode: "ESP", group: "Group H", venue: "Guadalajara Stadium", city: "Guadalajara" },
  { dateLabel: "Saturday 27 June 2026", homeCode: "EGY", time: "06:00", awayCode: "IRN", group: "Group G", venue: "Seattle Stadium", city: "Seattle" },
  { dateLabel: "Saturday 27 June 2026", homeCode: "NZL", time: "06:00", awayCode: "BEL", group: "Group G", venue: "BC Place Vancouver", city: "Vancouver" },
  { dateLabel: "Sunday 28 June 2026", homeCode: "PAN", time: "00:00", awayCode: "ENG", group: "Group L", venue: "New York/New Jersey Stadium", city: "New York" },
  { dateLabel: "Sunday 28 June 2026", homeCode: "CRO", time: "00:00", awayCode: "GHA", group: "Group L", venue: "Philadelphia Stadium", city: "Philadelphia" },
  { dateLabel: "Sunday 28 June 2026", homeCode: "COL", time: "02:30", awayCode: "POR", group: "Group K", venue: "Miami Stadium", city: "Miami" },
  { dateLabel: "Sunday 28 June 2026", homeCode: "COD", time: "02:30", awayCode: "UZB", group: "Group K", venue: "Atlanta Stadium", city: "Atlanta" },
  { dateLabel: "Sunday 28 June 2026", homeCode: "ALG", time: "05:00", awayCode: "AUT", group: "Group J", venue: "Kansas City Stadium", city: "Kansas City" },
  { dateLabel: "Sunday 28 June 2026", homeCode: "JOR", time: "05:00", awayCode: "ARG", group: "Group J", venue: "Dallas Stadium", city: "Dallas" }
];

const monthIndexByName: Record<string, string> = {
  January: "01",
  February: "02",
  March: "03",
  April: "04",
  May: "05",
  June: "06",
  July: "07",
  August: "08",
  September: "09",
  October: "10",
  November: "11",
  December: "12"
};

export function labelToIsoDate(label: string): string {
  const datePattern = /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday) (\d{1,2}) ([A-Za-z]+) (\d{4})$/;
  const match = datePattern.exec(label);
  if (!match) {
    return label;
  }

  const day = match[2].padStart(2, "0");
  const month = monthIndexByName[match[3]] ?? "01";
  return `${match[4]}-${month}-${day}`;
}

export function teamNameByCode(code: string): string {
  const team = worldCupOfficialTeamSeeds.find((entry) => entry.code === code);
  return team?.nameEn ?? code;
}

const teamArabicNameByCodeIndex: Record<string, string> = {
  CAN: "كندا",
  MEX: "المكسيك",
  USA: "الولايات المتحدة",
  ALG: "الجزائر",
  ARG: "الأرجنتين",
  AUS: "أستراليا",
  AUT: "النمسا",
  BEL: "بلجيكا",
  BIH: "البوسنة والهرسك",
  BRA: "البرازيل",
  CPV: "الرأس الأخضر",
  COL: "كولومبيا",
  COD: "الكونغو الديمقراطية",
  CIV: "كوت ديفوار",
  CRO: "كرواتيا",
  CUW: "كوراساو",
  CZE: "التشيك",
  ECU: "الإكوادور",
  EGY: "مصر",
  ENG: "إنجلترا",
  FRA: "فرنسا",
  GER: "ألمانيا",
  GHA: "غانا",
  HAI: "هايتي",
  IRN: "إيران",
  IRQ: "العراق",
  JPN: "اليابان",
  JOR: "الأردن",
  KOR: "كوريا الجنوبية",
  MAR: "المغرب",
  NED: "هولندا",
  NZL: "نيوزيلندا",
  NOR: "النرويج",
  PAN: "بنما",
  PAR: "باراغواي",
  POR: "البرتغال",
  QAT: "قطر",
  KSA: "السعودية",
  SCO: "اسكتلندا",
  SEN: "السنغال",
  RSA: "جنوب أفريقيا",
  ESP: "إسبانيا",
  SWE: "السويد",
  SUI: "سويسرا",
  TUN: "تونس",
  TUR: "تركيا",
  URU: "أوروغواي",
  UZB: "أوزبكستان"
};

export function teamArabicNameByCode(code: string): string {
  return teamArabicNameByCodeIndex[code] ?? teamNameByCode(code);
}

const teamFlagEmojiByCodeIndex: Record<string, string> = {
  CAN: "🇨🇦",
  MEX: "🇲🇽",
  USA: "🇺🇸",
  ALG: "🇩🇿",
  ARG: "🇦🇷",
  AUS: "🇦🇺",
  AUT: "🇦🇹",
  BEL: "🇧🇪",
  BIH: "🇧🇦",
  BRA: "🇧🇷",
  CPV: "🇨🇻",
  COL: "🇨🇴",
  COD: "🇨🇩",
  CIV: "🇨🇮",
  CRO: "🇭🇷",
  CUW: "🇨🇼",
  CZE: "🇨🇿",
  ECU: "🇪🇨",
  EGY: "🇪🇬",
  ENG: "🏴",
  FRA: "🇫🇷",
  GER: "🇩🇪",
  GHA: "🇬🇭",
  HAI: "🇭🇹",
  IRN: "🇮🇷",
  IRQ: "🇮🇶",
  JPN: "🇯🇵",
  JOR: "🇯🇴",
  KOR: "🇰🇷",
  MAR: "🇲🇦",
  NED: "🇳🇱",
  NZL: "🇳🇿",
  NOR: "🇳🇴",
  PAN: "🇵🇦",
  PAR: "🇵🇾",
  POR: "🇵🇹",
  QAT: "🇶🇦",
  KSA: "🇸🇦",
  SCO: "🏴",
  SEN: "🇸🇳",
  RSA: "🇿🇦",
  ESP: "🇪🇸",
  SWE: "🇸🇪",
  SUI: "🇨🇭",
  TUN: "🇹🇳",
  TUR: "🇹🇷",
  URU: "🇺🇾",
  UZB: "🇺🇿"
};

export function teamFlagEmojiByCode(code: string): string {
  return teamFlagEmojiByCodeIndex[code] ?? "🏳️";
}

export type WorldCupOfficialPlayerPosition = "goalkeeper" | "defender" | "midfielder" | "forward" | "unknown";

export type WorldCupOfficialPlayerSeed = {
  id: string;
  name: string;
  position: WorldCupOfficialPlayerPosition;
  shirtNumber: number;
  imageQuery?: string;
  imageUrl?: string;
  imageFallbackUrl?: string;
};

const featuredPlayerNamesByTeamCode: Record<string, string[]> = {
  CAN: ["Alphonso Davies", "Jonathan David", "Tajon Buchanan", "Stephen Eustaquio", "Mois Bombito"],
  MEX: ["Santiago Gimenez", "Hirving Lozano", "Luis Chavez", "Edson Alvarez", "Guillermo Ochoa"],
  USA: ["Christian Pulisic", "Weston McKennie", "Tim Weah", "Tyler Adams", "Matt Turner"],
  ALG: ["Mohamed Amoura", "Riyad Mahrez", "Ismael Bennacer", "Aissa Mandi", "Anthony Mandrea"],
  ARG: ["Lionel Messi", "Julian Alvarez", "Enzo Fernandez", "Cristian Romero", "Emiliano Martinez"],
  AUS: ["Craig Goodwin", "Harry Souttar", "Jackson Irvine", "Connor Metcalfe", "Mathew Ryan"],
  AUT: ["Marko Arnautovic", "Marcel Sabitzer", "Konrad Laimer", "David Alaba", "Patrick Pentz"],
  BEL: ["Kevin De Bruyne", "Romelu Lukaku", "Jeremy Doku", "Amadou Onana", "Koen Casteels"],
  BIH: ["Edin Dzeko", "Anel Ahmedhodzic", "Sead Kolasinac", "Rade Krunic", "Ibrahim Sehic"],
  BRA: ["Vinicius Junior", "Rodrygo", "Lucas Paqueta", "Marquinhos", "Alisson Becker"],
  CPV: ["Ryan Mendes", "Bebe", "Kevin Pina", "Stopira", "Vozinha"],
  COL: ["Luis Diaz", "Rafael Borre", "Jefferson Lerma", "Carlos Cuesta", "Camilo Vargas"],
  COD: ["Yoane Wissa", "Cedric Bakambu", "Meschack Elia", "Chancel Mbemba", "Dimitry Bertaud"],
  CIV: ["Sebastien Haller", "Nicolas Pepe", "Franck Kessie", "Evan Ndicka", "Seko Fofana"],
  CRO: ["Luka Modric", "Josko Gvardiol", "Mateo Kovacic", "Andrej Kramaric", "Dominik Livakovic"],
  CUW: ["Leandro Bacuna", "Rangelo Janga", "Gervane Kastaneer", "Cuco Martina", "Eloy Room"],
  CZE: ["Patrik Schick", "Tomas Soucek", "Vladimir Coufal", "Adam Hlozek", "Jindrich Stanek"],
  ECU: ["Enner Valencia", "Moises Caicedo", "Piero Hincapie", "Pervis Estupinan", "Hernan Galindez"],
  EGY: ["Mohamed Salah", "Mostafa Mohamed", "Trezeguet", "Hamdi Fathi", "Mohamed El Shenawy"],
  ENG: ["Harry Kane", "Jude Bellingham", "Bukayo Saka", "Declan Rice", "Jordan Pickford"],
  FRA: ["Kylian Mbappe", "Antoine Griezmann", "Aurelien Tchouameni", "Dayot Upamecano", "Mike Maignan"],
  GER: ["Jamal Musiala", "Florian Wirtz", "Ilkay Gundogan", "Antonio Rudiger", "Marc-Andre ter Stegen"],
  GHA: ["Mohammed Kudus", "Inaki Williams", "Thomas Partey", "Mohammed Salisu", "Lawrence Ati-Zigi"],
  HAI: ["Duckens Nazon", "Frantzdy Pierrot", "Ricardo Ade", "Jean-Kevin Duverne", "Johny Placide"],
  IRN: ["Mehdi Taremi", "Alireza Jahanbakhsh", "Ali Gholizadeh", "Saeid Ezatolahi", "Alireza Beiranvand"],
  IRQ: ["Aymen Hussein", "Ali Jasim", "Zidane Iqbal", "Amjad Atwan", "Jalal Hassan"],
  JPN: ["Kaoru Mitoma", "Takefusa Kubo", "Daichi Kamada", "Takehiro Tomiyasu", "Zion Suzuki"],
  JOR: ["Musa Al-Taamari", "Yazan Al-Naimat", "Noor Al-Rawabdeh", "Ihsan Haddad", "Yazeed Abu Laila"],
  KOR: ["Son Heung-min", "Lee Kang-in", "Hwang Hee-chan", "Kim Min-jae", "Jo Hyeon-woo"],
  MAR: ["Achraf Hakimi", "Hakim Ziyech", "Youssef En-Nesyri", "Sofyan Amrabat", "Yassine Bounou"],
  NED: ["Virgil van Dijk", "Frenkie de Jong", "Xavi Simons", "Memphis Depay", "Bart Verbruggen"],
  NZL: ["Chris Wood", "Sarpreet Singh", "Liberato Cacace", "Matt Garbett", "Max Crocombe"],
  NOR: ["Erling Haaland", "Martin Odegaard", "Alexander Sorloth", "Kristoffer Ajer", "Orjan Nyland"],
  PAN: ["Ismael Diaz", "Anibal Godoy", "Michael Murillo", "Jose Fajardo", "Luis Mejia"],
  PAR: ["Miguel Almiron", "Julio Enciso", "Matias Galarza", "Gustavo Gomez", "Carlos Coronel"],
  POR: ["Cristiano Ronaldo", "Bruno Fernandes", "Bernardo Silva", "Ruben Dias", "Diogo Costa"],
  QAT: ["Akram Afif", "Almoez Ali", "Hassan Al-Haydos", "Boualem Khoukhi", "Meshaal Barsham"],
  KSA: ["Salem Al-Dawsari", "Firas Al-Buraikan", "Saud Abdulhamid", "Ali Al-Bulaihi", "Nawaf Al-Aqidi"],
  SCO: ["Scott McTominay", "Andrew Robertson", "John McGinn", "Kieran Tierney", "Angus Gunn"],
  SEN: ["Sadio Mane", "Nicolas Jackson", "Ismaila Sarr", "Kalidou Koulibaly", "Edouard Mendy"],
  RSA: ["Percy Tau", "Themba Zwane", "Teboho Mokoena", "Siyanda Xulu", "Ronwen Williams"],
  ESP: ["Lamine Yamal", "Pedri", "Alvaro Morata", "Rodri", "Unai Simon"],
  SWE: ["Alexander Isak", "Dejan Kulusevski", "Emil Forsberg", "Victor Lindelof", "Robin Olsen"],
  SUI: ["Granit Xhaka", "Breel Embolo", "Xherdan Shaqiri", "Manuel Akanji", "Yann Sommer"],
  TUN: ["Youssef Msakni", "Elias Achouri", "Aissa Laidouni", "Montassar Talbi", "Bechir Ben Said"],
  TUR: ["Hakan Calhanoglu", "Arda Guler", "Kerem Akturkoglu", "Merih Demiral", "Ugurcan Cakir"],
  URU: ["Federico Valverde", "Darwin Nunez", "Ronald Araujo", "Rodrigo Bentancur", "Sergio Rochet"],
  UZB: ["Eldor Shomurodov", "Jaloliddin Masharipov", "Otabek Shukurov", "Rustam Ashurmatov", "Utkir Yusupov"],
};

const generatedPositions: WorldCupOfficialPlayerPosition[] = ["forward", "midfielder", "defender", "goalkeeper", "unknown"];

function fallbackPlayerName(teamNameAr: string, index: number): string {
  return `لاعب ${index + 1} - ${teamNameAr}`;
}

export function worldCupOfficialPlayersForTeam(team: Pick<WorldCupOfficialTeamSeed, "id" | "code" | "nameEn">): WorldCupOfficialPlayerSeed[] {
  const featuredNames = featuredPlayerNamesByTeamCode[team.code] ?? [];
  const teamNameAr = teamArabicNameByCode(team.code);

  return new Array(5).fill(null).map((_, index) => {
    const featuredName = featuredNames[index];
    const name = featuredName ?? fallbackPlayerName(teamNameAr, index);
    return {
      id: `${team.id}-player-${index + 1}`,
      name,
      position: generatedPositions[index] ?? "unknown",
      shirtNumber: index + 1,
      imageQuery: featuredName ?? `${team.nameEn} player ${index + 1}`,
    };
  });
}
