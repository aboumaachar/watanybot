import fs from "node:fs";

type Article = { wpId:number; slug:string; title:string; bodyHtml:string; publishedAtLocal:string; categories:string[] };
type Payload = { articles: Article[] };
const payloadArg=process.argv.find((x)=>x.startsWith("--payload="));
const outputArg=process.argv.find((x)=>x.startsWith("--output="));
if(!payloadArg||!outputArg) throw new Error("PAYLOAD_AND_OUTPUT_REQUIRED");
const payload=JSON.parse(fs.readFileSync(payloadArg.slice(10),"utf8")) as Payload;
const output=outputArg.slice(9);
const selected=new Set(["قوانين","دراسات","قضايا","مقالات","بيان"]);

function plain(html:string):string {
  return html.replace(/<[^>]+>/g," ")
    .replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">")
    .replace(/\s+/g," ").trim();
}
function chunks(text:string,size=1200):string[]{
  const out:string[]=[]; let cursor=0;
  while(cursor<text.length){ let end=Math.min(cursor+size,text.length); if(end<text.length){const cut=text.lastIndexOf(" ",end);if(cut>cursor+600)end=cut;} out.push(text.slice(cursor,end).trim());cursor=end;}
  return out.filter(Boolean).slice(0,8);
}
const chosen=payload.articles.filter((a)=>a.categories.some((c)=>selected.has(c)));
const lines:string[]=[];
for(const article of chosen){
  const text=plain(article.bodyHtml);
  const parts=chunks(text);
  parts.forEach((part,index)=>{
    lines.push(JSON.stringify({
      id:`wp-article:${article.wpId}:${index+1}`,
      text:part,
      chunk_type:"historical_article",
      metadata:{
        title_ar:article.title,
        category_id:"wordpress_archive",
        semantic_tags:article.categories,
        source_url:`/articles/${article.slug}`,
        published_at:article.publishedAtLocal,
        wp_id:article.wpId,
        historical:true,
      },
    }));
  });
}
fs.writeFileSync(output,lines.join("\n")+"\n","utf8");
console.log(`WP_ARTICLE_RAG_SELECTED=${chosen.length}`);
console.log(`WP_ARTICLE_RAG_CHUNKS=${lines.length}`);
if(chosen.length!==68) throw new Error(`RAG_SELECTED_COUNT:${chosen.length}`);
console.log("WP_ARTICLE_RAG_BUILD=PASS");
