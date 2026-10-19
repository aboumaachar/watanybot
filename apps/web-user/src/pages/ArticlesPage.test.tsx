/** @vitest-environment happy-dom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ArticlesPage from "./ArticlesPage";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../store/app",()=>({useApp:()=>({apiBaseUrl:"http://api.test"})}));
vi.mock("../components/template",()=>({
  WatanyFeatureTemplate:({children}:{children:React.ReactNode})=><main>{children}</main>,
}));

function LocationMarker(){
  const {pathname,search}=useLocation();
  return <span data-location>{pathname+search}</span>;
}
const article=(id:number)=>({
  id:String(id),slug:"post-"+id,title:"Article "+id,excerpt:null,publishedAt:null,
  authorName:null,featuredImage:null,categories:["اخبار"],tags:[],
  permalinkSlug:"post-"+id,primaryCategory:"اخبار",
  seo:{canonicalUrl:"https://koudama.com/articles/akhbar/post-"+id},
});

describe("ArticlesPage crawlable navigation",()=>{
  let root:Root;
  let container:HTMLDivElement;
  let urls:string[];
  const previousFetch=globalThis.fetch;

  beforeEach(()=>{
    urls=[];
    container=document.createElement("div");
    document.body.appendChild(container);
    root=createRoot(container);
    globalThis.fetch=vi.fn(async (input:RequestInfo|URL)=>{
      const url=new URL(String(input));
      urls.push(url.toString());
      if(url.pathname.endsWith("/api/articles/categories")){
        return new Response(JSON.stringify({categories:[{id:"c1",name:"اخبار",slug:"akhbar",count:192}]}),{status:200});
      }
      if(url.pathname.endsWith("/api/articles")){
        const offset=Number(url.searchParams.get("offset")||"0");
        const filtered=url.searchParams.has("category");
        const total=filtered?65:192;
        const count=Math.min(Number(url.searchParams.get("limit")||"51"),Math.max(0,total-offset));
        const items=Array.from({length:count},(_,i)=>article(i+offset+1));
        return new Response(JSON.stringify({items}),{status:200});
      }
      return new Response("unknown",{status:404});
    }) as typeof fetch;
  });

  afterEach(async ()=>{
    await act(async()=>root.unmount());
    container.remove();
    globalThis.fetch=previousFetch;
    vi.restoreAllMocks();
  });

  async function mount(url="/articles"){
    await act(async()=>{
      root.render(<MemoryRouter initialEntries={[url]} future={{v7_startTransition:true,v7_relativeSplatPath:true}}>
        <LocationMarker/>
        <Routes><Route path="/articles" element={<ArticlesPage/>}/></Routes>
      </MemoryRouter>);
    });
    await act(async()=>{for(let i=0;i<6;i++)await Promise.resolve();});
  }
  async function click(link:Element){
    await act(async()=>{link.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true}));});
    await act(async()=>{for(let i=0;i<6;i++)await Promise.resolve();});
  }

  it("uses 51-item lookahead and exposes the second page with canonical article links",async()=>{
    await mount();
    expect(container.querySelectorAll(".watany-article-card")).toHaveLength(50);
    expect(urls.some(url=>url.includes("limit=51")&&url.includes("offset=0"))).toBe(true);
    const canonical=container.querySelector<HTMLAnchorElement>(".watany-article-card h2 a");
    expect(canonical?.getAttribute("href")).toBe("/articles/akhbar/post-1");
    const next=Array.from(container.querySelectorAll("a")).find(x=>x.textContent==="التالي");
    expect(next?.getAttribute("href")).toBe("/articles?page=2");
    await click(next!);
    expect(container.querySelector("[data-location]")?.textContent).toBe("/articles?page=2");
    expect(urls.some(url=>url.includes("limit=51")&&url.includes("offset=50"))).toBe(true);
    expect(container.querySelectorAll(".watany-article-card")).toHaveLength(50);
    expect(Array.from(container.querySelectorAll("a")).some(x=>x.textContent==="السابق")).toBe(true);
  });

  it("links categories to a stable query URL and paginates filtered results",async()=>{
    await mount();
    const category=Array.from(container.querySelectorAll(".watany-articles-categories a")).find(x=>x.textContent?.includes("اخبار"));
    expect(category?.getAttribute("href")).toBe("/articles?category=%D8%A7%D8%AE%D8%A8%D8%A7%D8%B1");
    await click(category!);
    expect(container.querySelector("[data-location]")?.textContent).toBe("/articles?category=%D8%A7%D8%AE%D8%A8%D8%A7%D8%B1");
    expect(urls.some(url=>url.includes("category=%D8%A7%D8%AE%D8%A8%D8%A7%D8%B1")&&url.includes("offset=0"))).toBe(true);
    const next=Array.from(container.querySelectorAll("a")).find(x=>x.textContent==="التالي");
    expect(next).toBeTruthy();
    await click(next!);
    expect(urls.some(url=>url.includes("offset=50")&&url.includes("category="))).toBe(true);
    expect(container.querySelectorAll(".watany-article-card")).toHaveLength(15);
    expect(Array.from(container.querySelectorAll("a")).some(x=>x.textContent==="التالي")).toBe(false);
  });
});
