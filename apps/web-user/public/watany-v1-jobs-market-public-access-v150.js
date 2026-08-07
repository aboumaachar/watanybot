
(function(){
"use strict";
var MARK="watany-v1-jobs-market-public-access-v150";
if(window[MARK])return; window[MARK]=true;
if(window.watanyPublicRuntimeScopeV1&&!window.watanyPublicRuntimeScopeV1.shouldRun(MARK))return;
var JOBS=[
 {label:"وظائف مدنية",icon:"💼",sub:"فرص عمل للمتقاعدين والعائلات"},
 {label:"فرص يومية",icon:"📌",sub:"آخر الفرص المضافة"},
 {label:"عمل حر",icon:"🧰",sub:"مهارات وخدمات حرة"},
 {label:"تطوع",icon:"🤝",sub:"فرص تطوعية ومجتمعية"}
];
var MARKET=[
 {label:"السوق",icon:"🛒",sub:"تصفح الإعلانات بدون تسجيل"},
 {label:"إعلانات",icon:"📣",sub:"بيع وشراء وخدمات"},
 {label:"خدمات",icon:"🧑‍🔧",sub:"مزودو خدمات ومهارات"},
 {label:"طلب مساعدة",icon:"🫶",sub:"طلبات ومبادرات"}
];
function norm(s){return String(s||"").replace(/[\u064B-\u065F\u0670]/g,"").replace(/[أإآ]/g,"ا").replace(/ة/g,"ه").replace(/\s+/g," ").trim().toLowerCase();}
function hasAny(t,a){var n=norm(t);return a.some(function(x){return n.indexOf(norm(x))>=0;});}
function isAgent5Node(node){return !!(node&&node.closest&&node.closest('.kw-agent5-root, .kw-profile-sheet, .kw-group-sheet, .kw-child-grid, .kw-child-item'));}
function topOffset(){var best=62;Array.prototype.slice.call(document.querySelectorAll("header,[class*='header' i],[class*='top' i],[class*='nav' i]")).forEach(function(el){var cs=getComputedStyle(el),r=el.getBoundingClientRect();if((cs.position==="fixed"||cs.position==="sticky")&&r.height>20&&r.top<=12)best=Math.max(best,Math.min(130,Math.round(r.bottom+4)));});document.documentElement.style.setProperty("--watany-v1-jm-top",best+"px");}
function flags(){document.documentElement.setAttribute("data-watany-v1-public-access","true");document.documentElement.setAttribute("data-watany-v1-market-public-view","true");document.documentElement.setAttribute("data-watany-v1-jobs-listed","true");try{localStorage.setItem("watany_v1_public_access","true");localStorage.setItem("watany_market_public_view","true");localStorage.setItem("watany_jobs_visible","true");}catch(e){}}
function closePop(){var a=document.getElementById("watany-v1-jm-backdrop");if(a)a.remove();var b=document.getElementById("watany-v1-jm-popup");if(b)b.remove();}
function popup(title,items,note){topOffset();closePop();var bd=document.createElement("div");bd.id="watany-v1-jm-backdrop";bd.className="watany-v1-jm-backdrop";bd.addEventListener("click",closePop);var p=document.createElement("section");p.id="watany-v1-jm-popup";p.className="watany-v1-jm-popup";p.setAttribute("role","dialog");p.setAttribute("dir","rtl");var h=document.createElement("div");h.className="watany-v1-jm-head";var t=document.createElement("h2");t.className="watany-v1-jm-title";t.textContent=title;var c=document.createElement("button");c.className="watany-v1-jm-close";c.type="button";c.textContent="×";c.addEventListener("click",closePop);h.appendChild(t);h.appendChild(c);p.appendChild(h);var g=document.createElement("div");g.className="watany-v1-jm-grid";items.forEach(function(it){var b=document.createElement("button");b.type="button";b.className="watany-v1-jm-card";b.setAttribute("dir","rtl");var i=document.createElement("span");i.className="watany-v1-jm-icon";i.textContent=it.icon;var l=document.createElement("span");l.className="watany-v1-jm-label";l.textContent=it.label;var s=document.createElement("span");s.className="watany-v1-jm-sub";s.textContent=it.sub||"";b.appendChild(i);b.appendChild(l);b.appendChild(s);g.appendChild(b);});p.appendChild(g);if(note){var n=document.createElement("p");n.className="watany-v1-jm-note";n.textContent=note;p.appendChild(n);}document.body.appendChild(bd);document.body.appendChild(p);}
function showJobs(){popup("الوظائف",JOBS,"تم إظهار الوظائف كقسم قابل للتصفح ضمن نسخة V1 العامة. أي تقديم أو تعديل يبقى خاضعاً لسياسات الإدارة لاحقاً.");}
function showMarket(){popup("السوق",MARKET,"التصفح العام للسوق متاح حالياً بدون تسجيل. النشر أو التعديل يمكن ضبطه لاحقاً حسب سياسة الإشراف.");}
function isInteractive(el){if(!el||!el.textContent)return false;var tag=(el.tagName||"").toLowerCase();return tag==="a"||tag==="button"||el.getAttribute("role")==="button"||/card|tile|item|nav|menu/i.test(el.className||"");}
function nearest(el){var d=0;while(el&&d<7&&el!==document.body){if(isInteractive(el))return el;el=el.parentElement;d++;}return el;}
function routeNode(node){return !!(node&&node.closest)&&node.closest("a[href],button[data-route],[data-route],[data-href]");}
function isLegacyLauncherNode(node){return !!(node&&node.closest&&node.closest('.watany-drawer-page,.watany-drawer-phone,.watany-icon-grid,.watany-app-icon,.watany-mobile-shell__drawer-handle,.watany-mobile-shell__history-nav'));}
function ownsRouterNavigation(node){if(isLegacyLauncherNode(node))return true;var owner=routeNode(node);if(!owner)return false;var route=owner.getAttribute("href")||owner.getAttribute("data-route")||owner.getAttribute("data-href")||"";return /(^|\/+)(jobs|marketplace|world-cup|procedures)(?:[/?#]|$)/i.test(route);}
function hideLogin(){Array.prototype.slice.call(document.querySelectorAll("a,button,[role='button'],div,section,p,span")).forEach(function(el){if(isAgent5Node(el))return;var tx=el.textContent||"";if(hasAny(tx,["تسجيل الدخول مطلوب","يجب تسجيل الدخول","Login required","Please login","سجّل الدخول"])){el.setAttribute("data-watany-v1-login-prompt-hidden","true");el.style.display="none";}});}
function wire(){Array.prototype.slice.call(document.querySelectorAll("a,button,[role='button'],[class*='tile' i],[class*='card' i]")).forEach(function(n){if(isAgent5Node(n)||ownsRouterNavigation(n))return;var tx=n.textContent||"";if(!n.getAttribute("data-watany-v1-jobs-wired")&&hasAny(tx,["الوظائف","وظائف","Jobs","jobs"])){n.setAttribute("data-watany-v1-jobs-wired","true");n.addEventListener("click",function(ev){if(ownsRouterNavigation(ev.target))return;ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();showJobs();return false;},true);}if(!n.getAttribute("data-watany-v1-market-wired")&&hasAny(tx,["السوق","Market","market"])){n.setAttribute("data-watany-v1-market-wired","true");n.addEventListener("click",function(ev){if(ownsRouterNavigation(ev.target))return;ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();showMarket();return false;},true);}});}
function router(ev){if(ownsRouterNavigation(ev.target))return;var n=nearest(ev.target);if(isAgent5Node(n)||ownsRouterNavigation(n))return;var tx=n&&n.textContent?n.textContent:"";if(hasAny(tx,["الوظائف","وظائف","Jobs","jobs"])){ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();showJobs();return false;}if(hasAny(tx,["السوق","Market","market"])){ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();showMarket();return false;}}
function init(){flags();topOffset();hideLogin();wire();document.addEventListener("click",router,true);window.addEventListener("resize",topOffset);window.watanyV1ShowJobs=showJobs;window.watanyV1ShowMarket=showMarket;window.watanyV1CloseJobsMarketPopup=closePop;window.watanyV1JobsMarketPublicAccessReady=true;var mo=new MutationObserver(function(){flags();topOffset();hideLogin();wire();});mo.observe(document.documentElement,{childList:true,subtree:true});}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
