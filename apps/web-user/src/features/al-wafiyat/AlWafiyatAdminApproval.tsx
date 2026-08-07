import { startTransition, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { AlWafiyatCard } from "./AlWafiyatCard";
import { previewAlWafiyatImport, runAlWafiyatImport, decideAlWafiyatNotice } from "./alWafiyat.importer";
import type { AlWafiyatHealthRecord, AlWafiyatNotice, AlWafiyatPreviewNotice, AlWafiyatSourceId } from "./alWafiyat.types";

export default function AlWafiyatAdminApproval() {
  const [items, setItems] = useState<AlWafiyatNotice[]>([]);
  const [health, setHealth] = useState<AlWafiyatHealthRecord[]>([]);
  const [previewBySource, setPreviewBySource] = useState<Partial<Record<AlWafiyatSourceId, AlWafiyatPreviewNotice[]>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busySourceId, setBusySourceId] = useState<AlWafiyatSourceId | null>(null);
  const [busyItemId, setBusyItemId] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError("");

    Promise.all([
      api.listAdminAlWafiyat({ limit: 100 }),
      api.listAlWafiyatSourcesHealth(),
    ])
      .then(([listResponse, healthResponse]) => {
        if (!active) return;

        startTransition(() => {
          setItems(Array.isArray(listResponse.items) ? listResponse.items : []);
          setHealth(Array.isArray(healthResponse) ? healthResponse : []);
        });
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "تعذر تحميل إدارة الوفيات الرسمية.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const pendingItems = useMemo(
    () => items.filter((item) => item.status === "PENDING_APPROVAL"),
    [items],
  );

  const recentApproved = useMemo(
    () => items.filter((item) => item.status === "APPROVED").slice(0, 5),
    [items],
  );

  async function handlePreview(sourceId: AlWafiyatSourceId) {
    setBusySourceId(sourceId);
    setError("");

    try {
      const response = await previewAlWafiyatImport(sourceId, 4);
      startTransition(() => {
        setPreviewBySource((current) => ({
          ...current,
          [sourceId]: (response.items as AlWafiyatPreviewNotice[]),
        }));
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذرت معاينة مصدر الوفيات.");
    } finally {
      setBusySourceId(null);
    }
  }

  async function handleImport(sourceId: AlWafiyatSourceId) {
    setBusySourceId(sourceId);
    setError("");

    try {
      await runAlWafiyatImport(sourceId, 8);
      startTransition(() => {
        setPreviewBySource((current) => ({ ...current, [sourceId]: [] }));
      });
      setReloadKey((current) => current + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر استيراد إشعارات الوفيات.");
    } finally {
      setBusySourceId(null);
    }
  }

  async function handleDecision(id: string, action: "APPROVE" | "REJECT") {
    setBusyItemId(id);
    setError("");

    try {
      await decideAlWafiyatNotice(id, action);
      setReloadKey((current) => current + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحديث حالة إشعار الوفاة.");
    } finally {
      setBusyItemId("");
    }
  }

  return (
    <main className="legal-page" dir="rtl">
      <section className="legal-page__hero legal-page__hero--stack legal-page__hero--compact">
        <h1>إدارة الوفيات الرسمية</h1>
      </section>

      {loading ? <p className="wt-muted">جارٍ تحميل لوحة الوفيات الرسمية...</p> : null}
      {error ? <div className="wt-card">{error}</div> : null}

      <section className="wt-card">
        <div className="wt-card__title">حالة المصادر الرسمية</div>
        <div className="wt-list">
          {health.map((source) => (
            <article className="wt-list__item" key={source.sourceId}>
              <div className="wt-list__main">
                <strong className="wt-list__title">{source.sourceProviderAr}</strong>
                <span className="wt-list__sub">{source.reachable ? "المصدر متاح" : "المصدر غير متاح"} - عناصر مرصودة: {source.parsedCount}</span>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                  <span className={source.reachable ? "wt-pill wt-pill--ok" : "wt-pill wt-pill--wait"}>{source.reachable ? "متاح" : "غير متاح"}</span>
                  <span className="wt-pill">{source.statusCode ? `HTTP ${source.statusCode}` : "بدون استجابة"}</span>
                </div>
              </div>

              <div className="wt-list__actions">
                <button className="wt-btn wt-btn--ghost" type="button" onClick={() => handlePreview(source.sourceId)} disabled={busySourceId === source.sourceId}>
                  معاينة
                </button>
                <button className="wt-btn wt-btn--primary" type="button" onClick={() => handleImport(source.sourceId)} disabled={busySourceId === source.sourceId}>
                  استيراد
                </button>
              </div>
            </article>
          ))}
        </div>

        {health.map((source) => {
          const previewItems = previewBySource[source.sourceId] || [];
          if (!previewItems.length) return null;

          return (
            <section key={`${source.sourceId}-preview`} style={{ marginTop: "1rem" }}>
              <div className="wt-card__title">معاينة {source.sourceProviderAr}</div>
              <div className="wt-list">
                {previewItems.map((notice) => (
                  <AlWafiyatCard key={`${source.sourceId}-${notice.title}-${notice.noticeDate}`} notice={notice} />
                ))}
              </div>
            </section>
          );
        })}
      </section>

      <section className="wt-card">
        <div className="wt-card__title">بانتظار الاعتماد</div>
        {!pendingItems.length ? <p className="wt-muted">لا توجد إشعارات وفيات بانتظار الاعتماد حالياً.</p> : null}
        <div className="wt-list">
          {pendingItems.map((notice) => (
            <AlWafiyatCard
              key={notice.id}
              notice={notice}
              actions={(
                <>
                  <button className="wt-btn wt-btn--primary" type="button" onClick={() => handleDecision(notice.id, "APPROVE")} disabled={busyItemId === notice.id}>
                    اعتماد
                  </button>
                  <button className="wt-btn wt-btn--ghost" type="button" onClick={() => handleDecision(notice.id, "REJECT")} disabled={busyItemId === notice.id}>
                    رفض
                  </button>
                </>
              )}
            />
          ))}
        </div>
      </section>

      <section className="wt-card">
        <div className="wt-card__title">آخر الإشعارات المعتمدة</div>
        {!recentApproved.length ? <p className="wt-muted">لا توجد إشعارات معتمدة في هذه القائمة بعد.</p> : null}
        <div className="wt-list">
          {recentApproved.map((notice) => (
            <AlWafiyatCard key={notice.id} notice={notice} />
          ))}
        </div>
      </section>
    </main>
  );
}