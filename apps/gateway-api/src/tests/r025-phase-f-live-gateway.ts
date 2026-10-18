/**
 * R-025 Phase F — loopback-only, standalone real-auth acceptance gateway.
 * NOT a production entrypoint; refuses all targets except dedicated QA DB.
 * Uses the actual JWT middleware, authority routes, CMS adapter, public FAQ routes,
 * PostgreSQL repository and current procedure source index.
 */
import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFileSync, unlinkSync } from "node:fs";
import { registerAuthHook, signAccessToken } from "../auth/auth-middleware.js";
import { adminAuthorityRoutes } from "../admin-authority/adminAuthorityRoutes.js";
import { registerFaqCmsRoutes } from "../cms/faqs/faqs-cms-adapter.js";
import { faqRoutes } from "../routes/faq.js";
import { loadIndex } from "../procedures/indexer.js";
import { getClient, query, closePool } from "../lib/db.js";

const db = "apex_r025_validation_20261008";
const handshake = process.env.R025_F_HANDSHAKE_PATH || "";
function safe(): void {
  if (process.env.NODE_ENV !== "production" ||
      process.env.DB_NAME !== db ||
      process.env.DB_PORT !== "5433" ||
      process.env.DB_HOST !== "127.0.0.1" ||
      Boolean(process.env.DATABASE_URL) ||
      process.env.ALLOW_DEV_ADMIN_FALLBACK === "true" ||
      process.env.DISABLE_AUTH === "true" ||
      process.env.AUTH_BYPASS_FOR_TESTING === "true" ||
      process.env.R025_F_ALLOW_ISOLATED !== "YES" ||
      !handshake || !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 48) {
    throw new Error("R025_F_SCOPED_GATEWAY_TARGET_OR_AUTH_NOT_ISOLATED");
  }
}
async function main() {
  safe();
  const client = await getClient();
  try {
    await client.query("BEGIN READ ONLY");
    const result = await client.query<{ db: string; port: number; ip: string; readonly: string }>(
      "SELECT current_database() AS db,inet_server_port() AS port,inet_server_addr()::text AS ip,current_setting('transaction_read_only') AS readonly");
    const r = result.rows[0];
    if (r.db !== db || Number(r.port) !== 5433 || !r.ip.startsWith("127.0.0.1") || r.readonly !== "on") throw Error("R025_F_WRONG_DB");
    await client.query("ROLLBACK");
  } finally { client.release(); }

  // These fixture relations did not exist at the read-only Phase F preflight.
  // The only object mutations are in the dedicated isolated QA database.
  await query(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, role TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
  )`);
  await query(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at timestamptz NOT NULL
  )`);
  const suffix = randomBytes(8).toString("hex");
  const identities = (["superadmin", "admin", "public"] as const).map((role) => ({
    role, id: `r025f-${role}-${suffix}`, sid: randomUUID(), email: `r025f-${role}-${suffix}@invalid.example`,
  }));
  for (const item of identities) {
    await query("INSERT INTO users (id,email,role,status) VALUES ($1,$2,$3,'active')",
      [item.id,item.email,item.role]);
    await query("INSERT INTO sessions (id,user_id,expires_at) VALUES ($1,$2,now()+interval '60 minutes')",
      [item.sid,item.id]);
  }
  const index = await loadIndex(false);
  const procedureId = index.procedures.find((x) => typeof x.id === "string" && x.id.length > 0)?.id;
  if (!procedureId) throw Error("R025_F_NO_REAL_PROCEDURE_SOURCE");
  const app = Fastify({logger:false});
  registerAuthHook(app);
  await app.register(cors, { origin:["http://127.0.0.1:5209","http://127.0.0.1:5208"], credentials:true });
  await app.register(adminAuthorityRoutes,{prefix:"/api"});
  registerFaqCmsRoutes(app);
  await app.register(faqRoutes);
  app.get("/api/auth/me",async(request,reply)=>{
    if (!request.user) return reply.code(401).send({error:"UNAUTHENTICATED"});
    const result=await query<{id:string;email:string;role:string;status:string}>(
      "SELECT id,email,role,status FROM users WHERE id=$1",[request.user.id]);
    if(!result.rows[0]) return reply.code(404).send({error:"UNKNOWN_USER"});
    return {user:result.rows[0]};
  });
  app.post("/__r025/shutdown",async(request,reply)=>{
    const fixture = identities.find((x) => x.id === request.user?.id && x.role === "superadmin");
    if (!fixture || request.user?.role !== "superadmin") return reply.code(403).send({ok:false});
    const active = await query("SELECT id FROM sessions WHERE id=$1 AND user_id=$2 AND expires_at>now()",
      [fixture.sid,fixture.id]);
    if (!active.rows.length) return reply.code(403).send({ok:false});
    reply.code(202).send({ok:true});
    setImmediate(() => { void shutdown(); });
  });
  app.get("/api/admin/overview",async(request,reply)=>{
    if(!request.user || !["superadmin","admin"].includes(request.user.role))return reply.code(401).send({error:"UNAUTHORIZED"});
    return {gateway:{status:"ok"}};
  });
  await app.listen({host:"127.0.0.1",port:5197});
  const tokens=Object.fromEntries(identities.map((item) => [item.role,
    signAccessToken({sub:item.id,role:item.role,email:item.email,sid:item.sid})]));
  writeFileSync(handshake,JSON.stringify({port:5197,sourceId:procedureId,
    users:identities.map((x)=>({id:x.id,sid:x.sid,role:x.role})),tokens}),{flag:"wx"});
  console.log("R025_F_SCOPED_GATEWAY=READY");
  console.log("R025_F_REAL_JWT_SESSION=ENFORCED");
  console.log("R025_F_REAL_SOURCE_COUNT="+index.procedures.length);
  let closing=false;
  async function shutdown() {
    if(closing)return;closing=true;
    try {
      await app.close();
      for(const item of identities){
        await query("DELETE FROM sessions WHERE id=$1 AND user_id=$2",[item.sid,item.id]);
        await query("DELETE FROM users WHERE id=$1 AND email=$2",[item.id,item.email]);
      }
      await closePool();
      console.log("R025_F_AUTH_FIXTURES_CLEANED=YES");
      try{unlinkSync(handshake)}catch{}
      process.exit(0);
    }catch(e){console.error("R025_F_CLEANUP_BLOCKED",String(e));process.exit(3)}
  }
  process.once("SIGINT",()=>void shutdown());
  process.once("SIGTERM",()=>void shutdown());
}
void main().catch((e)=>{console.error("R025_F_SCOPED_GATEWAY=BLOCKED",e instanceof Error?e.message:String(e));process.exitCode=2});
