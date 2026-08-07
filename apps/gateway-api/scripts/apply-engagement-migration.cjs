'use strict';

const fs = require('fs');
const path = require('path');

try {
  require('dotenv').config();
} catch (_) {
  // dotenv is optional; DATABASE_URL may already be present in the environment.
}

const { Pool } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required to apply the engagement migration.');
  }

  const sqlPath = path.resolve(
    __dirname,
    '..',
    'src',
    'db',
    'migrations',
    '20260625_120000_watanybot_engagement_system.sql',
  );

  const sql = fs.readFileSync(sqlPath, 'utf8');
  const pool = new Pool({ connectionString });

  try {
    await pool.query(sql);
    console.log('WATANYBOT_ENGAGEMENT_MIGRATION_APPLIED');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});