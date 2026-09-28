import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./article-archive.css";
import { articlePath } from "./articlePermalink";
import { WatanyFeatureTemplate } from "../components/template";
import { useApp } from "../store/app";

type ArticleItem = { id:string; slug:string; title:string; excerpt:string|null; publishedAt:string|null; authorName:string|null; featuredImage:string|null; categories:string[]; tags:string[] };
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

export default function ArticlesPage(){
  const {apiBaseUrl}=useApp();
  const [items,setItems]=useState<ArticleItem[]>([]);
  const [categories,setCategories]=useState<Category[]>([]);
  const [category,setCategory]=useState(()=>new URLSearchParams(globalThis.location?.search||"").get("category")||"");
  const [q,setQ]=useState("");
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
    let cancelled=false;setLoading(true);setError(null);
    const params=new URLSearchParams({limit:"100"});
    if(category)params.set("category",category);
    if(q.trim())params.set("q",q.trim());
    void fetchFromCandidates<{items:ArticleItem[]}>(apiBaseUrl,`/api/articles?${params.toString()}`)
      .then((data)=>{if(!cancelled){setItems(data.items||[]);setLoading(false);}})
      .catch(()=>{if(!cancelled){setError("تعذّر تحميل الأرشيف.");setLoading(false);}});
    return()=>{cancelled=true;};
  },[apiBaseUrl,category,q]);
  const title=useMemo(()=>category?`الأرشيف — ${category}`:"المقالات والأرشيف",[category]);
  return <WatanyFeatureTemplate category="updates" eyebrow="أرشيف موطني" title={title} description="المقالات والدراسات والبيانات والنشاطات التاريخية والمحتوى المنشور حديثاً." meta={[{label:"الأرشيف",value:"WordPress + موطني"}]}>
    <div dir="rtl" data-watany-articles-archive="v2">
      <div className="watany-articles-controls">
        <input aria-label="بحث في الأرشيف" value={q} onChange={(event)=>setQ(event.target.value)} placeholder="بحث في المقالات…" />
        <div className="watany-articles-categories"><button type="button" onClick={()=>setCategory("")} aria-pressed={!category}>الكل</button>{categories.map((item)=><button key={item.id} type="button" onClick={()=>setCategory(item.name)} aria-pressed={category===item.name}>{item.name} ({item.count})</button>)}</div>
      </div>
      {loading?<p>جارٍ تحميل الأرشيف…</p>:null}
      {error?<p role="alert">{error}</p>:null}
      {!loading&&!error&&items.length===0?<p>لا توجد مواد مطابقة.</p>:null}
      <div className="watany-articles-list">{items.map((item)=><article key={item.id} className="watany-article-card">
        {item.featuredImage?<Link to={articlePath(item)}><img src={item.featuredImage} alt="" loading="lazy" /></Link>:null}
        <div>
          <h2><Link to={articlePath(item)}>{item.title}</Link></h2>
          <p>{item.publishedAt?new Date(item.publishedAt).toLocaleDateString("ar-LB"):""}{item.authorName?` — ${item.authorName}`:""}</p>
          {item.excerpt?<p>{item.excerpt}</p>:null}
          <p>{item.categories.join(" · ")}</p>
        </div>
      </article>)}</div>
    </div>
  </WatanyFeatureTemplate>;
}
