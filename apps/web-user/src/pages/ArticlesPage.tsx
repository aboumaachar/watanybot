import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import "./article-archive.css";
import { articlePath } from "./articlePermalink";
import { WatanyFeatureTemplate } from "../components/template";
import { useApp } from "../store/app";

type ArticleItem = { id:string; slug:string; title:string; excerpt:string|null; publishedAt:string|null; authorName:string|null; featuredImage:string|null; categories:string[]; tags:string[];primaryCategory?:string|null;permalinkSlug?:string|null;seo?:{canonicalUrl?:string|null} };
type Category = { id:string; slug:string|null; name:string; count:number };

async function fetchFromCandidates<T>(apiBaseUrl:string,path:string):Promise<T>{
  const bases=Array.from(new Set([apiBaseUrl,globalThis.location?.origin].filter(Boolean))) as string[];
  let last:unknown;
  for(const base of bases){
    try{
      const response=await fetch(`${base}${path}`,{credentials:"include"});
      if(!response.ok)throw new Error(String(response.status));
      return await response.json() as T;
    }catch(error){last=error;}
  }
  throw last instanceof Error?last:new Error("request_failed");
}

function publicArticlePath(item:ArticleItem):string {
  const canonical=item.seo?.canonicalUrl;
  if(canonical){
    try{
      const parsed=new URL(canonical,"https://koudama.com");
      if(parsed.origin==="https://koudama.com"&&/^\/articles\/[^/]+\/[^/]+$/.test(parsed.pathname))return parsed.pathname;
    }catch{}
  }
  return articlePath(item);
}

export default function ArticlesPage(){
  const {apiBaseUrl}=useApp();
  const [searchParams,setSearchParams]=useSearchParams();
  const category=searchParams.get("category")||"";
  const q=searchParams.get("q")||"";
  const candidatePage=Number(searchParams.get("page")||"1");
  const page=Number.isInteger(candidatePage)&&candidatePage>=1&&candidatePage<=1000?candidatePage:1;
  const pageSize=50;
  const archiveHref=(nextCategory:string,nextPage=1,nextQ="")=>{
    const query=new URLSearchParams();
    if(nextCategory)query.set("category",nextCategory);
    if(nextQ)query.set("q",nextQ);
    if(nextPage>1)query.set("page",String(nextPage));
    const suffix=query.toString();
    return "/articles"+(suffix?"?"+suffix:"");
  };
  const [items,setItems]=useState<ArticleItem[]>([]);
  const [hasNext,setHasNext]=useState(false);
  const [categories,setCategories]=useState<Category[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{
    let cancelled=false;
    void fetchFromCandidates<{categories:Category[]}>(apiBaseUrl,"/api/articles/categories")
      .then((data)=>{if(!cancelled)setCategories(data.categories||[]);})
      .catch(()=>{});
    return()=>{cancelled=true;};
  },[apiBaseUrl]);
  useEffect(()=>{
    let cancelled=false;setLoading(true);setError(null);setHasNext(false);
    const query=new URLSearchParams({limit:String(pageSize+1),offset:String((page-1)*pageSize)});
    if(category)query.set("category",category);
    if(q.trim())query.set("q",q.trim());
    void fetchFromCandidates<{items:ArticleItem[]}>(apiBaseUrl,"/api/articles?"+query.toString())
      .then((data)=>{if(!cancelled){const received=data.items||[];setItems(received.slice(0,pageSize));setHasNext(received.length>pageSize);setLoading(false);}})
      .catch(()=>{if(!cancelled){setError("تعذّر تحميل الأرشيف.");setLoading(false);}});
    return()=>{cancelled=true;};
  },[apiBaseUrl,category,q,page]);
  const title=useMemo(()=>category?`الأرشيف — ${category}`:"المقالات والأرشيف",[category]);
  return <WatanyFeatureTemplate category="updates" eyebrow="أرشيف موطني" title={title} description="المقالات والدراسات والبيانات والنشاطات التاريخية والمحتوى المنشور حديثاً." meta={[{label:"الأرشيف",value:"WordPress + موطني"}]}>
    <div dir="rtl" data-watany-articles-archive="v2">
      <div className="watany-articles-controls">
        <input aria-label="بحث في الأرشيف" value={q} onChange={(event)=>{const next=new URLSearchParams(searchParams);const value=event.target.value;if(value)next.set("q",value);else next.delete("q");next.delete("page");setSearchParams(next,{replace:true});}} placeholder="بحث في المقالات…" />
        <nav className="watany-articles-categories" aria-label="تصنيفات المقالات"><Link to="/articles" aria-current={!category?"page":undefined}>الكل</Link>{categories.map((item)=><Link key={item.id} to={archiveHref(item.name)} aria-current={category===item.name?"page":undefined}>{item.name} ({item.count})</Link>)}</nav>
      </div>
      {loading?<p>جارٍ تحميل الأرشيف…</p>:null}
      {error?<p role="alert">{error}</p>:null}
      {!loading&&!error&&items.length===0?<p>لا توجد مواد مطابقة.</p>:null}
      <div className="watany-articles-list">{items.map((item)=><article key={item.id} className="watany-article-card">
        {item.featuredImage?<Link to={publicArticlePath(item)}><img src={item.featuredImage} alt="" loading="lazy" /></Link>:null}
        <div>
          <h2><Link to={publicArticlePath(item)}>{item.title}</Link></h2>
          <p>{item.publishedAt?new Date(item.publishedAt).toLocaleDateString("ar-LB"):""}{item.authorName?` — ${item.authorName}`:""}</p>
          {item.excerpt?<p>{item.excerpt}</p>:null}
          <p>{item.categories.join(" · ")}</p>
        </div>
      </article>)}</div>
      {!loading&&!error&&(page>1||hasNext)?<nav data-watany-archive-pagination="v1" aria-label="صفحات المقالات" className="watany-articles-pagination">{page>1?<Link to={archiveHref(category,page-1,q)}>السابق</Link>:null}<span>الصفحة {page}</span>{hasNext?<Link to={archiveHref(category,page+1,q)}>التالي</Link>:null}</nav>:null}
    </div>
  </WatanyFeatureTemplate>;
}