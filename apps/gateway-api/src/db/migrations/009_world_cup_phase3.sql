-- WAT-020 Phase 3: World Cup live data + persistence foundation
-- Safe idempotent migration. No betting, gambling, odds, or monetary prediction support.

CREATE TABLE IF NOT EXISTS world_cup_teams (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  group_name TEXT,
  flag_emoji TEXT,
  official_source_url TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS world_cup_players (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  name TEXT NOT NULL,
  position TEXT,
  shirt_number INTEGER,
  official_source_url TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (team_id) REFERENCES world_cup_teams(id)
);

CREATE TABLE IF NOT EXISTS world_cup_matches (
  id TEXT PRIMARY KEY,
  fifa_match_id TEXT,
  date_time TEXT NOT NULL,
  team_a_id TEXT,
  team_b_id TEXT,
  team_a_name TEXT,
  team_b_name TEXT,
  stage TEXT,
  venue TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  score TEXT,
  official_source_url TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS world_cup_polls (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  question TEXT NOT NULL,
  closes_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS world_cup_poll_options (
  id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (poll_id) REFERENCES world_cup_polls(id)
);

CREATE TABLE IF NOT EXISTS world_cup_votes (
  id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL,
  option_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (poll_id, user_id),
  FOREIGN KEY (poll_id) REFERENCES world_cup_polls(id),
  FOREIGN KEY (option_id) REFERENCES world_cup_poll_options(id)
);

CREATE TABLE IF NOT EXISTS world_cup_favorites (
  user_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, team_id)
);

CREATE TABLE IF NOT EXISTS world_cup_reminders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  remind_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, match_id, remind_at),
  FOREIGN KEY (match_id) REFERENCES world_cup_matches(id)
);