"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
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

type PresentationUpdateResponse = {
  presentationState?: VoteEvent["presentationState"];
  error?: string;
};

const phaseLabels: Record<PresentationPhase, string> = {
  waiting: "待機",
  teaser: "予告",
  revealed: "順位発表",
  "all-results": "終了",
  finished: "終了",
};

export function PresentationPageClient({ eventId }: { eventId: string }) {
  const [event, setEvent] = useState<ResultsResponse["event"] | null>(null);
  const [ranking, setRanking] = useState<RankedCandidate[]>([]);
  const [counts, setCounts] = useState<ResultsResponse["counts"]>();
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [message, setMessage] = useState("読み込み中...");
  const [connection, setConnection] = useState<"live" | "fallback">("fallback");
  const [isControlOpen, setIsControlOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [controlMessage, setControlMessage] = useState("");
  const voteUrl = useMemo(
    () =>
      typeof window === "undefined"
        ? `/vote/${eventId}`
        : `${window.location.origin}/vote/${eventId}`,
    [eventId],
  );

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

  useEffect(() => {
    let isActive = true;

    QRCode.toDataURL(voteUrl, {
      margin: 2,
      width: 440,
      color: {
        dark: "#102033",
        light: "#ffffff",
      },
    })
      .then((dataUrl) => {
        if (isActive) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (isActive) setQrDataUrl("");
      });

    return () => {
      isActive = false;
    };
  }, [voteUrl]);

  const phase = event?.presentationState.phase ?? "waiting";
  const currentRank =
    event?.presentationState.currentRank ?? event?.presentationCount ?? 1;
  const presentationCount = event?.presentationCount ?? 1;
  const previousRank = Math.min(presentationCount, currentRank + 1);
  const nextRank = Math.max(1, currentRank - 1);
  const currentCandidate = useMemo(
    () =>
      ranking.find((candidate) => candidate.rank === currentRank) ?? ranking[0],
    [currentRank, ranking],
  );
  const waitingStatusLabel = useMemo(() => {
    if (!event) return "読み込み中";
    if (event.status === "draft") return "準備中";
    if (event.status === "voting") return "投票受付中";
    if (event.status === "closed" || event.status === "presenting") {
      return "発表準備中";
    }
    return "発表終了";
  }, [event]);
  const waitingDescription = useMemo(() => {
    if (!event) return "発表画面を読み込んでいます。";
    if (event.status === "draft") {
      return "管理者が投票受付を開始するまでお待ちください。";
    }
    if (event.status === "voting") {
      return "スマートフォンでQRコードを読み取って投票してください。";
    }
    if (event.status === "closed" || event.status === "presenting") {
      return "投票は締め切られました。まもなく発表を開始します。";
    }
    return "ご参加ありがとうございました。";
  }, [event]);

  const headline = useMemo(() => {
    if (!event) return "MVP発表";
    if (phase === "waiting") return waitingStatusLabel;
    if (phase === "teaser") return `まもなく第${currentRank}位を発表します`;
    if (phase === "revealed") return currentCandidate?.name ?? "発表中";
    return "ご参加ありがとうございました";
  }, [currentCandidate?.name, currentRank, event, phase, waitingStatusLabel]);

  const nextAction = useMemo(() => {
    if (phase === "waiting") {
      return {
        label: `第${currentRank}位を予告`,
        phase: "teaser" as PresentationPhase,
        rank: currentRank,
      };
    }
    if (phase === "teaser") {
      return {
        label: `第${currentRank}位を発表`,
        phase: "revealed" as PresentationPhase,
        rank: currentRank,
      };
    }
    if (phase === "revealed" && currentRank > 1) {
      return {
        label: `第${nextRank}位へ進む`,
        phase: "teaser" as PresentationPhase,
        rank: nextRank,
      };
    }
    return {
      label: "終了画面へ",
      phase: "finished" as PresentationPhase,
    };
  }, [currentRank, nextRank, phase]);

  async function updatePresentation(nextPhase: PresentationPhase, rank?: number) {
    setIsUpdating(true);
    setControlMessage("");

    try {
      const response = await fetch(`/api/events/${eventId}/presentation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: nextPhase, currentRank: rank }),
      });
      const body = (await response.json()) as PresentationUpdateResponse;

      if (!response.ok || !body.presentationState) {
        throw new Error(body.error ?? "発表画面を更新できませんでした。");
      }

      setEvent((current) =>
        current
          ? { ...current, presentationState: body.presentationState! }
          : current,
      );
      setControlMessage("発表画面へ反映しました。");
    } catch (error) {
      setControlMessage(
        error instanceof Error
          ? error.message
          : "発表画面を更新できませんでした。",
      );
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <main className={styles.shell}>
      <section
        className={`${styles.stage} ${
          phase === "all-results" ? styles.finished : styles[phase]
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
          {phase === "waiting" && event?.status === "voting" && (
            <div className={styles.waitingQrCard}>
              {qrDataUrl ? (
                <img alt="投票参加用QRコード" src={qrDataUrl} />
              ) : (
                <div className={styles.pulse}>READY</div>
              )}
              <span>{waitingStatusLabel}</span>
              <code>{voteUrl}</code>
            </div>
          )}
          {phase === "waiting" && event?.status !== "voting" && (
            <div className={styles.waitingStateCard}>
              <span>{waitingStatusLabel}</span>
            </div>
          )}
          {(phase === "finished" || phase === "all-results") && (
            <div className={styles.medal}>END</div>
          )}

          <div className={styles.copy}>
            <p>{phase === "revealed" ? `第${currentRank}位` : "2026 MVP Award"}</p>
            <h1>{headline}</h1>
            {phase === "revealed" && currentCandidate && (
              <p>
                {currentCandidate.votes}票 | {currentCandidate.description}
              </p>
            )}
            {phase === "teaser" && (
              <p>会場のみなさま、発表の準備はよろしいでしょうか。</p>
            )}
            {phase === "waiting" && (
              <p>
                {waitingDescription}
              </p>
            )}
            {(phase === "finished" || phase === "all-results") && (
              <p>全体の順位は管理画面で確認できます。</p>
            )}
            {message && <p>{message}</p>}
          </div>
        </div>

        <div className={styles.footerBar}>
          <span>有効投票 {counts?.validVoteCount ?? 0}</span>
          <span>発表対象 {event?.presentationCount ?? 0}名</span>
        </div>

        <div className={styles.controlDock}>
          {isControlOpen && (
            <div className={styles.controlPanel}>
              <div className={styles.controlHeader}>
                <span>発表操作</span>
                <strong>
                  {phaseLabels[phase]} / 第{currentRank}位
                </strong>
              </div>
              <button
                className={styles.controlPrimary}
                disabled={isUpdating || !event}
                onClick={() => updatePresentation(nextAction.phase, nextAction.rank)}
                type="button"
              >
                {nextAction.label}
              </button>
              <div className={styles.controlGrid}>
                <button
                  disabled={isUpdating || !event}
                  onClick={() => updatePresentation("waiting")}
                  type="button"
                >
                  待機
                </button>
                <button
                  disabled={isUpdating || !event}
                  onClick={() => updatePresentation("teaser", currentRank)}
                  type="button"
                >
                  予告
                </button>
                <button
                  disabled={isUpdating || !event}
                  onClick={() => updatePresentation("revealed", currentRank)}
                  type="button"
                >
                  発表
                </button>
                <button
                  disabled={isUpdating || !event || currentRank <= 1}
                  onClick={() => updatePresentation("teaser", nextRank)}
                  type="button"
                >
                  次へ
                </button>
                <button
                  disabled={isUpdating || !event || currentRank >= presentationCount}
                  onClick={() => updatePresentation("teaser", previousRank)}
                  type="button"
                >
                  戻る
                </button>
                <button
                  disabled={isUpdating || !event}
                  onClick={() => updatePresentation("finished")}
                  type="button"
                >
                  終了
                </button>
              </div>
              {controlMessage && (
                <span className={styles.controlMessage}>{controlMessage}</span>
              )}
            </div>
          )}
          <button
            className={styles.controlToggle}
            onClick={() => setIsControlOpen((current) => !current)}
            type="button"
          >
            {isControlOpen ? "閉じる" : "操作"}
          </button>
        </div>
      </section>
    </main>
  );
}
