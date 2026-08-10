import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Plugin, ResolvedConfig } from "vite";
import { SOCIAL_PREVIEWS, type SocialPreview } from "../src/lib/social-preview-registry";

const PUBLIC_ORIGIN = "https://koudama.com";

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function upsertMeta(html: string, selector: RegExp, tag: string): string {
  if (selector.test(html)) return html.replace(selector, tag);
  return html.replace("</head>", `    ${tag}\n  </head>`);
}

function addPreviewMetadata(html: string, preview: SocialPreview): string {
  const canonicalUrl = `${PUBLIC_ORIGIN}${preview.route}`;
  const imageUrl = `${PUBLIC_ORIGIN}${preview.image}`;
  let next = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeAttribute(preview.title)} | موطني</title>`);
  const tags: Array<[RegExp, string]> = [
    [/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeAttribute(preview.description)}" />`],
    [/<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${canonicalUrl}" />`],
    [/<meta\s+property=["']og:type["'][^>]*>/i, `<meta property="og:type" content="${preview.type}" />`],
    [/<meta\s+property=["']og:site_name["'][^>]*>/i, `<meta property="og:site_name" content="موطني" />`],
    [/<meta\s+property=["']og:locale["'][^>]*>/i, `<meta property="og:locale" content="ar_LB" />`],
    [/<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${canonicalUrl}" />`],
    [/<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${escapeAttribute(preview.title)}" />`],
    [/<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escapeAttribute(preview.description)}" />`],
    [/<meta\s+property=["']og:image["'][^>]*>/i, `<meta property="og:image" content="${imageUrl}" />`],
    [/<meta\s+property=["']og:image:secure_url["'][^>]*>/i, `<meta property="og:image:secure_url" content="${imageUrl}" />`],
    [/<meta\s+property=["']og:image:type["'][^>]*>/i, `<meta property="og:image:type" content="${preview.imageType}" />`],
    [/<meta\s+property=["']og:image:width["'][^>]*>/i, `<meta property="og:image:width" content="${preview.imageWidth}" />`],
    [/<meta\s+property=["']og:image:height["'][^>]*>/i, `<meta property="og:image:height" content="${preview.imageHeight}" />`],
    [/<meta\s+property=["']og:image:alt["'][^>]*>/i, `<meta property="og:image:alt" content="${escapeAttribute(preview.imageAlt)}" />`],
    [/<meta\s+name=["']twitter:card["'][^>]*>/i, `<meta name="twitter:card" content="summary_large_image" />`],
    [/<meta\s+name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${escapeAttribute(preview.title)}" />`],
    [/<meta\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${escapeAttribute(preview.description)}" />`],
    [/<meta\s+name=["']twitter:image["'][^>]*>/i, `<meta name="twitter:image" content="${imageUrl}" />`],
  ] as const;

  for (const [pattern, tag] of tags) next = upsertMeta(next, pattern, tag);
  return next;
}

export function socialPreviewBuildPlugin(): Plugin {
  let resolvedConfig: ResolvedConfig;
  return {
    name: "watany-social-preview-pages",
    apply: "build",
    configResolved(config) {
      resolvedConfig = config;
    },
    writeBundle() {
      const outDir = path.resolve(resolvedConfig.root, resolvedConfig.build.outDir);
      const indexHtml = readFileSync(path.join(outDir, "index.html"), "utf8");
      for (const preview of SOCIAL_PREVIEWS) {
        const routeDirectory = path.join(outDir, preview.route.replace(/^\/+/, ""));
        mkdirSync(routeDirectory, { recursive: true });
        writeFileSync(path.join(routeDirectory, "index.html"), addPreviewMetadata(indexHtml, preview), "utf8");
      }
    },
  };
}
