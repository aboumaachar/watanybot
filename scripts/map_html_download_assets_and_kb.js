/**
 * map_html_download_assets_and_kb.js
 *
 * What it does:
 * 1) Reads an "offline saved" HTML file
 * 2) Finds asset/attachment URLs (img/src, script/src, link/href, a/href)
 * 3) Downloads them into a local folder
 * 4) Rewrites the HTML to point to local files
 * 5) Builds a KB JSONL from the HTML text + link inventory
 *
 * Usage:
 *   node tools/map_html_download_assets_and_kb.js ^
 *     --in "C:\xampp\htdocs\projectx\watany\doc\site\page.html" ^
 *     --outDir "C:\xampp\htdocs\projectx\watany\doc\site_local" ^
 *     --baseUrl "https://www.lebarmy.gov.lb"
 *
 * Notes:
 * - If you don't pass --baseUrl, the script tries to infer it from <link rel="canonical"> or meta og:url.
 * - It only downloads http/https URLs (and relative URLs resolved via baseUrl).
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function sha1(s) { return crypto.createHash("sha1").update(s).digest("hex"); }

function readFileUtf8(p) { return fs.readFileSync(p, "utf8"); }
function writeFileUtf8(p, s) { ensureDir(path.dirname(p)); fs.writeFileSync(p, s, "utf8"); }

function guessBaseUrl(html) {
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1];
  if (canonical) {
    try { return new URL(canonical).origin; } catch {}
  }
  const og = html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i)?.[1];
  if (og) {
    try { return new URL(og).origin; } catch {}
  }
  return "";
}

function extractAllUrls(html) {
  // very pragmatic extraction (no DOM libs needed)
  const urls = new Set();

  // src="..."
  for (const m of html.matchAll(/\s(?:src|href)=["']([^"']+)["']/gi)) {
    const u = (m[1] || "").trim();
    if (!u) continue;
    urls.add(u);
  }

  return Array.from(urls);
}

function isDownloadable(u) {
  if (!u) return false;
  if (u.startsWith("mailto:") || u.startsWith("tel:") || u.startsWith("javascript:") || u.startsWith("#")) return false;
  return true;
}

function resolveUrl(u, baseUrl) {
  try {
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    if (!baseUrl) return null;
    // handle //cdn...
    if (u.startsWith("//")) return "https:" + u;
    return new URL(u, baseUrl).toString();
  } catch {
    return null;
  }
}

function sanitizeFileName(name) {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

function pickLocalPathFromUrl(absUrl, outAssetsDir) {
  let u;
  try { u = new URL(absUrl); } catch { return null; }

  let pathname = u.pathname || "/";

  // If ends with /, name it index.html
  if (pathname.endsWith("/")) pathname += "index.html";

  const cleanPath = pathname
    .split("/")
    .filter(Boolean)
    .map(sanitizeFileName)
    .join(path.sep);

  // Add a short hash to avoid collisions
  const hash = sha1(absUrl).slice(0, 8);

  const baseName = path.basename(cleanPath);
  const dirName = path.dirname(cleanPath);

  const finalName = `${baseName}.${hash}${path.extname(baseName) ? "" : ""}`;
  return path.join(outAssetsDir, dirName, finalName);
}

async function downloadToFile(absUrl, destPath) {
  ensureDir(path.dirname(destPath));
  const res = await fetch(absUrl, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
}

function rewriteHtmlLinks(html, mapping, outAssetsDirRelative) {
  // mapping: absUrl -> localAbsPath
  let out = html;

  for (const [absUrl, localAbs] of Object.entries(mapping)) {
    const rel = path.relative(path.dirname(outAssetsDirRelative), localAbs)
      .split(path.sep).join("/");

    // Replace absolute URL occurrences and also possible relative occurrences that resolved to it
    // We only replace absolute URL strings safely.
    out = out.split(absUrl).join(rel);
  }
  return out;
}

function htmlToTextRough(html) {
  // Minimal HTML->text (good enough for KB chunking)
  let t = html;
  t = t.replace(/<script[\s\S]*?<\/script>/gi, "\n");
  t = t.replace(/<style[\s\S]*?<\/style>/gi, "\n");
  t = t.replace(/<\/(p|div|section|article|li|h1|h2|h3|h4|h5|h6)>/gi, "\n");
  t = t.replace(/<br\s*\/?>/gi, "\n");
  t = t.replace(/<[^>]+>/g, " ");
  t = t.replace(/\u00A0/g, " ");
  t = t.replace(/[ \t]+/g, " ");
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

function chunkText(text, maxLen = 1200) {
  const clean = (text || "").trim();
  if (!clean) return [];
  const chunks = [];
  for (let i = 0; i < clean.length; i += maxLen) chunks.push(clean.slice(i, i + maxLen));
  return chunks;
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map(x => {
    const [k, ...rest] = x.split("=");
    return [k.replace(/^--/, ""), rest.join("=")];
  }));

  const inPath = args.in;
  let outDir = args.outDir;
  // Force output to docs/site_local if not already
  if (outDir.includes('doc/site_local')) {
    outDir = outDir.replace('doc/site_local', 'docs/site_local');
  }
  // Also handle if user passes doc/site_local with backslashes
  if (outDir.includes('doc\site_local')) {
    outDir = outDir.replace('doc\site_local', 'docs\site_local');
  }
  const baseUrlArg = args.baseUrl || "";

  if (!inPath || !outDir) {
    console.error("Missing required args: --in=... --outDir=... (optional --baseUrl=...)");
    process.exit(1);
  }

  if (!fs.existsSync(inPath)) {
    console.error("Input HTML not found:", inPath);
    process.exit(1);
  }

  ensureDir(outDir);


  const html = readFileUtf8(inPath);
  const baseUrl = baseUrlArg || guessBaseUrl(html);
  const outAssetsDir = path.join(outDir, "assets");
  ensureDir(outAssetsDir);
  const pagesDir = path.join(outDir, "pages");
  ensureDir(pagesDir);
  const mapping = {};
  const failures = [];
  // Parse table rows from the SECOND <tbody> (main data table)
  const tbodyMatches = Array.from(html.matchAll(/<tbody[^>]*>([\s\S]*?)<\/tbody>/gi));
  if (!tbodyMatches || tbodyMatches.length < 2) {
    console.error("Main data <tbody> not found in HTML");
    process.exit(1);
  }
  const mainTbody = tbodyMatches[1][1];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowIdx = 0;
  let m;
  while ((m = rowRegex.exec(mainTbody))) {
    const rowHtml = m[1];
    // Extract columns
    const cols = Array.from(rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map(x => x[1]);
    if (cols.length < 2) continue;
    const titleMatch = cols[1].match(/<a[^>]*>([\s\S]*?)<\/a>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : cols[1].replace(/<[^>]+>/g, '').trim();
    // Find download link (PDF/DOC/DOCX)
    let fileUrl = null;
    let fileExt = null;
    const downloadLinkMatch = cols[3] && cols[3].match(/href=["']([^"']+\.(pdf|docx?|PDF|DOCX?))["']/i);
    if (downloadLinkMatch) {
      fileUrl = resolveUrl(downloadLinkMatch[1], baseUrl);
      fileExt = downloadLinkMatch[2].toLowerCase();
    }
    let localFilePath = null;
    if (fileUrl) {
      localFilePath = pickLocalPathFromUrl(fileUrl, outAssetsDir);
      try {
        if (!fs.existsSync(localFilePath) || fs.statSync(localFilePath).size === 0) {
          await downloadToFile(fileUrl, localFilePath);
        }
        mapping[fileUrl] = localFilePath;
      } catch (e) {
        failures.push({ url: fileUrl, error: String(e.message || e) });
        localFilePath = null;
      }
    }
    // Fetch and insert ONLY the content from #printContent > div.col-xs-12, and only download assets inside this div
    let transactionBody = '';
    const transactionUrlMatch = cols[1].match(/href=["']([^"']+)["']/i);
    const transactionUrl = transactionUrlMatch ? resolveUrl(transactionUrlMatch[1], baseUrl) : null;
    let assetMapping = {};
    if (transactionUrl) {
      try {
        const res = await fetch(transactionUrl);
        if (res.ok) {
          const transactionHtml = await res.text();
          // Extract #printContent > div.col-xs-12
          // Extract the full <div class="col-xs-12"> inside #printContent, including all nested HTML
          let printContentMatch = transactionHtml.match(/<div[^>]*id=["']printContent["'][^>]*>([\s\S]*?)<\/div>/i);
          let colXs12Match = printContentMatch ? printContentMatch[1].match(/<div[^>]*class=["']col-xs-12["'][^>]*>([\s\S]*?)<\/div>/i) : null;
          if (colXs12Match) {
            transactionBody = colXs12Match[1];
          } else {
            // Fallback: extract the entire <body> section
            let bodySectionMatch = transactionHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
            if (bodySectionMatch) {
              transactionBody = bodySectionMatch[1];
            } else {
              transactionBody = '<p>Content not found in #printContent > div.col-xs-12 or <body></p>';
            }
          }
          // Find all asset URLs (img/src, a/href, link/href, script/src) inside this content
          const assetUrls = [];
          for (const m of transactionBody.matchAll(/(?:src|href)=["']([^"']+)["']/gi)) {
            const u = (m[1] || '').trim();
            if (isDownloadable(u)) assetUrls.push(u);
          }
          for (const assetUrl of assetUrls) {
            const absAssetUrl = resolveUrl(assetUrl, baseUrl);
            if (!absAssetUrl) continue;
            const localAssetPath = pickLocalPathFromUrl(absAssetUrl, outAssetsDir);
            try {
              if (!fs.existsSync(localAssetPath) || fs.statSync(localAssetPath).size === 0) {
                await downloadToFile(absAssetUrl, localAssetPath);
              }
              assetMapping[assetUrl] = path.relative(pagesDir, localAssetPath).split(path.sep).join('/');
            } catch (e) {
              failures.push({ url: absAssetUrl, error: String(e.message || e) });
            }
          }
          // Rewrite asset URLs in transactionBody to point to local files
          for (const [orig, rel] of Object.entries(assetMapping)) {
            transactionBody = transactionBody.split(orig).join(rel);
          }
        }
      } catch (e) {
        transactionBody = `<p>Failed to fetch transaction content: ${e.message}</p>`;
      }
    }
    // Create local HTML page for this transaction (only the extracted content)
    const pageHtml = `<!DOCTYPE html>\n<html lang="ar"><head><meta charset="utf-8"><title>${title}</title></head><body>\n${transactionBody}\n</body></html>`;
    const pageFileName = `transaction_${rowIdx + 1}.html`;
    writeFileUtf8(path.join(pagesDir, pageFileName), pageHtml);
    rowIdx++;
  }
  // Write download report
  const reportCsv = ["abs_url,local_path,status,error"];
  for (const [absUrl, localAbs] of Object.entries(mapping)) {
    reportCsv.push(`"${absUrl.replace(/"/g,'""')}","${localAbs.replace(/"/g,'""')}","downloaded",""`);
  }
  for (const f of failures) {
    reportCsv.push(`"${String(f.url).replace(/"/g,'""')}","","failed","${String(f.error).replace(/"/g,'""')}"`);
  }
  writeFileUtf8(path.join(outDir, "download_report.csv"), reportCsv.join("\n") + "\n");
  console.log("✅ Done");
  console.log("Local pages dir:", pagesDir);
  console.log("Download report:", path.join(outDir, "download_report.csv"));
}

main().catch(e => {
  console.error("Fatal:", e);
  process.exit(1);
});
