"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import styles from "./page.module.css";
import type { PresentationPhase, RankedCandidate, VoteEvent } from "@/lib/types";

type ResultsResponse = {
  event: Omit<VoteEvent, "passwordHash">;
  results: RankedCandidate[];
  counts?: {
    validVoteCount: number;
    invalidVoteCount: number;
    totalVoteCount: number;
  };
  error?: string;
};

const phaseLabels: Record<PresentationPhase, string> = {
  waiting: "待機",
  teaser: "予告",
  revealed: "発表",
  "all-results": "全順位",
  finished: "終了",
};

export default function PresentationPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId ?? "demo-2026-mvp";
  const [event, setEvent] = useState<ResultsResponse["event"] | null>(null);
  const [ranking, setRanking] = useState<RankedCandidate[]>([]);
  const [counts, setCounts] = useState<ResultsResponse["counts"]>();
  const [message, setMessage] = useState("読み込み中...");
  const [connection, setConnection] = useState<"live" | "fallback">("fallback");

  useEffect(() => {
    let isActive = true;
    let isMissing = false;
    let fallbackTimer: number | undefined;

    function applyState(body: ResultsResponse) {
      if (!isActive) return;
      if (body.error) {
        setMessage(body.error);
        return;
      }
      setEvent(body.event);
      setRanking(body.results);
      setCounts(body.counts);
      setMessage("");
    }

    async function loadState() {
      const response = await fetch(`/api/events/${eventId}/results`, {
        cache: "no-store",
      });
      const body = (await response.json()) as ResultsResponse;
      if (!response.ok) {
        if (response.status === 404) {
          isMissing = true;
          if (fallbackTimer) window.clearInterval(fallbackTimer);
          source.close();
        }
        setMessage(body.error ?? "発表状態を読み込めませんでした。");
        return;
      }
      applyState(body);
    }

    const source = new EventSource(`/api/events/${eventId}/stream`);

    source.addEventListener("state", (event) => {
      setConnection("live");
      applyState(JSON.parse(event.data) as ResultsResponse);
    });
    source.addEventListener("error", (event) => {
      const errorEvent = event as MessageEvent<string>;
      if (errorEvent.data) {
        const body = JSON.parse(errorEvent.data) as ResultsResponse;
        setMessage(body.error ?? "発表状態を読み込めませんでした。");
        isMissing = true;
      }
      setConnection("fallback");
      source.close();
    });
    source.addEventListener("error", () => {
      if (isMissing) return;
      setConnection("fallback");
      source.close();
      void loadState();
      fallbackTimer = window.setInterval(loadState, 2000);
    });

    return () => {
      isActive = false;
      source.close();
      if (fallbackTimer) window.clearInterval(fallbackTimer);
    };
  }, [eventId]);

  const phase = event?.presentationState.phase ?? "waiting";
  const currentRank =
    event?.presentationState.currentRank ?? event?.presentationCount ?? 1;
  const currentCandidate = useMemo(
    () =>
      ranking.find((candidate) => candidate.rank === currentRank) ?? ranking[0],
    [currentRank, ranking],
  );

  const headline = useMemo(() => {
    if (!event) return "MVP発表";
    if (phase === "waiting") return "発表までしばらくお待ちください";
    if (phase === "teaser") return `まもなく第${currentRank}位を発表します`;
    if (phase === "revealed") return currentCandidate?.name ?? "発表中";
    if (phase === "all-results") return "最終結果";
    return "ご参加ありがとうございました";
  }, [currentCandidate?.name, currentRank, event, phase]);

  return (
    <main className={styles.shell}>
      <section
        className={`${styles.stage} ${
          phase === "all-results" ? styles.rankingState : styles[phase]
        }`}
        aria-label="MVP発表画面"
      >
        <div className={styles.topbar}>
          <div>
            <p>MVP Voting App</p>
            <strong>{event?.name ?? "発表画面"}</strong>
          </div>
          <div className={styles.liveMeta}>
            <span>{phaseLabels[phase]}</span>
            <small>{connection === "live" ? "LIVE" : "SYNC"}</small>
          </div>
        </div>

        <div className={styles.centerpiece}>
          {phase === "revealed" && currentCandidate && (
            <div className={styles.revealVisual} key={currentCandidate.id}>
              <div className={styles.spotlightRing} />
              {currentCandidate.imagePath ? (
                <img
                  alt={`${currentCandidate.name}さん`}
                  src={currentCandidate.imagePath}
                />
              ) : (
                <span>{currentCandidate.name.slice(0, 1)}</span>
              )}
            </div>
          )}
          {phase === "teaser" && <div className={styles.count}>{currentRank}</div>}
          {phase === "waiting" && <div className={styles.pulse}>READY</div>}
          {phase === "finished" && <div className={styles.medal}>END</div>}

          <div className={styles.copy}>
            <p>{phase === "revealed" ? `第${currentRank}位` : "2026 MVP Award"}</p>
            <h1>{headline}</h1>
            {phase === "revealed" && currentCandidate && (
              <p>
                {currentCandidate.votes}票 | {currentCandidate.description}
              </p>
            )}
            {phase === "teaser" && (
              <p>会場の皆さま、準備はよろしいでしょうか。</p>
            )}
            {phase === "waiting" && (
              <p>
                管理画面から発表操作を行うと、この画面へリアルタイムに反映されます。
              </p>
            )}
            {phase === "finished" && (
              <p>結果は管理画面から確認できます。</p>
            )}
            {message && <p>{message}</p>}
          </div>

          {phase === "all-results" && (
            <div className={styles.ranking}>
              {ranking.map((person) => (
                <div className={styles.rankRow} key={person.id}>
                  <span className={styles.rankNo}>{person.rank}</span>
                  <span className={styles.avatar}>{person.name.slice(0, 1)}</span>
                  <strong>{person.name}</strong>
                  <small>{person.description}</small>
                  <b>{person.votes}票</b>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.footerBar}>
          <span>有効投票 {counts?.validVoteCount ?? 0}</span>
          <span>発表対象 {event?.presentationCount ?? 0}名</span>
        </div>
      </section>
    </main>
  );
}
