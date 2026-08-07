import { useEffect, useMemo, useState } from "react";
import { api, type WorldCupPlayer, type WorldCupPoll, type WorldCupTeam, type WorldCupVote } from "../../lib/api";
import { useApp } from "../../store/app";
import { worldCupMatches } from "../../data/worldCupMatches";
import { worldCupTeams as worldCupTeamsFallback } from "../../data/worldCupTeams";

const WORLD_CUP_LOCAL_VOTES_KEY = "watany_world_cup_local_votes_v1";
const WORLD_CUP_LOAD_TIMEOUT_MS = 3500;
const FALLBACK_AVATAR_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240" fill="none">
    <rect width="240" height="240" rx="24" fill="#E2E8F0"/>
    <circle cx="120" cy="92" r="42" fill="#94A3B8"/>
    <path d="M48 206c7-37 35-62 72-62s65 25 72 62" stroke="#64748B" stroke-width="18" stroke-linecap="round"/>
  </svg>`
)}`;

function toFallbackPlayers(teams: typeof worldCupTeamsFallback): WorldCupPlayer[] {
  return teams.flatMap((team) => team.players.map((player) => ({
    ...player,
    teamId: team.id,
    teamNameAr: team.nameAr,
    teamNameEn: team.nameEn,
  })));
}

function buildLocalPolls(): WorldCupPoll[] {
  const fallbackBestPlayerOptions = toFallbackPlayers(worldCupTeamsFallback).map((player) => player.id);
  const matchPolls: WorldCupPoll[] = worldCupMatches.map((match) => ({
    id: `poll-match-winner-${match.id}`,
    type: "match_winner",
    title: `تصويت المباراة: ${match.teamA} ضد ${match.teamB}`,
    question: `من تتوقع يفوز في مباراة ${match.teamA} ضد ${match.teamB}؟`,
    options: [match.teamA, "تعادل", match.teamB],
  }));

  return [
    {
      id: "poll-best-player",
      type: "best_player",
      title: "تصويت أفضل لاعب في كأس العالم",
      question: "المرحلة الأولى: اختر المنتخب ثم اختر اللاعب للتصويت.",
      options: fallbackBestPlayerOptions,
    },
    ...matchPolls,
  ];
}

function readLocalVotes(): WorldCupVote[] {
  if (globalThis.window === undefined) {
    return [];
  }

  try {
    const raw = globalThis.window.localStorage.getItem(WORLD_CUP_LOCAL_VOTES_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is WorldCupVote => {
      return typeof item?.pollId === "string"
        && typeof item?.optionId === "string"
        && typeof item?.userId === "string"
        && typeof item?.createdAt === "string";
    });
  } catch {
    return [];
  }
}

function persistLocalVotes(nextVotes: WorldCupVote[]) {
  if (globalThis.window === undefined) {
    return;
  }

  globalThis.window.localStorage.setItem(WORLD_CUP_LOCAL_VOTES_KEY, JSON.stringify(nextVotes));
}

function upsertVote(votes: WorldCupVote[], incoming: WorldCupVote): WorldCupVote[] {
  const remaining = votes.filter((vote) => !(vote.pollId === incoming.pollId && vote.userId === incoming.userId));
  return [...remaining, incoming];
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      globalThis.setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    }),
  ]);
}

