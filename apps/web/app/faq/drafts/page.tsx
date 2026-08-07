"use client";
import { useEffect, useState, useMemo } from "react";

type Ref = { law_code: string; article_no: string; note?: string };

type Draft = {
  faq_id: number;
  question_ar: string;
  question_norm: string;
  answer_ar: string;
  answer_official_ar?: string | null;
  refs_json?: Ref[] | null;
  topic_code?: string | null;
  tags_json?: string[] | null;
  needs_review?: boolean;
  hits_total: number;
  last_asked_at?: string | null;
};

function card(){ return "rounded-2xl border bg-white p-5 shadow-sm"; }
function btn(){ return "rounded-2xl border px-4 py-3 bg-white shadow-sm hover:bg-gray-50 transition"; }
function bigBtn(){ return "w-full rounded-2xl px-4 py-4 text-right text-xl border bg-white shadow-sm hover:bg-gray-50 transition"; }

export default function Drafts(){
  const [list, setList] = useState<Draft[]>([]);
  const [sel, setSel] = useState<Draft | null>(null);
  const [answer, setAnswer] = useState("");
  const [officialAnswer, setOfficialAnswer] = useState("");
  const [topic, setTopic] = useState<string>("");
  const [resuggestLoading, setResuggestLoading] = useState(false);
  const [reviewer, setReviewer] = useState<string>("");

  // Filters
  const [filterTopic, setFilterTopic] = useState<string>("");
  const [filterTag, setFilterTag] = useState<string>("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"hits"|"date">("hits");
  const [onlyNeedsReview, setOnlyNeedsReview] = useState(false);
  const [onlyNoRefs, setOnlyNoRefs] = useState(false);
  const [onlyNoOfficial, setOnlyNoOfficial] = useState(false);

  async function load(){
    const r = await fetch("/v1/faq/drafts?limit=200");
    if(r.ok) setList(await r.json());
  }

  useEffect(()=>{ load(); },[]);

  // Derived filter options
  const allTopics = useMemo(() => 
    [...new Set(list.map(d => d.topic_code).filter(Boolean))] as string[], 
    [list]
  );
  const allTags = useMemo(() => 
    [...new Set(list.flatMap(d => d.tags_json || []))], 
    [list]
  );

  // Filtered list
  const filtered = useMemo(() => {
    let out = [...list];
    if(filterTopic) out = out.filter(d => d.topic_code === filterTopic);
    if(filterTag) out = out.filter(d => d.tags_json?.includes(filterTag));
    if(search) out = out.filter(d => d.question_ar.includes(search) || d.question_norm.includes(search.toLowerCase()));
    if(onlyNeedsReview) out = out.filter(d => d.needs_review);
    if(onlyNoRefs) out = out.filter(d => !d.refs_json || d.refs_json.length === 0);
    if(onlyNoOfficial) out = out.filter(d => !d.answer_official_ar);
    // Sort
    if(sort === "hits") out.sort((a,b) => b.hits_total - a.hits_total);
    else out.sort((a,b) => (b.last_asked_at || "").localeCompare(a.last_asked_at || ""));
    return out;
  }, [list, filterTopic, filterTag, search, sort, onlyNeedsReview, onlyNoRefs, onlyNoOfficial]);

  async function save(){
    if(!sel) return;
    await fetch(`/v1/faq/drafts/${sel.faq_id}/update`, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        answer_ar: answer,
        answer_official_ar: officialAnswer || null,
        topic_code: topic || null,
        tags_json: sel.tags_json || [],
        refs_json: sel.refs_json || []
      })
    });
    await load();
  }

  async function publish(){
    if(!sel) return;
    await fetch(`/v1/faq/drafts/${sel.faq_id}/publish`, { method:"POST" });
    setSel(null);
    setAnswer("");
    setOfficialAnswer("");
    setTopic("");
    await load();
  }

  async function resuggest(){
    if(!sel) return;
    setResuggestLoading(true);
    try {
      const r = await fetch(`/v1/faq/drafts/${sel.faq_id}/resuggest?max_refs=5&update_topic_and_tags=true`, { method:"POST" });
      if(!r.ok) return;
      await load();
      // أعد تحميل المسودة المختارة من اللائحة بعد التحديث
      const updated = (await (await fetch("/v1/faq/drafts?limit=200")).json()) as Draft[];
      const found = updated.find(x => x.faq_id === sel.faq_id) || null;
      if(found) selectDraft(found);
    } finally {
      setResuggestLoading(false);
    }
  }

  async function compose(){
    if(!sel) return;
    const r = await fetch(`/v1/faq/drafts/${sel.faq_id}/compose`, { method:"POST" });
    if(!r.ok) return;
    await load();
    const updated = (await (await fetch("/v1/faq/drafts?limit=200")).json()) as Draft[];
    const found = updated.find(x => x.faq_id === sel.faq_id) || null;
    if(found) selectDraft(found);
  }

  async function assign(){
    if(!sel) return;
    const name = reviewer.trim();
    if(!name) return;
    const r = await fetch(`/v1/faq/drafts/${sel.faq_id}/assign`, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ reviewer_name: name })
    });
    if(!r.ok) return;
    await load();
  }

  function selectDraft(d: Draft){
    setSel(d);
    setAnswer(d.answer_ar || "");
    setOfficialAnswer(d.answer_official_ar || "");
    setTopic(d.topic_code || "");
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto p-4 pt-8">
        <div className={card()}>
          <div className="text-2xl font-extrabold">🛠️ مسودات FAQ (تلقائية)</div>
          <div className="opacity-90 mt-2">هاي أسئلة متكررة ما كان إلها جواب جاهز، انعملت مسودة تلقائياً.</div>

          {!sel ? (
            <div className="mt-5 grid gap-3">
              {/* Filters */}
              <div className="flex flex-wrap gap-2 items-center bg-gray-50 rounded-xl p-3">
                <input 
                  className="rounded-xl border px-3 py-2 text-sm flex-1 min-w-[150px]" 
                  placeholder="بحث..." 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                />
                <select 
                  className="rounded-xl border px-3 py-2 text-sm bg-white"
                  value={filterTopic}
                  onChange={(e) => setFilterTopic(e.target.value)}
                >
                  <option value="">كل المواضيع</option>
                  {allTopics.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select 
                  className="rounded-xl border px-3 py-2 text-sm bg-white"
                  value={filterTag}
                  onChange={(e) => setFilterTag(e.target.value)}
                >
                  <option value="">كل الوسوم</option>
                  {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select 
                  className="rounded-xl border px-3 py-2 text-sm bg-white"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as "hits"|"date")}
                >
                  <option value="hits">ترتيب: الأكثر تكراراً</option>
                  <option value="date">ترتيب: الأحدث</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={onlyNeedsReview} onChange={(e)=>setOnlyNeedsReview(e.target.checked)} />
                  بحاجة مراجعة
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={onlyNoRefs} onChange={(e)=>setOnlyNoRefs(e.target.checked)} />
                  بدون مراجع
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={onlyNoOfficial} onChange={(e)=>setOnlyNoOfficial(e.target.checked)} />
                  بدون جواب رسمي
                </label>
              </div>

              <div className="text-sm opacity-70 mt-2">عدد النتائج: {filtered.length}</div>

              {/* Draft list */}
              {filtered.map(x=>(
                <button key={x.faq_id} className={bigBtn()} onClick={() => selectDraft(x)}>
                  <div className="flex justify-between items-start">
                    <span>({x.hits_total}) {x.question_ar}</span>
                    <div className="flex gap-1 text-xs">
                      {x.needs_review && <span className="bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded">مراجعة</span>}
                      {x.topic_code && <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{x.topic_code}</span>}
                    </div>
                  </div>
                </button>
              ))}
              {filtered.length===0 && <div className="opacity-80">ما في مسودات مطابقة.</div>}
              <a className={bigBtn()} href="/faq/review">📊 لوحة عمل المراجعين</a>
              <a className={bigBtn()} href="/faq">⬅️ رجوع للأسئلة الشائعة</a>
            </div>
          ) : (
            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl border p-4">
                <div className="font-extrabold text-lg">السؤال</div>
                <div className="mt-2">{sel.question_ar}</div>
                <div className="opacity-80 mt-2">التكرار: {sel.hits_total} — آخر مرة: {sel.last_asked_at || "-"}</div>
                {sel.tags_json && sel.tags_json.length > 0 && (
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {sel.tags_json.map(t => <span key={t} className="bg-gray-200 px-2 py-0.5 rounded text-sm">{t}</span>)}
                  </div>
                )}
              </div>

              {/* Refs display */}
              {sel.refs_json && sel.refs_json.length > 0 && (
                <div className="rounded-2xl border p-4 bg-blue-50">
                  <div className="font-bold text-sm mb-2">📖 المراجع القانونية المقترحة</div>
                  {sel.refs_json.map((ref, i) => (
                    <div key={i} className="text-sm mb-1">
                      • {ref.law_code} — المادة {ref.article_no}
                      {ref.note && <span className="opacity-70 mr-2">({ref.note})</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Official answer excerpt */}
              {sel.answer_official_ar && (
                <div className="rounded-2xl border p-4 bg-green-50">
                  <div className="font-bold text-sm mb-2">📜 المقتطف الرسمي</div>
                  <div className="text-sm whitespace-pre-wrap">{sel.answer_official_ar}</div>
                </div>
              )}

              <input 
                className="rounded-2xl border px-4 py-3 text-lg" 
                placeholder="Topic code (اختياري مثل PENSIONS)" 
                value={topic} 
                onChange={(e)=>setTopic(e.target.value)} 
              />

              <div>
                <label className="text-sm font-bold mb-1 block">الجواب الرسمي (للتحرير)</label>
                <textarea 
                  className="w-full rounded-2xl border px-4 py-3 text-base min-h-[100px] bg-green-50" 
                  value={officialAnswer} 
                  onChange={(e)=>setOfficialAnswer(e.target.value)}
                  placeholder="أكتب أو عدل الجواب الرسمي هنا..."
                />
              </div>

              <div>
                <label className="text-sm font-bold mb-1 block">الجواب المبسط (للمستخدم)</label>
                <textarea 
                  className="w-full rounded-2xl border px-4 py-3 text-lg min-h-[180px]" 
                  value={answer} 
                  onChange={(e)=>setAnswer(e.target.value)}
                  placeholder="أكتب أو عدل الجواب المبسط هنا..."
                />
              </div>

              <div className="rounded-2xl border p-4 grid gap-2">
                <div className="font-extrabold text-lg">👤 تعيين لمراجع</div>
                <input
                  className="rounded-2xl border px-4 py-3 text-lg"
                  placeholder="اسم المراجع (مثلاً: لجنة المعاشات)"
                  value={reviewer}
                  onChange={(e)=>setReviewer(e.target.value)}
                />
                <button className={btn()} onClick={assign}>📌 عيّن للمراجعة</button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button 
                  className={`${btn()} ${resuggestLoading ? 'opacity-50' : ''}`} 
                  onClick={resuggest}
                  disabled={resuggestLoading}
                >
                  {resuggestLoading ? '⏳ جاري...' : '🔎 اعثر على إحالات تلقائياً'}
                </button>
                <button className={btn()} onClick={compose}>✍️ اقترح جواب مبسّط</button>
                <button className={btn()} onClick={save}>💾 حفظ</button>
                <button className={btn()} onClick={publish}>✅ نشر بعد المراجعة</button>
                <button className={btn()} onClick={()=>{ setSel(null); setAnswer(""); setOfficialAnswer(""); setTopic(""); }}>↩️ رجوع</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
