import { WatanyFeatureTemplate } from "../components/template";
import { useEffect, useRef, useState } from "react";
import { Archive24Regular, ArrowCounterclockwise24Regular, Clock24Regular, Share24Regular } from "../theme/watany-v4/legacyIconBridge";
import InlineInfoButton from "../components/InlineInfoButton";
import { api, type SurveyBridgeStatus, type SurveySummary, type SurveyDetail, type SurveyResults } from "../lib/api";
import { useApp } from "../store/app";

const PROVIDER_LABELS: Record<SurveyBridgeStatus["provider"], string> = {
  pending_bridge: "غير مفعّل بعد",
  supabase_rest_bridge: "مصدر Supabase الحالي",
  watany_plugin_db: "مخزن موطني الداخلي",
};

const STATUS_LABELS: Record<SurveySummary["status"], string> = {
  draft: "مسودة",
  active: "نشطة",
  closed: "مقفلة",
};

function formatSurveyWindow(survey: SurveySummary): string {
  const formatter = new Intl.DateTimeFormat("ar-LB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const start = survey.startDate ? formatter.format(new Date(survey.startDate)) : "لم يحدد بعد";
  const end = survey.endDate ? formatter.format(new Date(survey.endDate)) : "غير محدد";
  return `${start} - ${end}`;
}

const LEGACY_SURVEY_HINT_SNIPPETS = [
  "التصويت النتائج",
  "قاعدة موطني",
  "المصدر القديم",
  "القراءة الكتابة",
] as const;

function sanitizeSurveyNextStep(nextStep: string): string {
  const collapsed = nextStep.replace(/\s+/g, " ").trim();
  if (LEGACY_SURVEY_HINT_SNIPPETS.every((snippet) => collapsed.includes(snippet))) {
    return "";
  }

  let sanitized = collapsed;
  for (const snippet of LEGACY_SURVEY_HINT_SNIPPETS) {
    sanitized = sanitized.replace(snippet, "");
  }

  return sanitized
    .replace(/[.R,:;\u061b\u060c]+\s*[.R,:;\u061b\u060c]+/g, ". ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function getSanitizedNextStep(bridgeStatus: SurveyBridgeStatus | null): string {
  if (!bridgeStatus) {
    return "";
  }

  return sanitizeSurveyNextStep(bridgeStatus.nextStep);
}

const SURVEY_TONE_CLASSES = ["survey-poll-card--teal", "survey-poll-card--sky", "survey-poll-card--sand"] as const;

function getFeaturedPoll(polls: SurveySummary[]): SurveySummary | null {
  return polls.find((poll) => poll.status === "active") ?? polls[0] ?? null;
}

function getSurveyCategoryLabel(poll: SurveySummary): string {
  const normalizedId = poll.id.toLowerCase();
  const normalizedTitle = poll.title.toLowerCase();

  if (normalizedId.includes("upcoming") || normalizedTitle.includes("مباراة")) {
    return "المباريات المقبلة";
  }

  if (normalizedId.includes("champion") || normalizedTitle.includes("بطلاً") || normalizedTitle.includes("بطلا")) {
    return "البطل المتوقع";
  }

  if (normalizedId.includes("golden-boot") || normalizedTitle.includes("الحذاء الذهبي") || normalizedTitle.includes("الأهداف") || normalizedTitle.includes("الاهداف")) {
    return "سباق الهداف";
  }

  return "استطلاع مباشر";
}

function getSurveyToneClass(index: number): string {
  return SURVEY_TONE_CLASSES[index % SURVEY_TONE_CLASSES.length];
}

type SurveyModalIntent = "vote" | "results";

type UseSurveyModalFocusParams = {
  selectedPoll: SurveySummary | null;
  pollLoading: boolean;
  modalIntent: SurveyModalIntent;
  modalTitleRef: { current: HTMLHeadingElement | null };
  pollResultsRef: { current: HTMLDivElement | null };
};

function useSurveyModalFocus({
  selectedPoll,
  pollLoading,
  modalIntent,
  modalTitleRef,
  pollResultsRef,
}: Readonly<UseSurveyModalFocusParams>) {
  useEffect(() => {
    if (!selectedPoll) {
      return;
    }

    globalThis.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    const frame = globalThis.requestAnimationFrame(() => {
      modalTitleRef.current?.focus();
    });

    return () => globalThis.cancelAnimationFrame(frame);
  }, [selectedPoll, modalTitleRef]);

  useEffect(() => {
    if (!selectedPoll || pollLoading || modalIntent !== "results") {
      return;
    }

    const timer = globalThis.setTimeout(() => {
      pollResultsRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      pollResultsRef.current?.focus();
    }, 80);

    return () => globalThis.clearTimeout(timer);
  }, [selectedPoll, pollLoading, modalIntent, pollResultsRef]);
}

// Submit a vote and refresh results/polls
async function submitSurveyVoteFlow({
  selectedPoll,
  selectedOptionId,
  pollDetails,
  apiBaseUrl,
  setSelectedOptionId,
  setVoting,
  setVoted,
  setPollResults,
  setPolls,
}: Readonly<SubmitSurveyVoteFlowParams>): Promise<void> {
  if (!selectedPoll) {
    console.warn("Cannot vote: missing poll");
    return;
  }

  let optionToVote = selectedOptionId;
  if (!optionToVote && pollDetails?.options.length) {
    optionToVote = pollDetails.options[0].id;
    setSelectedOptionId(optionToVote);
  }

  if (!optionToVote) {
    console.warn("Cannot vote: no options available");
    return;
  }

  setVoting(true);
  try {
    await api.submitSurveyVote(selectedPoll.id, optionToVote, apiBaseUrl);
    setVoted(true);

    const results = await api.getSurveyResults(selectedPoll.id, apiBaseUrl);
    setPollResults(results);

    const pollsList = await api.listSurveys(apiBaseUrl);
    setPolls(pollsList);
  } catch (err) {
    console.error("Vote submission failed:", err);
  } finally {
    setVoting(false);
  }
}

type SubmitSurveyVoteFlowParams = {
  selectedPoll: SurveySummary | null;
  selectedOptionId?: string | null;
  pollDetails: SurveyDetail | null;
  apiBaseUrl: string;
  setSelectedOptionId: React.Dispatch<React.SetStateAction<string | null>>;
  setVoting: (v: boolean) => void;
  setVoted: (v: boolean) => void;
  setPollResults: (r: SurveyResults | null) => void;
  setPolls: (p: SurveySummary[]) => void;
};

type SurveyModalProps = {
  selectedPoll: SurveySummary | null;
  pollDetails: SurveyDetail | null;
  pollResults: SurveyResults | null;
  selectedOptionId: string | null;
  voting: boolean;
  voted: boolean;
  pollLoading: boolean;
  modalTitleRef: { current: HTMLHeadingElement | null };
  pollResultsRef: { current: HTMLDivElement | null };
  onClose: () => void;
  onSelectOption: (optionId: string) => void;
  onShareResults: () => void;
  onSubmitVote: () => void;
};

type SurveyModalLoadedContentProps = {
  selectedPoll: SurveySummary;
  pollDetails: SurveyDetail;
  pollResults: SurveyResults | null;
  selectedOptionId: string | null;
  voting: boolean;
  voted: boolean;
  pollResultsRef: { current: HTMLDivElement | null };
  onClose: () => void;
  onSelectOption: (optionId: string) => void;
  onShareResults: () => void;
  onSubmitVote: () => void;
};

type SurveyModalContentResolverProps = {
  pollLoading: boolean;
  pollDetails: SurveyDetail | null;
  selectedPoll: SurveySummary;
  pollResults: SurveyResults | null;
  selectedOptionId: string | null;
  voting: boolean;
  voted: boolean;
  pollResultsRef: { current: HTMLDivElement | null };
  onClose: () => void;
  onSelectOption: (optionId: string) => void;
  onShareResults: () => void;
  onSubmitVote: () => void;
};

function resolveSurveyModalContent({
  pollLoading,
  pollDetails,
  selectedPoll,
  pollResults,
  selectedOptionId,
  voting,
  voted,
  pollResultsRef,
  onClose,
  onSelectOption,
  onShareResults,
  onSubmitVote,
}: Readonly<SurveyModalContentResolverProps>): JSX.Element {
  if (pollLoading) {
    return <div style={{ textAlign: "center", padding: "40px 0", color: "#999" }}>جارٍ تحميل...</div>;
  }

  if (!pollDetails) {
    return <div style={{ textAlign: "center", padding: "40px 0", color: "#999" }}>فشل تحميل تفاصيل الاستطلاع</div>;
  }

  return (
    <SurveyModalLoadedContent
      selectedPoll={selectedPoll}
      pollDetails={pollDetails}
      pollResults={pollResults}
      selectedOptionId={selectedOptionId}
      voting={voting}
      voted={voted}
      pollResultsRef={pollResultsRef}
      onClose={onClose}
      onSelectOption={onSelectOption}
      onShareResults={onShareResults}
      onSubmitVote={onSubmitVote}
    />
  );
}

function SurveyModalLoadedContent({
  selectedPoll,
  pollDetails,
  pollResults,
  selectedOptionId,
  voting,
  voted,
  pollResultsRef,
  onClose,
  onSelectOption,
  onShareResults,
  onSubmitVote,
}: Readonly<SurveyModalLoadedContentProps>) {
  const canVote = pollDetails.canVote;
  const selectionLocked = voted || canVote === false;
  const totalVotes = pollResults?.totalVotes ?? 0;

  return (
    <>
      {voted ? (
        <div className="survey-modal-notice survey-modal-notice--success">
          شكراً! تم تسجيل صوتك بنجاح.
        </div>
      ) : null}

      {canVote ? null : (
        <div className="survey-modal-notice survey-modal-notice--info">
          يمكنك مراجعة التفاصيل والنتائج الآن، لكن إرسال التصويت يتطلب تسجيل الدخول أولاً.
        </div>
      )}

      <div className="survey-modal-layout">
        <section className="survey-modal-section">
          <div className="survey-modal-section__header">
            <div>
              <h3 className="survey-modal-section__title">اختر خيارك</h3>
              <p className="survey-modal-section__copy">راجع البدائل وحدد اختيارك من بطاقة واضحة وسريعة القراءة.</p>
            </div>
            <span className="survey-modal-chip">{pollDetails.options.length} خيار</span>
          </div>

          <div className="survey-modal-option-list">
            {pollDetails.options.map((option) => (
              <label
                key={option.id}
                className={[
                  "survey-modal-option",
                  selectedOptionId === option.id ? "is-selected" : "",
                  selectionLocked ? "is-locked" : "",
                ].filter(Boolean).join(" ")}
              >
                <input
                  type="radio"
                  name={`poll-${selectedPoll.id}`}
                  value={option.id}
                  checked={selectedOptionId === option.id}
                  onChange={(e) => onSelectOption(e.target.value)}
                  disabled={selectionLocked}
                  className="survey-modal-option__radio"
                />
                <span className="survey-modal-option__copy">
                  <span className="survey-modal-option__name">{option.name}</span>
                  {option.description ? <span className="survey-modal-option__description">{option.description}</span> : null}
                </span>
              </label>
            ))}
          </div>
        </section>

        <section ref={pollResultsRef} tabIndex={-1} className="survey-modal-section survey-modal-section--results">
          <div className="survey-modal-section__header">
            <div>
              <h3 className="survey-modal-section__title">النتائج الحالية</h3>
              <p className="survey-modal-section__copy">تتحدث الأشرطة مباشرة بعد كل تصويت مسجل على الخادم.</p>
            </div>
            <span className="survey-modal-chip survey-modal-chip--accent">إجمالي الأصوات: {totalVotes}</span>
          </div>

          {pollResults && pollResults.items.length > 0 ? (
            <div className="survey-modal-results">
              {pollResults.items.map((item) => {
                const percentage = totalVotes > 0 ? (item.voteCount / totalVotes) * 100 : 0;
                return (
                  <div key={item.optionId} className="survey-modal-result-row">
                    <div className="survey-modal-result-row__header">
                      <span>{item.optionName}</span>
                      <strong>{percentage.toFixed(1)}% ({item.voteCount})</strong>
                    </div>
                    <div className="survey-modal-result-bar">
                      <div className="survey-modal-result-bar__fill" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="survey-modal-empty">لا توجد نتائج معروضة لهذا الاستطلاع حالياً.</p>
          )}
        </section>
      </div>

      <div className="survey-modal-actions">
        <button
          type="button"
          onClick={onShareResults}
          className="survey-modal-button survey-modal-button--secondary"
        >
          <Share24Regular aria-hidden style={{ width: 18, height: 18 }} />
          مشاركة
        </button>
        <button
          type="button"
          onClick={onClose}
          className="survey-modal-button survey-modal-button--ghost"
        >
          إغلاق
        </button>
      </div>

      {voted || canVote === false ? null : (
        <button
          type="button"
          onClick={onSubmitVote}
          disabled={voting || !selectedOptionId}
          className="survey-modal-button survey-modal-button--primary"
        >
          {voting ? "جارٍ التصويت..." : "تصويت"}
        </button>
      )}
    </>
  );
}

function findPollById(polls: SurveySummary[], pollId: string | null): SurveySummary | null {
  if (!pollId) {
    return null;
  }

  return polls.find((poll) => poll.id === pollId) || null;
}

function shareSurveyResults(selectedPoll: SurveySummary | null): void {
  if (!selectedPoll) return;

  const url = `${globalThis.location.origin}/voting/${encodeURIComponent(selectedPoll.id)}/results`;
  const text = `نتائج "${selectedPoll.title}" من استطلاع موطني: ${url}`;

  if (navigator.share) {
    navigator.share({ title: selectedPoll.title, text });
    return;
  }

  alert(text);
}

// Survey poll list UI removed — inline rendering used instead

function SurveyModal({
  selectedPoll,
  pollDetails,
  pollResults,
  selectedOptionId,
  voting,
  voted,
  pollLoading,
  modalTitleRef,
  pollResultsRef,
  onClose,
  onSelectOption,
  onShareResults,
  onSubmitVote,
}: Readonly<SurveyModalProps>) {
  if (!selectedPoll) {
    return null;
  }

  const modalContent = resolveSurveyModalContent({
    pollLoading,
    pollDetails,
    selectedPoll,
    pollResults,
    selectedOptionId,
    voting,
    voted,
    pollResultsRef,
    onClose,
    onSelectOption,
    onShareResults,
    onSubmitVote,
  });

  return (
    <div className="survey-modal-backdrop">
      <dialog open className="survey-modal-card" aria-label={selectedPoll.title}>
        <button
          type="button"
          onClick={onClose}
          className="survey-modal-close"
          aria-label="إغلاق بطاقة الاستطلاع"
        >
          ✕
        </button>

        <div className="survey-modal-meta">
          <span className={`survey-modal-status survey-modal-status--${selectedPoll.status}`}>{STATUS_LABELS[selectedPoll.status]}</span>
          <span className="survey-modal-meta__item">{formatSurveyWindow(selectedPoll)}</span>
          <span className="survey-modal-meta__item">{selectedPoll.optionCount} خيار/خيارات</span>
          {selectedPoll.hasVoted ? <span className="survey-modal-status survey-modal-status--voted">صوت مسجل</span> : null}
        </div>
        <h2 ref={modalTitleRef} tabIndex={-1} className="survey-modal-title">{selectedPoll.title}</h2>
        <p className="survey-modal-description">{selectedPoll.description}</p>
        {modalContent}
      </dialog>
    </div>
  );
}

type SurveySectionActions = {
  openVotePoll: (poll: SurveySummary) => void;
  openPollResults: (poll: SurveySummary) => void;
};

function renderSurveyHeroSection({
  bridgeStatus,
  providerLabel,
  loading,
  activePollCount,
  totalOptionCount,
  pollsCount,
  latestPollId,
  error,
  sanitizedNextStep,
  openLatestPoll,
  reloadSurveys,
}: {
  bridgeStatus: SurveyBridgeStatus | null;
  providerLabel: string;
  loading: boolean;
  activePollCount: number;
  totalOptionCount: number;
  pollsCount: number;
  latestPollId: string | null;
  error: string;
  sanitizedNextStep: string;
  openLatestPoll: (intent: SurveyModalIntent) => void;
  reloadSurveys: () => void;
}) {
  return (
    <section className="survey-page__hero">
      <div className="survey-page__hero-copy">
        <div className="survey-page__eyebrow-row">
          <span className="survey-page__eyebrow">تصويت مباشر داخل موطني</span>
          <InlineInfoButton
            text="واجهة تصويت ونتائج مبنية داخل موطني مع بطاقات أوضح للمباريات، البطل المتوقع، وسباق الهداف."
            label="حول صفحة الاستطلاع والتصويت"
          />
        </div>

        <h2 className="survey-page__title">واجهة تصويت أوضح للمباريات والمنتخبات وسباق الهداف</h2>
        <p className="survey-page__lead">
          {bridgeStatus?.ready
            ? "كل استطلاع يعرض حالته ونافذة الوقت وعدد الخيارات مباشرة، مع انتقال واضح إلى بطاقة تجمع التصويت والنتائج في مكان واحد."
            : "سنُظهر الاستطلاعات هنا فور جاهزية مصدر البيانات على الخادم، مع نفس الواجهة الواضحة للقراءة السريعة على الهاتف."}
        </p>

        <div className="survey-page__quick-actions">
          <button
            type="button"
            className="survey-page__action survey-page__action--primary"
            onClick={() => openLatestPoll("vote")}
            disabled={!latestPollId}
          >
            <Clock24Regular aria-hidden />
            أحدث استطلاع
          </button>

          <button
            type="button"
            className="survey-page__action survey-page__action--secondary"
            onClick={() => openLatestPoll("results")}
            disabled={!latestPollId}
          >
            <Archive24Regular aria-hidden />
            نتائج فورية
          </button>

          <button
            type="button"
            className="survey-page__action survey-page__action--ghost"
            onClick={reloadSurveys}
          >
            <ArrowCounterclockwise24Regular aria-hidden />
            تحديث البيانات
          </button>
        </div>
      </div>

      <aside className="survey-status-card">
        <div className="survey-status-card__header">
          <div>
            <span className="survey-status-card__kicker">لوحة سريعة</span>
            <h3 className="survey-status-card__title">حالة الصفحة الآن</h3>
          </div>
          <span className="survey-status-card__pulse" aria-hidden />
        </div>

        <div className="survey-status-card__metrics">
          <div className="survey-status-card__metric">
            <span>مصدر البيانات</span>
            <strong>{providerLabel}</strong>
          </div>
          <div className="survey-status-card__metric">
            <span>الاستطلاعات النشطة</span>
            <strong>{loading ? "..." : activePollCount}</strong>
          </div>
          <div className="survey-status-card__metric">
            <span>إجمالي الخيارات</span>
            <strong>{loading ? "..." : totalOptionCount}</strong>
          </div>
        </div>

        <div className="survey-status-card__badges">
          <span className="pill pending">{bridgeStatus ? `الاستطلاعات الظاهرة: ${pollsCount}` : "الاستطلاعات: جارٍ التحقق"}</span>
          <span className="pill pending">{latestPollId ? "آخر تحديث جاهز للعرض" : "لا يوجد استطلاع مميز بعد"}</span>
        </div>

        {error ? <div className="panel-error">{error}</div> : null}
        {sanitizedNextStep ? (
          <p className="survey-status-card__note">{sanitizedNextStep}</p>
        ) : (
          <p className="survey-status-card__note">التصميم الحالي يركز على قراءة أسرع للبطاقات والنتائج من دون شريط ثابت يحجب المحتوى على الهاتف.</p>
        )}
      </aside>
    </section>
  );
}

function renderSurveySpotlightSection(featuredPoll: SurveySummary, actions: SurveySectionActions) {
  return (
    <section className="survey-spotlight">
      <div className="survey-spotlight__copy">
        <span className="survey-spotlight__kicker">{getSurveyCategoryLabel(featuredPoll)}</span>
        <h3 className="survey-spotlight__title">{featuredPoll.title}</h3>
        <p className="survey-spotlight__description">{featuredPoll.description || "بطاقة تصويت نشطة داخل موطني مع نتائج مباشرة."}</p>

        <div className="survey-spotlight__meta">
          <div className="survey-spotlight__meta-item">
            <span>نافذة التصويت</span>
            <strong>{formatSurveyWindow(featuredPoll)}</strong>
          </div>
          <div className="survey-spotlight__meta-item">
            <span>عدد الخيارات</span>
            <strong>{featuredPoll.optionCount} خيار</strong>
          </div>
        </div>
      </div>

      <div className="survey-spotlight__panel">
        <div className="survey-spotlight__badges">
          <span className={`pill ${featuredPoll.status === "active" ? "verified" : "pending"}`}>{STATUS_LABELS[featuredPoll.status]}</span>
          {featuredPoll.hasVoted ? <span className="pill verified">صوت مسجل</span> : <span className="pill pending">جاهز للتصويت</span>}
        </div>

        <p className="survey-spotlight__note">افتح البطاقة المميزة إذا كنت تريد مساراً أسرع إلى التفاصيل والنتائج الحالية في نفس النافذة.</p>

        <div className="survey-spotlight__actions">
          <button
            type="button"
            className="survey-page__action survey-page__action--primary"
            onClick={() => actions.openVotePoll(featuredPoll)}
          >
            عرض البطاقة
          </button>
          <button
            type="button"
            className="survey-page__action survey-page__action--ghost"
            onClick={() => actions.openPollResults(featuredPoll)}
          >
            النتائج المباشرة
          </button>
        </div>
      </div>
    </section>
  );
}

function getSurveyPageStateMessage(loading: boolean, bridgeStatus: SurveyBridgeStatus | null, polls: SurveySummary[]): string | null {
  if (loading) {
    return "جارٍ تحميل قائمة الاستطلاعات...";
  }

  if (bridgeStatus && !bridgeStatus.ready) {
    return "مصدر بيانات التصويت غير مفعّل بعد على هذا الخادم. فعّل إعدادات التصويت في gateway لتظهر الاستطلاعات هنا داخل موطني.";
  }

  if (bridgeStatus?.ready && polls.length === 0) {
    return "لا توجد استطلاعات نشطة حالياً.";
  }

  return null;
}

function renderSurveyPollGridSection(pageStateMessage: string | null, polls: SurveySummary[], actions: SurveySectionActions) {
  return (
    <section className="survey-page__section">
      <div className="survey-page__section-head">
        <div>
          <span className="survey-page__section-kicker">بطاقات التصويت</span>
          <h3 className="survey-page__section-title">اختر الاستطلاع المناسب بسرعة</h3>
        </div>
        <p className="survey-page__section-copy">كل بطاقة تُظهر الفكرة الأساسية والموعد وعدد الخيارات قبل الدخول إلى نافذة التفاصيل.</p>
      </div>

      {pageStateMessage ? (
        <div className="survey-page__state-card">{pageStateMessage}</div>
      ) : (
        <div className="survey-grid">
          {polls.map((poll, index) => (
            <article className={`survey-poll-card ${getSurveyToneClass(index)}`} key={poll.id}>
              <div className="survey-poll-card__header">
                <span className="survey-poll-card__serial">{String(index + 1).padStart(2, "0")}</span>
                <span className="survey-poll-card__tag">{getSurveyCategoryLabel(poll)}</span>
              </div>

              <div className="survey-poll-card__body">
                <h4 className="survey-poll-card__title">{poll.title}</h4>
                <p className="survey-poll-card__description">{poll.description || "بطاقة تصويت مفعلة داخل موطني مع واجهة نتائج مباشرة."}</p>
              </div>

              <div className="survey-poll-card__stats">
                <div className="survey-poll-card__stat">
                  <span>الحالة</span>
                  <strong>{STATUS_LABELS[poll.status]}</strong>
                </div>
                <div className="survey-poll-card__stat survey-poll-card__stat--wide">
                  <span>الفترة</span>
                  <strong>{formatSurveyWindow(poll)}</strong>
                </div>
                <div className="survey-poll-card__stat">
                  <span>الخيارات</span>
                  <strong>{poll.optionCount}</strong>
                </div>
              </div>

              <div className="survey-poll-card__footer">
                <div className="survey-poll-card__chips">
                  <span className={`pill ${poll.status === "active" ? "verified" : "pending"}`}>{STATUS_LABELS[poll.status]}</span>
                  {poll.hasVoted ? <span className="pill verified">صوت مسجل</span> : <span className="pill pending">لم يُسجل صوت بعد</span>}
                </div>

                <div className="survey-poll-card__actions">
                  <button
                    type="button"
                    className="survey-page__action survey-page__action--ghost"
                    onClick={() => actions.openPollResults(poll)}
                  >
                    النتائج
                  </button>
                  <button
                    type="button"
                    className="survey-page__action survey-page__action--primary"
                    onClick={() => actions.openVotePoll(poll)}
                  >
                    عرض البطاقة
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function SurveyPageTemplateContent() {
  const { apiBaseUrl } = useApp();
  const [bridgeStatus, setBridgeStatus] = useState<SurveyBridgeStatus | null>(null);
  const [polls, setPolls] = useState<SurveySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  
  // Modal state
  const [selectedPoll, setSelectedPoll] = useState<SurveySummary | null>(null);
  const [pollDetails, setPollDetails] = useState<SurveyDetail | null>(null);
  const [pollResults, setPollResults] = useState<SurveyResults | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const [voted, setVoted] = useState(false);
  const [pollLoading, setPollLoading] = useState(false);
  const [modalIntent, setModalIntent] = useState<SurveyModalIntent>("vote");
  const modalTitleRef = useRef<HTMLHeadingElement | null>(null);
  const pollResultsRef = useRef<HTMLDivElement | null>(null);
  const latestPollId = polls[0]?.id ?? selectedPoll?.id ?? null;
  const featuredPoll = getFeaturedPoll(polls);
  const activePollCount = polls.filter((poll) => poll.status === "active").length;
  const totalOptionCount = polls.reduce((sum, poll) => sum + poll.optionCount, 0);
  const providerLabel = bridgeStatus ? PROVIDER_LABELS[bridgeStatus.provider] : "جارٍ التحقق";
  const sanitizedNextStep = getSanitizedNextStep(bridgeStatus);
  const pageStateMessage = getSurveyPageStateMessage(loading, bridgeStatus, polls);

  useEffect(() => {
    let active = true;

    async function loadSurveyData() {
      setLoading(true);
      setError("");

      try {
        const status = await api.getSurveyBridgeStatus(apiBaseUrl);
        if (!active) return;

        setBridgeStatus(status);
        if (!status.ready) {
          setPolls([]);
          return;
        }

        const items = await api.listSurveys(apiBaseUrl);
        if (!active) return;

        setPolls(items);
      } catch (reason) {
        if (!active) return;

        setPolls([]);
        setError(reason instanceof Error ? reason.message : "تعذر تحميل الاستطلاعات حاليا.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSurveyData();
    return () => {
      active = false;
    };
  }, [apiBaseUrl, reloadKey]);

  useSurveyModalFocus({
    selectedPoll,
    pollLoading,
    modalIntent,
    modalTitleRef,
    pollResultsRef,
  });

  async function openPollModal(poll: SurveySummary, intent: SurveyModalIntent = "vote") {
    setModalIntent(intent);
    setSelectedPoll(poll);
    setSelectedOptionId(null);
    setVoted(false);
    setPollLoading(true);
    setVoting(false);
    setPollDetails(null);
    setPollResults(null);

    try {
      const details = await api.getSurvey(poll.id, apiBaseUrl);
      setPollDetails(details);
      
      const results = await api.getSurveyResults(poll.id, apiBaseUrl);
      setPollResults(results);
    } catch {
      setPollDetails(null);
      setPollResults(null);
    } finally {
      setPollLoading(false);
    }
  }

  function closePollModal() {
    setSelectedPoll(null);
    setPollDetails(null);
    setPollResults(null);
    setSelectedOptionId(null);
    setVoting(false);
    setVoted(false);
  }

  async function submitVote() {
    await submitSurveyVoteFlow({
      selectedPoll,
      selectedOptionId,
      pollDetails,
      apiBaseUrl,
      setSelectedOptionId,
      setVoting,
      setVoted,
      setPollResults: (results: SurveyResults | null) => setPollResults(results),
      setPolls: (pollsList: SurveySummary[]) => setPolls(pollsList),
    });
  }

  function reloadSurveys() {
    setReloadKey((value) => value + 1);
  }

  function openLatestPoll(intent: SurveyModalIntent) {
    const poll = findPollById(polls, latestPollId);
    if (!poll) {
      return;
    }

    void openPollModal(poll, intent);
  }

  function openVotePoll(poll: SurveySummary) {
    void openPollModal(poll, "vote");
  }

  function openPollResults(poll: SurveySummary) {
    void openPollModal(poll, "results");
  }

  const sectionActions: SurveySectionActions = {
    openVotePoll,
    openPollResults,
  };

  return (
    <>
      <SurveyModal
        selectedPoll={selectedPoll}
        pollDetails={pollDetails}
        pollResults={pollResults}
        selectedOptionId={selectedOptionId}
        voting={voting}
        voted={voted}
        pollLoading={pollLoading}
        modalTitleRef={modalTitleRef}
        pollResultsRef={pollResultsRef}
        onClose={closePollModal}
        onSelectOption={setSelectedOptionId}
        onShareResults={() => shareSurveyResults(selectedPoll)}
        onSubmitVote={submitVote}
      />

    <div className="panel utility-page survey-page">
      {renderSurveyHeroSection({
        bridgeStatus,
        providerLabel,
        loading,
        activePollCount,
        totalOptionCount,
        pollsCount: polls.length,
        latestPollId,
        error,
        sanitizedNextStep,
        openLatestPoll,
        reloadSurveys,
      })}

      {featuredPoll ? (
        renderSurveySpotlightSection(featuredPoll, sectionActions)
      ) : null}

      {renderSurveyPollGridSection(pageStateMessage, polls, sectionActions)}
    </div>
    </>
  );
}
function SurveyPageUnifiedTemplatePage() {
  return (
    <WatanyFeatureTemplate
      title="Survey"
      description="Complete available surveys and feedback forms."
      category="general"
    >
      <div data-watany-template-batch="v1.4.3">
        <SurveyPageTemplateContent />
      </div>
    </WatanyFeatureTemplate>
  );
}

export default SurveyPageUnifiedTemplatePage;


