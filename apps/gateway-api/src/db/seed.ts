/**
 * Seed development data — creates a super-admin user + sample data.
 *
 * Usage:  tsx apps/gateway-api/src/db/seed.ts
 */
import { query, closePool } from "../lib/db.js";
import { hashPassword } from "../auth/password.js";

export async function seed(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    console.log("[seed] production seed disabled");
    return;
  }

  // Create super-admin if not exists
  const existing = await query("SELECT id FROM users WHERE email = $1", ["admin@watany.lb"]);
  if (existing.rowCount === 0) {
    const seedPassword = process.env.DEV_SEED_PASSWORD?.trim();
    if (!seedPassword) throw new Error("DEV_SEED_PASSWORD is required outside production");
    const hash = await hashPassword(seedPassword);
    await query(
      `INSERT INTO users (email, password_hash, name, role, phone)
       VALUES ($1, $2, $3, $4, $5)`,
      ["admin@watany.lb", hash, "مدير النظام", "superadmin", "+961-1-000000"],
    );
    console.log("[seed] created development super-admin account");
  } else {
    console.log("[seed] super-admin already exists, skipping");
  }

  // Create a demo veteran user
  const demo = await query("SELECT id FROM users WHERE email = $1", ["veteran@watany.lb"]);
  if (demo.rowCount === 0) {
    const seedVeteranPassword = process.env.DEV_SEED_VETERAN_PASSWORD?.trim();
    if (!seedVeteranPassword) throw new Error("DEV_SEED_VETERAN_PASSWORD is required outside production");
    const hash = await hashPassword(seedVeteranPassword);
    await query(
      `INSERT INTO users (email, password_hash, name, role, phone, rank, military_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ["veteran@watany.lb", hash, "أحمد حسين", "accredited", "+961-3-123456", "عميد", "MIL-2024-001"],
    );
    console.log("[seed] created development demo veteran account");
  }

  console.log("[seed] done");
}

if (process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js")) {
  seed()
    .then(() => closePool())
    .catch(err => {
      console.error("[seed] FATAL:", err);
      process.exit(1);
    });
}

