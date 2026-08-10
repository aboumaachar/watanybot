import { WatanyFeatureTemplate } from "../components/template";
import { useEffect, useRef, useState } from "react";
import { api, type SurveyBridgeStatus, type SurveySummary, type SurveyDetail, type SurveyResults } from "../lib/api";
import { useApp } from "../store/app";
import "../styles.css";

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

const SURVEY_TONE_CLASSES = ["survey-poll-card--teal", "survey-poll-card--sky", "survey-poll-card--sand"] as const;

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

    const [activeItems, closedItems] = await Promise.all([
      api.listSurveys(apiBaseUrl, "active"),
      api.listSurveys(apiBaseUrl, "closed"),
    ]);
    setPolls([...activeItems, ...closedItems]);
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
  const isClosed = selectedPoll.status === "closed";
  const selectionLocked = voted || canVote === false;
  const totalVotes = pollResults?.totalVotes ?? 0;

  return (
    <>
      {voted ? (
        <div className="survey-modal-notice survey-modal-notice--success">
          شكراً! تم تسجيل صوتك بنجاح.
        </div>
      ) : null}

      {canVote || isClosed ? null : (
        <div className="survey-modal-notice survey-modal-notice--info">
          يمكنك مراجعة التفاصيل والنتائج الآن، لكن إرسال التصويت يتطلب تسجيل الدخول أولاً.
        </div>
      )}

      <div className="survey-modal-layout">
        {isClosed ? null : <section className="survey-modal-section">
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
        </section>}

        <section ref={pollResultsRef} tabIndex={-1} className="survey-modal-section survey-modal-section--results">
          <div className="survey-modal-section__header">
            <div>
              <h3 className="survey-modal-section__title">{isClosed ? "النتائج النهائية" : "النتائج الحالية"}</h3>
              {isClosed ? null : <p className="survey-modal-section__copy">تتحدث الأشرطة مباشرة بعد كل تصويت مسجل على الخادم.</p>}
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
          <span className="survey-modal-meta__item">{formatSurveyWindow(selectedPoll)} · {selectedPoll.optionCount} خيار</span>
          {selectedPoll.hasVoted ? <span className="survey-modal-status survey-modal-status--voted">صوت مسجل</span> : null}
        </div>
        <h2 ref={modalTitleRef} tabIndex={-1} className="survey-modal-title">{selectedPoll.title}</h2>
        {selectedPoll.status === "closed" ? null : <p className="survey-modal-description">{selectedPoll.description}</p>}
        {modalContent}
      </dialog>
    </div>
  );
}

type SurveySectionActions = {
  openVotePoll: (poll: SurveySummary) => void;
  openPollResults: (poll: SurveySummary) => void;
};

type SurveyTab = "active" | "closed";

function getSurveyPageStateMessage(loading: boolean, bridgeStatus: SurveyBridgeStatus | null, polls: SurveySummary[], error: string): string | null {
  if (error) {
    return error;
  }

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

function renderSurveyPollGridSection(pageStateMessage: string | null, polls: SurveySummary[], tab: SurveyTab, actions: SurveySectionActions) {
  return (
    <section className={`survey-page__section survey-page__section--compact ${tab === "closed" ? "survey-page__section--closed" : ""}`}>
      <div className="survey-page__section-head">
        <div>
          <span className="survey-page__section-kicker">سجل التصويت</span>
          <h3 className="survey-page__section-title">{tab === "active" ? "الاستطلاعات النشطة" : "الاستطلاعات المغلقة"}</h3>
        </div>
        <p className="survey-page__section-copy">{tab === "active" ? "اختر بطاقة لقراءة التفاصيل وتسجيل صوتك داخل نافذة واحدة." : "راجع البطاقات المنتهية واطّلع على النتائج النهائية لكل استطلاع."}</p>
      </div>

      {pageStateMessage ? (
        <div className="survey-page__state-card">{pageStateMessage}</div>
      ) : (
        <div className="survey-grid">
          {polls.map((poll, index) => (
            <article className={`survey-poll-card survey-poll-card--compact ${getSurveyToneClass(index)} ${tab === "closed" ? "survey-poll-card--closed" : ""}`} key={poll.id}>

              <div className="survey-poll-card__body">
                <h4 className="survey-poll-card__title">{poll.title}</h4>
              </div>

              <div className="survey-poll-card__closed-meta">
                <span>{formatSurveyWindow(poll)}</span>
                <span>{poll.optionCount} خيار</span>
              </div>

              <div className="survey-poll-card__footer">
                {tab === "active" ? <div className="survey-poll-card__chips">
                  <span className={`pill ${poll.status === "active" ? "verified" : "pending"}`}>{STATUS_LABELS[poll.status]}</span>
                  {poll.hasVoted ? <span className="pill verified">صوت مسجل</span> : <span className="pill pending">لم يُسجل صوت بعد</span>}
                </div> : null}

                <div className="survey-poll-card__actions">
                  {tab === "active" ? (
                    <button
                      type="button"
                      className="survey-page__action survey-page__action--ghost"
                      onClick={() => actions.openPollResults(poll)}
                    >
                      النتائج الحالية
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="survey-page__action survey-page__action--primary"
                    onClick={() => tab === "active" ? actions.openVotePoll(poll) : actions.openPollResults(poll)}
                  >
                    {tab === "active" ? "فتح للتصويت" : "عرض النتائج"}
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
  const [selectedTab, setSelectedTab] = useState<SurveyTab>("active");
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
  const activePolls = polls.filter((poll) => poll.status === "active");
  const closedPolls = polls.filter((poll) => poll.status === "closed");
  const visiblePolls = selectedTab === "active" ? activePolls : closedPolls;
  const pageStateMessage = getSurveyPageStateMessage(loading, bridgeStatus, polls, error);

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

        const [activeItems, closedItems] = await Promise.all([
          api.listSurveys(apiBaseUrl, "active"),
          api.listSurveys(apiBaseUrl, "closed"),
        ]);
        if (!active) return;

        setPolls([...activeItems, ...closedItems]);
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
  }, [apiBaseUrl]);

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
        <div className="survey-tabs" role="tablist" aria-label="حالة الاستطلاعات">
        <button
          type="button"
          role="tab"
          aria-selected={selectedTab === "active"}
          className={`survey-tab ${selectedTab === "active" ? "is-active" : ""}`}
          onClick={() => setSelectedTab("active")}
        >
          النشطة <span>{activePolls.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={selectedTab === "closed"}
          className={`survey-tab ${selectedTab === "closed" ? "is-active" : ""}`}
          onClick={() => setSelectedTab("closed")}
        >
          المغلقة <span>{closedPolls.length}</span>
        </button>
        </div>

        {renderSurveyPollGridSection(
          selectedTab === "active"
            ? pageStateMessage
            : loading
              ? pageStateMessage
              : visiblePolls.length === 0
                ? "لا توجد استطلاعات مغلقة حالياً."
                : null,
          visiblePolls,
          selectedTab,
          sectionActions,
        )}
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


