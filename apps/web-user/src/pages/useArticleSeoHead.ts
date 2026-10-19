import { useEffect } from "react";

export type ArticleSeoDocument = {
  slug: string;
  title: string;
  excerpt?: string | null;
  publishedAt?: string | null;
  authorName?: string | null;
  featuredImage?: string | null;
  categories?: string[];
  tags?: string[];
  seo?: {
    title?: string | null;
    description?: string | null;
    canonicalUrl?: string | null;
    robots?: string | null;
    ogTitle?: string | null;
    ogDescription?: string | null;
    ogImage?: string | null;
  };
};

function nonEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function absoluteUrl(value: string): string {
  if (/^https?:\/\//iu.test(value)) return value;
  return new URL(value || "/", globalThis.location.origin).toString();
}function upsertMeta(key: "name" | "property", value: string, content: string, restore: Array<() => void>): void {
  if (!content) return;
  let element = document.head.querySelector(`meta[${key}="${CSS.escape(value)}"]`) as HTMLMetaElement | null;
  const created = !element;
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(key, value);
    document.head.appendChild(element);
  }
  const previous = element.getAttribute("content");
  element.setAttribute("content", content);
  restore.push(() => {
    if (created) element?.remove();
    else if (previous === null) element?.removeAttribute("content");
    else element?.setAttribute("content", previous);
  });
}

function upsertCanonical(url: string, restore: Array<() => void>): void {
  let element = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  const created = !element;
  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.appendChild(element);
  }
  const previous = element.getAttribute("href");
  element.href = url;
  restore.push(() => {
    if (created) element?.remove();
    else if (previous === null) element?.removeAttribute("href");
    else element?.setAttribute("href", previous);
  });
}export function useArticleSeoHead(article: ArticleSeoDocument | null): void {
  useEffect(() => {
    if (!article || typeof document === "undefined") return;
    const restore: Array<() => void> = [];
    const previousTitle = document.title;
    const canonical = absoluteUrl(nonEmpty(article.seo?.canonicalUrl) || `/articles/${encodeURIComponent(article.slug)}`);
    const title = nonEmpty(article.seo?.title) || article.title;
    const description = nonEmpty(article.seo?.description) || nonEmpty(article.excerpt) || article.title;
    const robots = nonEmpty(article.seo?.robots) || "index,follow";
    const ogTitle = nonEmpty(article.seo?.ogTitle) || title;
    const ogDescription = nonEmpty(article.seo?.ogDescription) || description;
    const ogImage = nonEmpty(article.seo?.ogImage) || nonEmpty(article.featuredImage);
    document.title = title;
    upsertMeta("name", "description", description, restore);
    upsertMeta("name", "robots", robots, restore);
    upsertCanonical(canonical, restore);
    upsertMeta("property", "og:type", "article", restore);
    upsertMeta("property", "og:url", canonical, restore);
    upsertMeta("property", "og:title", ogTitle, restore);
    upsertMeta("property", "og:description", ogDescription, restore);
    if (ogImage) upsertMeta("property", "og:image", absoluteUrl(ogImage), restore);
    upsertMeta("name", "twitter:card", ogImage ? "summary_large_image" : "summary", restore);
    upsertMeta("name", "twitter:title", ogTitle, restore);
    upsertMeta("name", "twitter:description", ogDescription, restore);
    if (ogImage) upsertMeta("name", "twitter:image", absoluteUrl(ogImage), restore);    const schema = document.createElement("script");
    schema.type = "application/ld+json";
    schema.dataset.watanyArticleSeo = "jsonld";
    schema.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: article.title,
      description,
      url: canonical,
      mainEntityOfPage: canonical,
      ...(article.publishedAt ? { datePublished: article.publishedAt } : {}),
      ...(article.authorName ? { author: { "@type": "Person", name: article.authorName } } : {}),
      ...(ogImage ? { image: [absoluteUrl(ogImage)] } : {}),
      ...(article.categories?.length ? { articleSection: article.categories } : {}),
      ...(article.tags?.length ? { keywords: article.tags.join(", ") } : {}),
      publisher: { "@type": "Organization", name: "موطني", url: globalThis.location.origin },
    });
    document.head.appendChild(schema);
    restore.push(() => schema.remove());
    return () => {
      document.title = previousTitle;
      restore.reverse().forEach((fn) => fn());
    };
  }, [article]);
}