export function WorldCupPredictionPolls() {
  const { apiBaseUrl, profile } = useApp();
  const [polls, setPolls] = useState<WorldCupPoll[]>([]);
  const [votes, setVotes] = useState<WorldCupVote[]>([]);
  const [teams, setTeams] = useState<WorldCupTeam[]>([]);
  const [players, setPlayers] = useState<WorldCupPlayer[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [savingPollId, setSavingPollId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isFallbackMode, setIsFallbackMode] = useState(false);

  const voterId = useMemo(() => {
    const base = profile.phone || profile.email || profile.name || "guest-worldcup";
    return String(base);
  }, [profile.email, profile.name, profile.phone]);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const [nextPolls, nextVotes, nextTeams, nextPlayers] = await withTimeout(Promise.all([
          api.getWorldCupPolls(apiBaseUrl),
          api.getWorldCupVotes(undefined, apiBaseUrl),
          api.getWorldCupTeams(apiBaseUrl),
          api.getWorldCupPlayers(apiBaseUrl),
        ]), WORLD_CUP_LOAD_TIMEOUT_MS, "timeout");
        if (!active) return;
        setPolls(nextPolls);
        setVotes(nextVotes);
        setTeams(nextTeams);
        setPlayers(nextPlayers);
        setIsFallbackMode(false);
      } catch (reason) {
        if (!active) return;
        const fallbackTeams = [...worldCupTeamsFallback] as unknown as WorldCupTeam[];
        const fallbackPlayers = toFallbackPlayers(worldCupTeamsFallback);
        setPolls(buildLocalPolls());
        setVotes(readLocalVotes());
        setTeams(fallbackTeams);
        setPlayers(fallbackPlayers);
        setIsFallbackMode(true);
        if (reason instanceof Error && reason.message !== "timeout") {
          setError("");
        } else {
          setError("");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (selectedTeamId) {
      return;
    }
    const firstTeamWithPlayers = teams.find((team) => team.players.length > 0);
    if (firstTeamWithPlayers) {
      setSelectedTeamId(firstTeamWithPlayers.id);
    }
  }, [selectedTeamId, teams]);

  const matchPolls = polls.filter((poll) => poll.type === "match_winner");
  const bestPlayerPoll = polls.find((poll) => poll.type === "best_player") ?? null;
  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? null;
  const playersByTeam = players.filter((player) => player.teamId === selectedTeamId);

  async function submitVote(pollId: string, optionId: string) {
    setSavingPollId(pollId);
    setError("");

    if (isFallbackMode) {
      const nextVote: WorldCupVote = {
        pollId,
        optionId,
        userId: voterId,
        createdAt: new Date().toISOString(),
      };
      const nextVotes = upsertVote(votes, nextVote);
      setVotes(nextVotes);
      persistLocalVotes(nextVotes);
      setSavingPollId(null);
      return;
    }

    try {
      await api.submitWorldCupVote(pollId, optionId, voterId, apiBaseUrl);
      const refreshedVotes = await api.getWorldCupVotes(undefined, apiBaseUrl);
      setVotes(refreshedVotes);
    } catch (reason) {
      const nextVote: WorldCupVote = {
        pollId,
        optionId,
        userId: voterId,
        createdAt: new Date().toISOString(),
      };
      const nextVotes = upsertVote(votes, nextVote);
      setVotes(nextVotes);
      persistLocalVotes(nextVotes);
      setIsFallbackMode(true);
      setError(reason instanceof Error ? `تعذر تسجيل التصويت على الخادم، تم الحفظ محلياً: ${reason.message}` : "تعذر تسجيل التصويت على الخادم، تم الحفظ محلياً.");
    } finally {
      setSavingPollId(null);
    }
  }

  function countVotes(pollId: string, optionId: string): number {
    return votes.filter((vote) => vote.pollId === pollId && vote.optionId === optionId).length;
  }

  function selectedOption(pollId: string): string | null {
    const mine = votes.find((vote) => vote.pollId === pollId && vote.userId === voterId);
    return mine?.optionId ?? null;
  }

  return (
    <section className="watany-listing-surface wc-prediction-polls" dir="rtl" style={{ paddingTop: 18, paddingBottom: 18 }}>
      <h2 className="watany-listing-surface__title" style={{ width: "100%", margin: "0 0 16px", textAlign: "center", fontSize: "1.35rem", fontWeight: 800, color: "#0f172a" }}>تصويت كل مباراة</h2>

      {isFallbackMode ? (
        <p className="wc-prediction-polls__fallback">
          وضع احتياطي محلي مفعل: التصويت يُحفظ مؤقتاً على هذا الجهاز حتى عودة الخادم.
        </p>
      ) : null}

      {error ? <div className="wc-vote-error">{error}</div> : null}
      {loading ? <p className="watany-listing-card__summary">جارٍ تحميل التصويتات...</p> : null}

      {bestPlayerPoll ? (
        <article className="wc-player-poll">
          <h3 className="wc-player-poll__title">صوّت للفائز بالبطولة</h3>
          <p className="wc-player-poll__desc">المرحلة الأولى: اختر منتخبًا، ثم اختر لاعبًا من المنتخب للتصويت له.</p>

          <div className="wc-player-poll__teams">
            {teams.map((team) => (
              <button
                key={team.id}
                data-feature-key={team.id}
                type="button"
                className={`wc-player-team-btn ${selectedTeamId === team.id ? "is-active" : ""}`}
                onClick={() => setSelectedTeamId(team.id)}
              >
                <span>{team.flagEmoji ?? "🏳️"}</span>
                <span>{team.nameEn}</span>
              </button>
            ))}
          </div>

          {selectedTeam ? (
            <div className="wc-player-poll__selected-team">{selectedTeam.flagEmoji ?? "🏳️"} {selectedTeam.nameEn}</div>
          ) : null}

          <div className="wc-player-poll__players">
            {playersByTeam.map((player) => {
              const mine = selectedOption(bestPlayerPoll.id);
              const selected = mine === player.id;
              const totalVotes = countVotes(bestPlayerPoll.id, player.id);
              const canVote = bestPlayerPoll.options.includes(player.id);

              return (
                <article key={player.id} className={`wc-player-card ${selected ? "is-selected" : ""}`}>
                  <img
                    src={player.imageUrl ?? FALLBACK_AVATAR_DATA_URI}
                    alt={player.name}
                    className="wc-player-card__avatar"
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = FALLBACK_AVATAR_DATA_URI;
                    }}
                  />
                  <strong>{player.name}</strong>
                  <span>{player.position}</span>
                  <span>{totalVotes} صوت</span>
                  <button
                    type="button"
                    className="wc-player-card__vote"
                    disabled={!canVote || savingPollId === bestPlayerPoll.id}
                    onClick={() => submitVote(bestPlayerPoll.id, player.id)}
                  >
                    {selected ? "تم اختيارك" : "صوّت لهذا اللاعب"}
                  </button>
                </article>
              );
            })}
          </div>
        </article>
      ) : null}

      <div className="watany-listing-grid">
        {matchPolls.map((poll) => {
          const mine = selectedOption(poll.id);
          return (
            <article key={poll.id} className="wc-prediction-poll-card watany-listing-card">
              <h3 className="watany-listing-card__title">{poll.title}</h3>
              <p className="watany-listing-card__summary" style={{ marginTop: 8 }}>{poll.question}</p>
              <div className="watany-listing-grid watany-listing-grid--three-col wc-prediction-poll-card__options">
                {poll.options.map((option) => {
                  const optionVotes = countVotes(poll.id, option);
                  const active = mine === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      className={`wc-vote-option ${active ? "is-active" : ""}`}
                      onClick={() => submitVote(poll.id, option)}
                      disabled={savingPollId === poll.id}
                    >
                      <span className="wc-vote-option__label">{option}</span>
                      <span className="wc-vote-option__count">{optionVotes} صوت</span>
                    </button>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>

      {!loading && matchPolls.length === 0 ? (
        <p className="watany-listing-card__summary" style={{ marginTop: 16 }}>لا توجد تصويتات مباريات متاحة حالياً.</p>
      ) : null}
    </section>
  );
}