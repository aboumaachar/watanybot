import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required for the WatanyBot engagement module.');
}

export const engagementPool = new Pool({ connectionString });