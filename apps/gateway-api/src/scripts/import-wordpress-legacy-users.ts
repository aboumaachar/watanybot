import { readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { closePool, getClient } from "../lib/db.js";
import { hashPassword, isLegacyWordpressPasswordHash } from "../auth/password.js";

type Mode = "phone_fallback" | "legacy_wp" | "reset_required";
type Identity = {
  source_ids: number[];
  canonical_wp_id: number;
  username: string;
  full_name: string;
  email: string | null;
  secondary_emails: string[];
  core_phone: string | null;
  legacy_shared_phone: string | null;
  identity_verification_required: boolean;
  military_id: string | null;
  rank: string | null;
  region: string | null;
  registered: string | null;
  legacy_password_hash: string | null;
  credential_mode: Mode;
};
type Payload = { version: number; source: string; eligible_identities: Identity[] };
type UserRow = {
  id: string; email: string | null; username: string; password_hash: string | null;
  phone_number: string | null; phone: string | null; full_name: string; name: string;
  military_id: string | null; rank: string | null; region: string | null;
};
function normEmail(v: unknown): string | null {
  const s = String(v ?? "").trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) ? s : null;
}
function normPhone(v: unknown): string | null {
  const d = String(v ?? "").replace(/\D/g, "");
  return d.length >= 8 && d.length <= 15 ? d : null;
}
function safeUsername(raw: string, wpId: number): string {
  const trimmed = raw.trim();
  if (trimmed) return trimmed;
  return `wp_${wpId}`;
}
function registeredAt(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw.includes("T") ? raw : raw.replace(" ", "T") + "Z");
  return Number.isNaN(d.valueOf()) ? null : d.toISOString();
}
function addMap<T>(m: Map<string, T[]>, key: string | null, value: T) {
  if (!key) return;
  const arr = m.get(key) ?? [];
  arr.push(value);
  m.set(key, arr);
}
function pickUniqueUsername(base: string, wpId: number, used: Set<string>): string {
  let next = base;
  if (!used.has(next)) { used.add(next); return next; }
  next = `wp_${wpId}`;
  let n = 1;
  while (used.has(next)) next = `wp_${wpId}_${n++}`;
  used.add(next);
  return next;
}
async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const payloadArg = process.argv.find((x) => x.startsWith("--payload="));
  const payloadPath = payloadArg?.slice("--payload=".length) || process.env.WP_IMPORT_PAYLOAD;
  if (!payloadPath) throw new Error("WP_IMPORT_PAYLOAD_REQUIRED");
  const payload = JSON.parse(readFileSync(payloadPath, "utf8")) as Payload;
  if (payload.version !== 3 || payload.source !== "koudama.sql") throw new Error("PAYLOAD_AUTHORITY_MISMATCH");
  const identities = payload.eligible_identities;
  if (identities.length !== 1926) throw new Error(`PAYLOAD_IDENTITY_COUNT_MISMATCH:${identities.length}`);
  const wpBcryptHashes = new Map<number, string>([
    [14, "$wp$2y$12$mTwn1ZKPv.wBEKJpVpKIm.sNjYqg60S6UNZonSEqJUwUSjRAm1/.C"],
    [4358, "$wp$2y$12$/zlioo9ajlF18Qgd2s/2CeIOQ9cU0mP3hKCuoLfS0cZ41HOQNd5wm"],
  ]);
  for (const identity of identities) {
    if (identity.credential_mode === "reset_required") {
      const preserved = wpBcryptHashes.get(identity.canonical_wp_id);
      if (preserved) {
        identity.legacy_password_hash = preserved;
        identity.credential_mode = "legacy_wp";
      }
    }
  }

  const canonicalIds = new Set<number>();
  const sourceIds = new Set<number>();
  const validationErrors: string[] = [];
  for (const x of identities) {
    if (canonicalIds.has(x.canonical_wp_id)) validationErrors.push(`DUP_CANONICAL:${x.canonical_wp_id}`);
    canonicalIds.add(x.canonical_wp_id);
    for (const sid of x.source_ids) {
      if (sourceIds.has(sid)) validationErrors.push(`DUP_SOURCE:${sid}`);
      sourceIds.add(sid);
    }
    if (x.core_phone && !normPhone(x.core_phone)) validationErrors.push(`BAD_CORE_PHONE:${x.canonical_wp_id}`);
    if (x.legacy_shared_phone && !normPhone(x.legacy_shared_phone)) validationErrors.push(`BAD_SHARED_PHONE:${x.canonical_wp_id}`);
    if (!x.core_phone && !x.email && !x.username) validationErrors.push(`NO_LOGIN_IDENTITY:${x.canonical_wp_id}`);
    if (x.credential_mode === "phone_fallback" && !x.core_phone) validationErrors.push(`PHONE_MODE_WITHOUT_PHONE:${x.canonical_wp_id}`);
    if (x.credential_mode === "legacy_wp" && !isLegacyWordpressPasswordHash(x.legacy_password_hash ?? "")) validationErrors.push(`BAD_LEGACY_HASH:${x.canonical_wp_id}`);
  }
  if (sourceIds.size !== 1985) validationErrors.push(`SOURCE_ROW_COUNT:${sourceIds.size}`);
  console.log(`WP_PAYLOAD_IDENTITIES=${identities.length}`);
  console.log(`WP_PAYLOAD_SOURCE_ROWS=${sourceIds.size}`);
  console.log(`WP_PAYLOAD_VALIDATION_ERRORS=${validationErrors.length}`);
  if (validationErrors.length) throw new Error(validationErrors.slice(0, 20).join(","));
  const client = await getClient();
  try {
    const usersResult = await client.query<UserRow>(
      `SELECT id,email,username,password_hash,phone_number,phone,full_name,name,military_id,rank,region FROM users ORDER BY created_at,id`,
    );
    const users = usersResult.rows;
    const byPhone = new Map<string, UserRow[]>();
    const byEmail = new Map<string, UserRow[]>();
    const byId = new Map(users.map((u) => [u.id, u]));
    const usedUsernames = new Set(users.map((u) => u.username));
    for (const u of users) {
      addMap(byPhone, normPhone(u.phone_number || u.phone), u);
      addMap(byEmail, normEmail(u.email), u);
    }
    const linksResult = await client.query<{ canonical_wp_id: string; user_id: string }>(
      `SELECT canonical_wp_id::text,user_id::text FROM legacy_wp_user_identities`,
    );
    const existingLinks = new Map(linksResult.rows.map((r) => [Number(r.canonical_wp_id), r.user_id]));

    let createCount = 0;
    let reusePhoneCount = 0;
    let reuseEmailCount = 0;
    let alreadyLinkedCount = 0;
    let phoneEmailConflictCount = 0;
    let aliasConflictCount = 0;
    const blocking: string[] = [];
    const plans: Array<{ identity: Identity; target?: UserRow; reason: string; username?: string }> = [];
    for (const identity of identities) {
      const linkedUserId = existingLinks.get(identity.canonical_wp_id);
      if (linkedUserId) {
        const target = byId.get(linkedUserId);
        if (!target) blocking.push(`BROKEN_EXISTING_LINK:${identity.canonical_wp_id}`);
        else { plans.push({ identity, target, reason: "already_linked" }); alreadyLinkedCount += 1; }
        continue;
      }
      const phone = normPhone(identity.core_phone);
      const email = normEmail(identity.email);
      const phoneOwners = phone ? (byPhone.get(phone) ?? []) : [];
      const emailOwners = email ? (byEmail.get(email) ?? []) : [];
      if (phoneOwners.length > 1) { blocking.push(`AMBIGUOUS_PHONE:${identity.canonical_wp_id}`); continue; }
      if (emailOwners.length > 1) { blocking.push(`AMBIGUOUS_EMAIL:${identity.canonical_wp_id}`); continue; }
      const phoneOwner = phoneOwners[0];
      const emailOwner = emailOwners[0];
      if (phoneOwner && emailOwner && phoneOwner.id !== emailOwner.id) {
        phoneEmailConflictCount += 1;
        reusePhoneCount += 1;
        plans.push({ identity, target: phoneOwner, reason: "phone_email_split_phone_primary" });
        continue;
      }
      const target = phoneOwner || emailOwner;
      if (target) {
        const reason = phoneOwner ? "phone" : "email";
        if (reason === "phone") reusePhoneCount += 1; else reuseEmailCount += 1;
        plans.push({ identity, target, reason });
      } else {
        const username = pickUniqueUsername(safeUsername(identity.username, identity.canonical_wp_id), identity.canonical_wp_id, usedUsernames);
        plans.push({ identity, reason: "create", username });
        createCount += 1;
      }
    }

    for (const plan of plans) {
      const targetId = plan.target?.id;
      const aliases = new Set<string>();
      for (const raw of plan.identity.secondary_emails ?? []) {
        const alias = normEmail(raw);
        if (alias) aliases.add(alias);
      }
      const sourceEmail = normEmail(plan.identity.email);
      const skipSourceEmailAlias =
        plan.reason === "phone_email_split_phone_primary" || plan.reason === "already_linked";
      if (skipSourceEmailAlias) aliases.delete(sourceEmail ?? "");
      else if (sourceEmail && plan.target?.email && normEmail(plan.target.email) !== sourceEmail) aliases.add(sourceEmail);
      for (const alias of aliases) {
        const owners = byEmail.get(alias) ?? [];
        if (owners.some((u) => u.id !== targetId)) {
          aliasConflictCount += 1;
          blocking.push(`SECONDARY_EMAIL_OWNER_SPLIT:${plan.identity.canonical_wp_id}`);
        }
      }
    }

    const sharedCount = identities.filter((x) => x.identity_verification_required).length;
    const legacyCount = identities.filter((x) => x.credential_mode === "legacy_wp").length;
    const phoneFallbackCount = identities.filter((x) => x.credential_mode === "phone_fallback").length;
    const resetRequiredCount = identities.filter((x) => x.credential_mode === "reset_required").length;
    if (sharedCount !== 30) blocking.push(`CONTRACT_SHARED:${sharedCount}`);
    if (phoneFallbackCount !== 1873) blocking.push(`CONTRACT_PHONE_FALLBACK:${phoneFallbackCount}`);
    if (legacyCount !== 53) blocking.push(`CONTRACT_LEGACY:${legacyCount}`);
    if (resetRequiredCount !== 0) blocking.push(`CONTRACT_RESET_REQUIRED:${resetRequiredCount}`);
    console.log(`PREFLIGHT_EXISTING_WATANY_USERS=${users.length}`);
    console.log(`PREFLIGHT_ALREADY_LINKED=${alreadyLinkedCount}`);
    console.log(`PREFLIGHT_REUSE_BY_PHONE=${reusePhoneCount}`);
    console.log(`PREFLIGHT_REUSE_BY_EMAIL=${reuseEmailCount}`);
    console.log(`PREFLIGHT_CREATE_USERS=${createCount}`);
    console.log(`PREFLIGHT_SHARED_PHONE_IDENTITIES=${sharedCount}`);
    console.log(`PREFLIGHT_PHONE_FALLBACK=${phoneFallbackCount}`);
    console.log(`PREFLIGHT_LEGACY_PHPASS=${legacyCount}`);
    console.log(`PREFLIGHT_RESET_REQUIRED=${resetRequiredCount}`);
    console.log(`PREFLIGHT_PHONE_EMAIL_SPLITS=${phoneEmailConflictCount}`);
    console.log(`PREFLIGHT_ALIAS_SPLITS=${aliasConflictCount}`);
    console.log(`PREFLIGHT_BLOCKING_CONFLICTS=${blocking.length}`);
    if (blocking.length) throw new Error(blocking.slice(0, 50).join(","));
    if (dryRun) { console.log("WP_IMPORT_DRY_RUN=PASS"); return; }
    await client.query("BEGIN");
    let created = 0;
    let reused = 0;
    try {
      for (const plan of plans) {
        const x = plan.identity;
        let target = plan.target;
        if (!target) {
          const corePhone = normPhone(x.core_phone);
          let passwordHash: string;
          let mustChange = false;
          if (x.credential_mode === "phone_fallback") {
            passwordHash = await hashPassword(corePhone!);
            mustChange = true;
          } else if (x.credential_mode === "legacy_wp") {
            passwordHash = x.legacy_password_hash!;
          } else {
            passwordHash = await hashPassword(`${randomUUID()}${randomBytes(32).toString("hex")}`);
            mustChange = true;
          }
          const inserted = await client.query<UserRow>(
            `INSERT INTO users
             (email,username,password_hash,full_name,name,phone_number,phone,military_id,rank,region,role,status,must_change_password,account_origin,created_at)
             VALUES($1,$2,$3,$4,$4,$5,$5,$6,$7,$8,'public','active',$9,'wordpress_legacy',COALESCE($10::timestamptz,NOW()))
             RETURNING id,email,username,password_hash,phone_number,phone,full_name,name,military_id,rank,region`,
            [normEmail(x.email), plan.username, passwordHash, x.full_name || x.username, corePhone, x.military_id || null,
             x.rank || null, x.region || null, mustChange, registeredAt(x.registered)],
          );
          target = inserted.rows[0];
          created += 1;
        } else if (plan.reason !== "already_linked") {
          const sourceEmail =
            plan.reason === "phone_email_split_phone_primary" ? null : normEmail(x.email);
          const corePhone = normPhone(x.core_phone);
          const existingPhone = normPhone(target.phone_number || target.phone);
          await client.query(
            `UPDATE users SET
               email=CASE WHEN COALESCE(BTRIM(email),'')='' AND $2::text IS NOT NULL THEN $2 ELSE email END,
               full_name=CASE WHEN COALESCE(BTRIM(full_name),'')='' THEN $3 ELSE full_name END,
               name=CASE WHEN COALESCE(BTRIM(name),'')='' THEN $3 ELSE name END,
               phone_number=CASE WHEN $4::text IS NOT NULL AND $5::text IS NULL THEN $4 ELSE phone_number END,
               phone=CASE WHEN $4::text IS NOT NULL AND $5::text IS NULL THEN $4 ELSE phone END,
               military_id=COALESCE(NULLIF(military_id,''),$6),
               rank=COALESCE(NULLIF(rank,''),$7),
               region=COALESCE(NULLIF(region,''),$8),
               updated_at=NOW()
             WHERE id=$1`,
            [target.id, sourceEmail, x.full_name || x.username, corePhone, existingPhone,
             x.military_id || null, x.rank || null, x.region || null],
          );
          reused += 1;
        }

        const sourceEmail = normEmail(x.email);
        const skipSourceEmailAlias =
          plan.reason === "phone_email_split_phone_primary" || plan.reason === "already_linked";
        const sourceEmailForAlias = skipSourceEmailAlias ? null : sourceEmail;
        const targetPrimary = normEmail(target.email) || sourceEmailForAlias;
        const aliases = new Set<string>();
        for (const raw of x.secondary_emails ?? []) { const e = normEmail(raw); if (e) aliases.add(e); }
        if (skipSourceEmailAlias) aliases.delete(sourceEmail ?? "");
        else if (sourceEmailForAlias && sourceEmailForAlias !== targetPrimary) aliases.add(sourceEmailForAlias);
        aliases.delete(targetPrimary ?? "");
        for (const email of aliases) {
          await client.query(
            `INSERT INTO user_secondary_emails(user_id,email,source,verified)
             VALUES($1,$2,'wordpress_legacy',FALSE)
             ON CONFLICT(user_id,email) DO NOTHING`,
            [target.id, email],
          );
        }
        const normalizedAliases = Array.from(aliases);
        await client.query(
          `INSERT INTO legacy_wp_user_identities
           (user_id,canonical_wp_id,source_wp_ids,source_username,source_primary_email,secondary_emails,shared_phone,
            identity_verification_required,credential_mode,credential_reset_required,source_registered_at,source_payload,updated_at)
           VALUES($1,$2,$3::bigint[],$4,$5,$6::text[],$7,$8,$9,$10,$11::timestamptz,$12::jsonb,NOW())
           ON CONFLICT(canonical_wp_id) DO UPDATE SET
             user_id=EXCLUDED.user_id,source_wp_ids=EXCLUDED.source_wp_ids,source_username=EXCLUDED.source_username,
             source_primary_email=EXCLUDED.source_primary_email,secondary_emails=EXCLUDED.secondary_emails,
             shared_phone=EXCLUDED.shared_phone,identity_verification_required=EXCLUDED.identity_verification_required,
             credential_mode=EXCLUDED.credential_mode,credential_reset_required=EXCLUDED.credential_reset_required,
             source_registered_at=EXCLUDED.source_registered_at,source_payload=EXCLUDED.source_payload,updated_at=NOW()`,
          [target.id, x.canonical_wp_id, x.source_ids, x.username, sourceEmail, normalizedAliases,
           normPhone(x.legacy_shared_phone), Boolean(x.identity_verification_required), x.credential_mode,
           x.credential_mode === "reset_required", registeredAt(x.registered),
           JSON.stringify({ source: "koudama.sql", core_phone: normPhone(x.core_phone) })],
        );
      }

      const canonical = identities.map((x) => x.canonical_wp_id);
      const recon = await client.query<{ links: string; valid_users: string; shared: string; reset_required: string }>(
        `SELECT
           COUNT(*)::text AS links,
           COUNT(u.id)::text AS valid_users,
           COUNT(*) FILTER (WHERE l.identity_verification_required)::text AS shared,
           COUNT(*) FILTER (WHERE l.credential_reset_required)::text AS reset_required
         FROM legacy_wp_user_identities l
         LEFT JOIN users u ON u.id=l.user_id
         WHERE l.canonical_wp_id=ANY($1::bigint[])`,
        [canonical],
      );
      const r = recon.rows[0];
      if (Number(r.links) !== identities.length || Number(r.valid_users) !== identities.length) throw new Error("RECON_LINK_COUNT_MISMATCH");
      if (Number(r.shared) !== 30) throw new Error(`RECON_SHARED_COUNT:${r.shared}`);
      if (Number(r.reset_required) !== 0) throw new Error(`RECON_RESET_REQUIRED_COUNT:${r.reset_required}`);
      await client.query("COMMIT");
      console.log(`WP_IMPORT_CREATED_USERS=${created}`);
      console.log(`WP_IMPORT_REUSED_USERS=${reused}`);
      console.log(`WP_IMPORT_ALREADY_LINKED=${alreadyLinkedCount}`);
      console.log(`RECON_WP_LINKS=${r.links}/${identities.length}`);
      console.log(`RECON_WP_VALID_USERS=${r.valid_users}/${identities.length}`);
      console.log(`RECON_WP_SHARED_IDENTITY_FLAGS=${r.shared}/30`);
      console.log(`RECON_WP_RESET_REQUIRED=${r.reset_required}/0`);
      console.log("WP_IMPORT_FINAL=PASS");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
