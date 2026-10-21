import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Link, useParams } from "react-router-dom";
import "./article-archive.css";
import { articlePath, asciiSlug, categorySlug } from "./articlePermalink";
import { WatanyFeatureTemplate } from "../components/template";
import { FeatureAdSensePlacement } from "../components/ads/FeatureAdSensePlacement";
import { useApp } from "../store/app";

type Article={id:string;slug:string;title:string;bodyHtml:string;publishedAt:string|null;updatedAt?:string|null;authorName:string|null;authorUserId:string|null;featuredImage:string|null;categories:string[];primaryCategory?:string|null;permalinkSlug?:string|null;permalinkHistory?:string[];redirectTo?:string|null;originalWpId:number|null;seo?:{title:string|null;description:string|null;canonicalUrl:string|null;robots:string|null;ogTitle:string|null;ogDescription:string|null;ogImage:string|null}};
type FacebookSdk={init?:(options:{xfbml:boolean;version:string})=>void;XFBML?:{parse?:(root?:HTMLElement)=>void}};
const FACEBOOK_GRAPH_VERSION="v25.0";
async function fetchFromCandidates<T>(apiBaseUrl:string,path:string):Promise<T>{
  const bases=Array.from(new Set([apiBaseUrl,globalThis.location?.origin].filter(Boolean))) as string[];
  let last:unknown;
  for(const base of bases){try{const r=await fetch(`${base}${path}`,{credentials:"include"});if(!r.ok)throw new Error(String(r.status));return await r.json() as T;}catch(e){last=e;}}
  throw last instanceof Error?last:new Error("request_failed");
}

type ArticleEngagementEvent="view"|"share"|"pdf_download"|"internal_link";
async function postArticleEngagement(apiBaseUrl:string,articleId:string,event:ArticleEngagementEvent,path:string):Promise<void>{
  const base=apiBaseUrl.replace(/\/+$/u,"");
  try{await fetch(`${base}/api/articles/${encodeURIComponent(articleId)}/engagement`,{method:"POST",credentials:"include",keepalive:true,headers:{"Content-Type":"application/json"},body:JSON.stringify({event,path})});}catch{}
}

function sanitizeArchiveHtml(value:string):string{
  if(typeof DOMParser==="undefined")return "";
  const doc=new DOMParser().parseFromString(value,"text/html");
  const captured=doc.querySelector("[data-conversation-screenshot-content]");
  if(captured)doc.body.innerHTML=captured.innerHTML;
  doc.querySelectorAll("script,style,iframe,object,embed,form,svg,math,button,input,textarea,select").forEach((node)=>node.remove());
  doc.body.querySelectorAll("*").forEach((el)=>{
    Array.from(el.attributes).forEach((attr)=>{
      const name=attr.name.toLowerCase();
      const value=attr.value.trim().toLowerCase();
      if(name.startsWith("on")||name==="srcdoc"||name==="class"||name==="style"||name.startsWith("data-")||((name==="href"||name==="src")&&/^(javascript|data|vbscript):/.test(value)))el.removeAttribute(attr.name);
    });    if(el instanceof HTMLAnchorElement&&el.target==="_blank")el.rel="noopener noreferrer";
  });
  return doc.body.innerHTML;
}

