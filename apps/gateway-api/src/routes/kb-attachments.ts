/**
 * routes/kb-attachments.ts
 * Serves local KB attachment files (PDF, DOCX, images, etc.)
 * Previously an inline route in server.ts.
 */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const MIME: Record<string, string> = {
  ".pdf":  "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc":  "application/msword",
  ".html": "text/html; charset=utf-8",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png":  "image/png",
  ".txt":  "text/plain; charset=utf-8",
};

export async function kbAttachmentsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/kb/attachments/*", async (req: any, reply) => {
    try {
      const rel  = (req.params["*"] || "").toString();
      const safe = path.normalize(rel).replace(/^\.+[\\/]/, "");

      const repoRoot = process.env.KB_DATA_ROOT || path.resolve(__dirname, "../../../..");
      const candidates = [
        path.join(__dirname, "../../data/kb/attachments", safe),
        path.join(repoRoot, "apps", "gateway-api", "data", "kb", "attachments", safe),
      ];

      const filePath = candidates.find(
        (c) => fs.existsSync(c) && fs.statSync(c).isFile(),
      );

      if (!filePath) return reply.code(404).send({ ok: false, error: "not found" });

      const ext = path.extname(filePath).toLowerCase();
      reply.header("cache-control", "public, max-age=86400");
      reply.type(MIME[ext] || "application/octet-stream");
      return reply.send(fs.createReadStream(filePath));
    } catch (e) {
      app.log.warn({ err: e }, "attachment_serve_error");
      return reply.code(500).send({ ok: false, error: "internal" });
    }
  });
}
