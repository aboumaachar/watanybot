import { useEffect, useMemo, useState } from "react";
import type { PensionCalcResult, SalaryMeta } from "../../types/domain";
import { api } from "../../lib/api";
import { useApp } from "../../store/app";
import { PopupModal } from "../PopupModal";

type Props = Readonly<{
  onDone?: () => void;
}>;

type PickerItem = { id: string; label: string; sub?: string };

function fmt(n: number) {
  try {
    return new Intl.NumberFormat("ar-LB").format(Math.round(n));
  } catch {
    return String(Math.round(n));
  }
}

function SmallStat({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="wt-stat">
      <div className="wt-stat-label">{label}</div>
      <div className="wt-stat-value">{value}</div>
    </div>
  );
}

function PickerModal({
  open,
  title,
  items,
  selectedId,
  onPick,
  onClose,
}: Readonly<{
  open: boolean;
  title: string;
  items: PickerItem[];
  selectedId?: string;
  onPick: (id: string) => void;
  onClose: () => void;
}>) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const t = q.trim();
    if (!t) return items;
    return items.filter((it) => (it.label + " " + (it.sub || "")).toLowerCase().includes(t.toLowerCase()));
  }, [q, items]);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  return (
    <PopupModal open={open} title={title} onClose={onClose} compactMobile>
      <div className="wt-picker">
        <input
          className="wt-input wt-input--search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="دوّر…"
        />
        <div className="wt-picker-list">
          {filtered.map((it) => (
            <button
              key={it.id}
              data-feature-key={it.id}
              className={`wt-picker-item ${selectedId === it.id ? "on" : ""}`}
              onClick={() => {
                onPick(it.id);
                onClose();
              }}
            >
              <div className="wt-picker-main">{it.label}</div>
              {it.sub && <div className="wt-picker-sub">{it.sub}</div>}
            </button>
          ))}
        </div>
      </div>
    </PopupModal>
  );
}

