import { useEffect, useMemo, useState } from "react";
import { TaxiHomeLink } from "./TaxiHomeLink";

type DriverStatus = "available" | "busy" | "offline";

type TaxiDriverRating = {
  id: string;
  score: number;
  note: string;
  source: string;
  createdAt: string;
};

const statusLabels: Record<DriverStatus, string> = {
  available: "متاح الآن",
  busy: "مشغول مؤقتاً",
  offline: "غير متصل",
};

const ratingSourceLabels: Record<TaxiDriverRating["source"], string> = {
  passenger: "تقييم راكب",
  admin: "مراجعة الإدارة",
  self: "مراجعة السائق",
};

function getRatingsStorageKey() {
  return "watany_taxi_driver_ratings";
}

function loadRatings(): TaxiDriverRating[] {
  if (globalThis.window === undefined) {
    return [];
  }

  try {
    const raw = globalThis.window.localStorage.getItem(getRatingsStorageKey());
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as TaxiDriverRating[];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is TaxiDriverRating => Boolean(item) && typeof item.score === "number")
      : [];
  } catch {
    return [];
  }
}

function persistRatings(ratings: TaxiDriverRating[]) {
  if (globalThis.window === undefined) {
    return;
  }

  globalThis.window.localStorage.setItem(getRatingsStorageKey(), JSON.stringify(ratings));
}

export function TaxiDriverDashboard() {
  const [location, setLocation] = useState("جونية");
  const [status, setStatus] = useState<DriverStatus>("available");
  const [notes, setNotes] = useState("جاهز لخدمة طلبات قريبة ضمن نطاق كسروان.");
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingNote, setRatingNote] = useState("خدمة ممتازة وسريعة في الوصول.");
  const [ratingSource, setRatingSource] = useState<TaxiDriverRating["source"]>("passenger");
  const [ratings, setRatings] = useState<TaxiDriverRating[]>([]);

  useEffect(() => {
    setRatings(loadRatings());
  }, []);

  useEffect(() => {
    persistRatings(ratings);
  }, [ratings]);

  const statusLabel = statusLabels[status];
  const averageRating = ratings.length
    ? (ratings.reduce((total, item) => total + item.score, 0) / ratings.length).toFixed(1)
    : "0.0";
  const readinessItems = useMemo(
    () => [
      "رقم الهاتف موثّق قبل التفعيل العام",
      "الظهور للركاب يتطلب موافقة الإدارة",
      "المستندات ولوحة السيارة لا تُعرض كاملة للعامة",
      "كل تغيير حالة يجب أن يُسجّل في سجل تدقيق",
    ],
    []
  );

  function submitRating() {
    const trimmedNote = ratingNote.trim();
    const nextRating: TaxiDriverRating = {
      id: `rating-${Date.now()}`,
      score: ratingScore,
      note: trimmedNote || "تقييم بلا ملاحظات إضافية.",
      source: ratingSource,
      createdAt: new Date().toISOString(),
    };
    setRatings((current) => [nextRating, ...current].slice(0, 6));
    setRatingNote("");
    setRatingScore(5);
    setRatingSource("passenger");
  }

  return (
    <main className="watany-approved-home-icons taxi-driver-dashboard" dir="rtl" lang="ar" data-taxi-page="driver">
      <TaxiHomeLink />

      <section className="taxi-hero" aria-labelledby="driver-title">
        <p className="taxi-kicker">لوحة السائق</p>
        <h1 id="driver-title">إدارة توفر سائق التاكسي</h1>
        <p>أعلن أنك قادر على الخدمة الآن، حدّد موقعك، واترك ملاحظة مختصرة للإدارة والركاب.</p>
      </section>

      <section className="taxi-search-card" aria-label="حالة السائق">
        <label htmlFor="driver-location">موقعي الحالي</label>
        <input
          id="driver-location"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          placeholder="مثال: جونية، بيروت، جبيل..."
          autoComplete="off"
        />

        <label htmlFor="driver-status">حالتي</label>
        <select id="driver-status" value={status} onChange={(event) => setStatus(event.target.value as DriverStatus)}>
          <option value="available">متاح الآن</option>
          <option value="busy">مشغول مؤقتاً</option>
          <option value="offline">غير متصل</option>
        </select>

        <label htmlFor="driver-notes">ملاحظات</label>
        <textarea
          id="driver-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={4}
        />
      </section>

      <section className="taxi-driver-card is-selected" aria-label="ملخص الحالة">
        <strong>{statusLabel}</strong>
        <span>{location || "لم يتم تحديد الموقع بعد"}</span>
        <small>{notes}</small>
      </section>

      <section className="taxi-mode-card" aria-label="شروط الجهوزية">
        {readinessItems.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </section>

      <section className="taxi-driver-rating" aria-label="التقييمات">
        <div className="taxi-section-heading">
          <h2>تقييم السائق</h2>
          <span>المعدل الحالي {averageRating}/5 من {ratings.length} تقييمات</span>
        </div>

        <div className="taxi-driver-rating__form">
          <label>
            <span>مصدر التقييم</span>
            <select
              value={ratingSource}
              onChange={(event) => {
                const nextSource = event.target.value;
                if (nextSource === "passenger" || nextSource === "admin" || nextSource === "self") {
                  setRatingSource(nextSource);
                }
              }}
            >
              <option value="passenger">تقييم راكب</option>
              <option value="admin">مراجعة الإدارة</option>
              <option value="self">مراجعة السائق</option>
            </select>
          </label>

          <label>
            <span>الدرجة</span>
            <div className="taxi-driver-rating__stars" aria-label="اختر تقييم النجوم">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  type="button"
                  className={score <= ratingScore ? "is-active" : ""}
                  onClick={() => setRatingScore(score)}
                  aria-pressed={score === ratingScore}
                >
                  {score} نجوم
                </button>
              ))}
            </div>
          </label>

          <label className="taxi-driver-rating__note">
            <span>ملاحظة قصيرة</span>
            <textarea
              value={ratingNote}
              onChange={(event) => setRatingNote(event.target.value)}
              rows={3}
              placeholder="اذكر سبب التقييم أو ملاحظة من الراكب"
            />
          </label>

          <button type="button" className="taxi-driver-rating__submit" onClick={submitRating}>
            حفظ التقييم
          </button>
        </div>

        <div className="taxi-driver-rating__list">
          {ratings.length ? ratings.map((rating) => (
            <article key={rating.id} className="taxi-driver-rating__item">
              <div>
                <strong>{rating.score}/5</strong>
                <span>{ratingSourceLabels[rating.source]}</span>
              </div>
              <p>{rating.note}</p>
            </article>
          )) : <div className="taxi-feedback">لا توجد تقييمات محفوظة بعد. أضف أول تقييم لتتبع جودة الخدمة.</div>}
        </div>
      </section>
    </main>
  );
}

export default TaxiDriverDashboard;