export default function ArticleDetailPage(){
  const {apiBaseUrl}=useApp();
  const {slug="",category=""}=useParams();
  const [article,setArticle]=useState<Article|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [shareNotice,setShareNotice]=useState("");
  const [facebookCommentsState,setFacebookCommentsState]=useState<"loading"|"ready"|"error">("loading");
  useEffect(()=>{let cancelled=false;setError(null);setArticle(null);
    const load=async()=>{if(!category)return fetchFromCandidates<Article>(apiBaseUrl,`/api/articles/${encodeURIComponent(slug)}`);try{return await fetchFromCandidates<Article>(apiBaseUrl,`/api/articles/resolve/${encodeURIComponent(category)}/${encodeURIComponent(slug)}`);}catch{const list=await fetchFromCandidates<{items:Article[]}>(apiBaseUrl,"/api/articles?limit=100");const match=list.items.find(x=>asciiSlug(x.permalinkSlug||x.title)===slug&&categorySlug(x.categories,x.primaryCategory)===category);if(!match)throw new Error("404");return fetchFromCandidates<Article>(apiBaseUrl,`/api/articles/${encodeURIComponent(match.slug)}`);}};
    void load().then((x)=>{if(!cancelled){setArticle(x);const canonical=x.redirectTo||articlePath(x);if(globalThis.location.pathname!==canonical)globalThis.history.replaceState(null,"",canonical);}}).catch(()=>{if(!cancelled)setError("تعذّر العثور على المادة المؤرشفة.");});return()=>{cancelled=true};},[apiBaseUrl,slug,category]);
  const title=article?.title||"المقالات والأرشيف";
  const canonicalPath=article?articlePath(article):globalThis.location?.pathname||"/articles";
  const canonicalUrl=globalThis.location?new URL(canonicalPath,globalThis.location.origin).toString():canonicalPath;
  useEffect(()=>{if(!article?.id)return;const key=`watany_article_view_v1_${article.id}`;try{if(globalThis.sessionStorage?.getItem(key))return;globalThis.sessionStorage?.setItem(key,"1");}catch{}void postArticleEngagement(apiBaseUrl,article.id,"view",articlePath(article));},[apiBaseUrl,article?.id]);
  useEffect(()=>{if(!article||typeof document==="undefined")return;
    const seo=article.seo;const shareImage=seo?.ogImage||article.featuredImage||new URL("/logo.png?v=20260827-1",globalThis.location.origin).toString();const description=seo?.ogDescription||seo?.description||"مقال منشور على منصة موطني.";
    document.title=`${seo?.title||article.title} | موطني`;
    let link=document.querySelector<HTMLLinkElement>('link[rel="canonical"]');if(!link){link=document.createElement("link");link.rel="canonical";document.head.appendChild(link);}link.href=canonicalUrl;
    const setProperty=(property:string,content:string)=>{let node=document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);if(!node){node=document.createElement("meta");node.setAttribute("property",property);document.head.appendChild(node);}node.content=content;};
    const setName=(name:string,content:string)=>{let node=document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);if(!node){node=document.createElement("meta");node.name=name;document.head.appendChild(node);}node.content=content;};
    setName("description",seo?.description||description);setName("robots",seo?.robots||"index,follow");setName("twitter:card","summary_large_image");setName("twitter:title",seo?.ogTitle||seo?.title||article.title);setName("twitter:description",description);setName("twitter:image",shareImage);
    setProperty("og:url",canonicalUrl);setProperty("og:type","article");setProperty("og:title",seo?.ogTitle||seo?.title||article.title);setProperty("og:description",description);setProperty("og:image",shareImage);    const upsertJsonLd=(id:string,value:unknown)=>{let node=document.getElementById(id) as HTMLScriptElement|null;if(!node){node=document.createElement("script");node.id=id;node.type="application/ld+json";document.head.appendChild(node);}node.text=JSON.stringify(value);};
    upsertJsonLd("watany-article-jsonld",{"@context":"https://schema.org","@type":"Article",headline:article.title,description,image:[shareImage],datePublished:article.publishedAt||undefined,dateModified:article.updatedAt||article.publishedAt||undefined,author:{"@type":"Person",name:article.authorName||"موطني"},publisher:{"@type":"Organization",name:"موطني",logo:{"@type":"ImageObject",url:new URL("/logo.png?v=20260827-1",globalThis.location.origin).toString()}},mainEntityOfPage:canonicalUrl,articleSection:article.primaryCategory||article.categories[0]||undefined});
    upsertJsonLd("watany-breadcrumb-jsonld",{"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"موطني",item:globalThis.location.origin},{"@type":"ListItem",position:2,name:"المقالات",item:`${globalThis.location.origin}/articles`},{"@type":"ListItem",position:3,name:article.primaryCategory||article.categories[0]||"المقالات",item:canonicalUrl.substring(0,canonicalUrl.lastIndexOf("/"))},{"@type":"ListItem",position:4,name:article.title,item:canonicalUrl}]});
    let facebookPoll:ReturnType<typeof setTimeout>|undefined;
    let facebookCancelled=false;
    const commentsRoot=document.querySelector<HTMLElement>(".watany-article-comments");
    const parseFacebookComments=()=>{
      try{
        const fb=(globalThis as typeof globalThis&{FB?:FacebookSdk}).FB;
        if(!fb?.init||!fb.XFBML?.parse)throw new Error("FACEBOOK_SDK_NOT_READY");
        fb.init({xfbml:false,version:FACEBOOK_GRAPH_VERSION});
        fb.XFBML.parse(commentsRoot||undefined);
        let checks=0;
        const verify=()=>{
          if(facebookCancelled)return;
          if(commentsRoot?.querySelector("iframe")){setFacebookCommentsState("ready");return;}
          checks+=1;
          if(checks>=20){setFacebookCommentsState("error");return;}
          facebookPoll=globalThis.setTimeout(verify,250);
        };
        verify();
      }catch{if(!facebookCancelled)setFacebookCommentsState("error");}
    };
    setFacebookCommentsState("loading");
    const existing=document.getElementById("facebook-jssdk") as HTMLScriptElement|null;
    if(existing)parseFacebookComments();
    else{
      const script=document.createElement("script");
      script.id="facebook-jssdk";
      script.async=true;
      script.defer=true;
      script.crossOrigin="anonymous";
      script.src="https://connect.facebook.net/ar_AR/sdk.js";
      script.onload=parseFacebookComments;
      script.onerror=()=>{if(!facebookCancelled)setFacebookCommentsState("error");};
      document.body.appendChild(script);
    }
    return()=>{facebookCancelled=true;if(facebookPoll!==undefined)globalThis.clearTimeout(facebookPoll);};
  },[article,canonicalUrl]);
  function recordArticleEngagement(event:ArticleEngagementEvent):void{if(article?.id)void postArticleEngagement(apiBaseUrl,article.id,event,canonicalPath);}
  async function shareArticle(){if(!article)return;recordArticleEngagement("share");const payload={title:article.title,text:article.title,url:canonicalUrl};if(globalThis.navigator?.share){try{await globalThis.navigator.share(payload);return;}catch{}}await copyArticleLink(false);}
  async function copyArticleLink(record=true){if(record)recordArticleEngagement("share");try{await globalThis.navigator?.clipboard?.writeText(canonicalUrl);setShareNotice("تم نسخ الرابط");globalThis.setTimeout(()=>setShareNotice(""),1800);}catch{globalThis.prompt?.("انسخ الرابط",canonicalUrl);}}
  function shareFacebook(){recordArticleEngagement("share");globalThis.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonicalUrl)}`,"_blank","noopener,noreferrer,width=700,height=600");}
  function shareWhatsApp(){if(!article)return;recordArticleEngagement("share");globalThis.open(`https://wa.me/?text=${encodeURIComponent(`${article.title}\n${canonicalUrl}`)}`,"_blank","noopener,noreferrer");}
  function handleArticleContentClick(event:ReactMouseEvent<HTMLDivElement>):void{if(!article)return;const target=event.target;if(!(target instanceof Element))return;const anchor=target.closest("a");if(!(anchor instanceof HTMLAnchorElement))return;const href=anchor.getAttribute("href")||"";if(/\.pdf(?:$|[?#])/iu.test(href)){recordArticleEngagement("pdf_download");return;}try{const url=new URL(href,globalThis.location.origin);if(url.origin===globalThis.location.origin&&url.pathname.startsWith("/articles/"))recordArticleEngagement("internal_link");}catch{}}
  return <WatanyFeatureTemplate category="updates" eyebrow="أرشيف موطني" title={title} description={article?"مادة تاريخية محفوظة من بوابة قدامى العسكريين.":"تحميل المادة المؤرشفة…"} meta={article?[{label:"التاريخ",value:article.publishedAt?new Date(article.publishedAt).toLocaleDateString("ar-LB"):"—"}]:[]}>
    <article dir="rtl" data-watany-article-detail="v1">
      <p><Link to="/articles">العودة إلى الأرشيف</Link></p>
      {error?<p role="alert">{error}</p>:null}
      {!error&&!article?<p>جارٍ التحميل…</p>:null}
      {article?<>
        {article.featuredImage && !article.bodyHtml.includes(article.featuredImage)?<img className="watany-article-hero" src={article.featuredImage} alt="" />:null}
        <p>{article.authorName||"كاتب تاريخي"}{article.categories.length?` — ${article.categories.join(" · ")}`:""}</p>
        <div className="watany-article-share" aria-label="مشاركة المقال"><button type="button" className="watany-share-action watany-share-action--native" onClick={()=>void shareArticle()}><span className="watany-share-symbol" aria-hidden="true">↗</span><span>مشاركة</span></button><button type="button" className="watany-share-action watany-share-action--facebook" onClick={shareFacebook}><img src="/social-icons/facebook.ico" alt="" aria-hidden="true" /><span>فيسبوك</span></button><button type="button" className="watany-share-action watany-share-action--whatsapp" onClick={shareWhatsApp}><img src="/social-icons/whatsapp.ico" alt="" aria-hidden="true" /><span>واتساب</span></button><button type="button" className="watany-share-action watany-share-action--copy" onClick={()=>void copyArticleLink()}><span className="watany-share-symbol" aria-hidden="true">🔗</span><span>نسخ الرابط</span></button>{shareNotice?<span className="watany-share-notice" role="status">{shareNotice}</span>:null}</div>
        <FeatureAdSensePlacement featureId="articles" placement="inline" />
        <div className="watany-article-content" onClick={handleArticleContentClick} dangerouslySetInnerHTML={{__html:sanitizeArchiveHtml(article.bodyHtml)}} />
        <section className="watany-article-comments" data-facebook-comments-state={facebookCommentsState} aria-labelledby="article-comments-title">
          <div className="watany-comments-heading"><img src="/social-icons/facebook.ico" alt="" aria-hidden="true" /><div><h2 id="article-comments-title">التعليقات عبر فيسبوك</h2><p>شارك رأيك من خلال إضافة Facebook الرسمية. عند ظهور صندوق التعليقات يمكنك تسجيل الدخول إلى حسابك على فيسبوك والتعليق مباشرة.</p></div></div>
          <div id="fb-root" />
          {facebookCommentsState==="loading"?<div className="watany-comments-status" role="status">جارٍ تحميل تعليقات فيسبوك…</div>:null}
          {facebookCommentsState==="error"?<div className="watany-comments-status watany-comments-status--error" role="alert"><strong>تعذّر تحميل تعليقات فيسبوك.</strong><span>قد تمنع إعدادات الخصوصية أو حظر التتبع الإضافة. حدّث الصفحة أو اسمح بمحتوى Facebook ثم أعد المحاولة.</span></div>:null}
          <div className="fb-comments" data-href={canonicalUrl} data-width="100%" data-numposts="10" data-order-by="social" data-lazy="true" />
        </section>
      </>:null}
    </article>  </WatanyFeatureTemplate>;
}