export function SalarySheet({ onDone }: Props) {
  const { apiBaseUrl } = useApp();
  const [meta, setMeta] = useState<SalaryMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  // Defaults per request
  const [rank, setRank] = useState("جندي");
  const [degree, setDegree] = useState(1);
  const [married, setMarried] = useState(true);
  const [kids, setKids] = useState(0);
  const [medals, setMedals] = useState<string[]>([]);

  const [calc, setCalc] = useState<PensionCalcResult | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [picker, setPicker] = useState<null | "rank" | "degree" | "marital" | "kids" | "medals">(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api
      .salaryMeta(apiBaseUrl)
      .then((m) => {
        if (!mounted) return;
        setMeta(m);
        // Apply best-effort default medal ("ميدالية عسكرية") if present
        const defaultMedal = m.ornamentChoices.find((o) => o.name_ar.includes("عسكرية"));
        if (defaultMedal) setMedals([defaultMedal.id]);
      })
      .catch(() => {
        if (!mounted) return;
        setErr("ما قدرنا نحمّل بيانات الحاسبة.");
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [apiBaseUrl]);

  const rankInfo = useMemo(() => meta?.ranks.find((r) => r.rank === rank), [meta, rank]);
  const maxDegree = rankInfo?.maxDegree || 30;

  const rankItems: PickerItem[] = useMemo(() => {
    if (!meta) return [];
    return meta.ranks.map((r) => ({ id: r.rank, label: r.rank, sub: `حدّها درجة ${r.maxDegree}` }));
  }, [meta]);

  const degreeItems: PickerItem[] = useMemo(() => {
    const items: PickerItem[] = [];
    for (let i = 1; i <= Math.min(60, maxDegree); i++) items.push({ id: String(i), label: `درجة ${i}` });
    return items;
  }, [maxDegree]);

  const maritalItems: PickerItem[] = [
    { id: "married", label: "متزوج" },
    { id: "single", label: "عازب" },
  ];

  const kidsItems: PickerItem[] = useMemo(() => {
    return Array.from({ length: 6 }).map((_, i) => ({ id: String(i), label: i === 0 ? "ما في ولاد" : `${i} ولاد` }));
  }, []);

  const selectedMedalsLabel = useMemo(() => {
    if (!meta) return "—";
    if (!medals.length) return "ما في";
    const names = medals
      .map((id) => meta.ornamentChoices.find((o) => o.id === id)?.name_ar)
      .filter(Boolean);
    return names.join("، ");
  }, [meta, medals]);

  async function runCalc() {
    if (!meta) return;
    setErr("");
    setLoading(true);
    try {
      const res = await api.salaryCalc(
        { rank, degree, married, kidsCount: kids, selectedOrnaments: medals },
        apiBaseUrl
      );
      setCalc(res);
      setDetailsOpen(true);
    } catch {
      setErr("ما ظبطت الحسبة… جرّب كمان مرة.");
    } finally {
      setLoading(false);
    }
  }

  function toggleMedal(id: string) {
    setMedals((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="wt-salary">
      <div className="wt-salary-controls">
        <button className="wt-pill" onClick={() => setPicker("rank")}>
          <span className="k">الرتبة</span>
          <span className="v">{rank}</span>
        </button>

        <button className="wt-pill" onClick={() => setPicker("degree")}>
          <span className="k">الدرجة</span>
          <span className="v">{degree}</span>
        </button>

        <button className="wt-pill" onClick={() => setPicker("marital")}>
          <span className="k">الحالة</span>
          <span className="v">{married ? "متزوج" : "عازب"}</span>
        </button>

        <button className="wt-pill" onClick={() => setPicker("kids")}>
          <span className="k">الولاد</span>
          <span className="v">{kids === 0 ? "—" : kids}</span>
        </button>

        <button className="wt-pill" onClick={() => setPicker("medals")}>
          <span className="k">الأوسمة</span>
          <span className="v">{medals.length ? medals.length : "—"}</span>
        </button>
      </div>

      {picker === "medals" && meta && (
        <div className="wt-medals">
          <div className="wt-medals-hint">اختَر وسام أو أكتر (حسب ملفّك). إذا مش متأكد، خلّيها فاضية.</div>
          <div className="wt-medals-list">
            {meta.ornamentChoices.map((o) => (
              <button
                key={o.id}
                data-feature-key={o.id}
                className={`wt-medal ${medals.includes(o.id) ? "on" : ""}`}
                onClick={() => toggleMedal(o.id)}
              >
                <div className="t">{o.name_ar}</div>
                <div className="s">شهرياً: {fmt(o.monthlyValue)} ل.ل</div>
              </button>
            ))}
          </div>
          <div className="wt-actions-row">
            <button className="wt-btn wt-btn--ghost" onClick={() => setPicker(null)}>
              تم
            </button>
          </div>
        </div>
      )}

      {err && <div className="wt-banner wt-banner--danger">{err}</div>}

      <div className="wt-actions-row">
        <button className="wt-btn" onClick={runCalc} disabled={loading || !meta}>
          {loading ? "عم نحسب…" : "احسب"}
        </button>
        <button
          className="wt-btn wt-btn--ghost"
          onClick={() => {
            setCalc(null);
            setDetailsOpen(false);
            onDone?.();
            // focus chat
            globalThis.dispatchEvent(new Event("watany-focus-chat"));
          }}
        >
          رجوع عالدردشة
        </button>
      </div>

      {calc && (
        <div className="wt-salary-result">
          <div className="wt-stats">
            <SmallStat label="المعاش" value={`${fmt(calc.totalPension)} ل.ل`} />
            <SmallStat label="بالدولار" value={`$${fmt(calc.totalPensionUsd)}`} />
            <SmallStat label="بعد الزيادة الإضافية ٦×" value={`${fmt(calc.raise.totalAfterSixRaise)} ل.ل`} />
            <SmallStat label="بعد الزيادة الإضافية ٥٠٪" value={`${fmt(calc.fiftyPctRaise.totalAfterFiftyPct)} ل.ل`} />
          </div>

          <button className="wt-accordion" onClick={() => setDetailsOpen((v) => !v)}>
            <span>التفاصيل</span>
            <span className="chev">{detailsOpen ? "▲" : "▼"}</span>
          </button>

          {detailsOpen && (
            <div className="wt-details">
              <div className="wt-details-row">
                <div className="lbl">أساس</div>
                <div className="val">{fmt(calc.breakdown.basicSalary)} ل.ل</div>
              </div>
              <div className="wt-details-row">
                <div className="lbl">بدلات عائلية</div>
                <div className="val">{fmt(calc.breakdown.familyAllowance.total)} ل.ل</div>
              </div>
              <div className="wt-details-row">
                <div className="lbl">اقتطاع 1.5 % =</div>
                <div className="val">-{fmt(calc.breakdown.deduction15Pct)} ل.ل</div>
              </div>
              <div className="wt-details-row">
                <div className="lbl">أوسمة (شهري)</div>
                <div className="val">{fmt(calc.breakdown.medals.total)} ل.ل</div>
              </div>
              <div className="wt-details-row">
                <div className="lbl">الأوسمة المختارة</div>
                <div className="val">{selectedMedalsLabel}</div>
              </div>

              <div className="wt-details-sep" />

              <div className="wt-details-row">
                <div className="lbl">المعاش ٢٠٢٦</div>
                <div className="val">{fmt(calc.breakdown.pension2026)} ل.ل</div>
              </div>
              <div className="wt-details-row">
                <div className="lbl">المعاش ٢٠٢٦ (USD)</div>
                <div className="val">${fmt(calc.breakdown.pension2026usd)}</div>
              </div>

              <div className="wt-details-sep" />

              <div className="wt-details-row">
                <div className="lbl">سعر الصرف</div>
                <div className="val">{fmt(calc.usdRate)} ل.ل</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pickers */}
      <PickerModal
        open={picker === "rank"}
        title="اختَر الرتبة"
        items={rankItems}
        selectedId={rank}
        onPick={(id) => {
          setRank(id);
          setDegree(1);
          setPicker("degree");
        }}
        onClose={() => setPicker(null)}
      />

      <PickerModal
        open={picker === "degree"}
        title="اختَر الدرجة"
        items={degreeItems}
        selectedId={String(degree)}
        onPick={(id) => setDegree(Number(id) || 1)}
        onClose={() => setPicker(null)}
      />

      <PickerModal
        open={picker === "marital"}
        title="الحالة العائلية"
        items={maritalItems}
        selectedId={married ? "married" : "single"}
        onPick={(id) => {
          const isMarried = id === "married";
          setMarried(isMarried);
          if (!isMarried) {
            setKids(0);
          }
        }}
        onClose={() => setPicker(null)}
      />

      <PickerModal
        open={picker === "kids"}
        title="عدد الولاد (من ٠ لـ ٥)"
        items={kidsItems}
        selectedId={String(kids)}
        onPick={(id) => setKids(Math.max(0, Math.min(5, Number(id) || 0)))}
        onClose={() => setPicker(null)}
      />

      {/* medals picker is inline list above */}
    </div>
  );
}
