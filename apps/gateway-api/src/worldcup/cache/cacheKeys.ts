export const worldCupCacheKeys = {
  live: 'worldcup:live',
  today: 'worldcup:today',
  matches: 'worldcup:matches',
  teams: 'worldcup:teams',
  players: 'worldcup:players',
  polls: 'worldcup:polls',
} as const;

export const worldCupCacheTtlSeconds = {
  live: Number(process.env.WORLDCUP_CACHE_LIVE_TTL_SECONDS || 30),
  today: Number(process.env.WORLDCUP_CACHE_TODAY_TTL_SECONDS || 300),
  static: Number(process.env.WORLDCUP_CACHE_STATIC_TTL_SECONDS || 3600),
} as const;
