"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import styles from "./admin.module.css";
import type { EventStatus, PresentationPhase } from "@/lib/types";

type ActionState = {
  type: "idle" | "success" | "error";
  message: string;
};

const phaseLabels: Record<PresentationPhase, string> = {
  waiting: "待機",
  teaser: "予告",
  revealed: "順位発表",
  "all-results": "終了",
  finished: "終了",
};

export function EventStatusActions({
  eventId,
  status,
}: {
  eventId: string;
  status: EventStatus;
}) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>({ type: "idle", message: "" });
  const [isLoading, setIsLoading] = useState(false);

  async function updateStatus(nextStatus: EventStatus) {
    setIsLoading(true);
    setState({ type: "idle", message: "" });
    const response = await fetch(`/api/events/${eventId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const body = (await response.json()) as { error?: string };
    setIsLoading(false);

    if (!response.ok) {
      setState({
        type: "error",
        message: body.error ?? "イベント状態の更新に失敗しました。",
      });
      return;
    }

    setState({ type: "success", message: "イベント状態を更新しました。" });
    router.refresh();
  }

  return (
    <div className={styles.inlineActions}>
      {status === "draft" && (
        <button
          className={styles.primaryButton}
          disabled={isLoading}
          onClick={() => updateStatus("voting")}
          type="button"
        >
          投票受付を開始
        </button>
      )}
      {status === "voting" && (
        <button
          className={styles.primaryButton}
          disabled={isLoading}
          onClick={() => updateStatus("closed")}
          type="button"
        >
          投票を締切
        </button>
      )}
      {status === "closed" && (
        <button
          className={styles.primaryButton}
          disabled={isLoading}
          onClick={() => updateStatus("presenting")}
          type="button"
        >
          結果発表を開始
        </button>
      )}
      {state.message && (
        <span
          className={
            state.type === "error" ? styles.errorText : styles.successText
          }
        >
          {state.message}
        </span>
      )}
    </div>
  );
}

export function PresentationControls({
  eventId,
  phase,
  currentRank,
  presentationCount,
}: {
  eventId: string;
  phase: PresentationPhase;
  currentRank?: number;
  presentationCount: number;
}) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>({ type: "idle", message: "" });
  const [isLoading, setIsLoading] = useState(false);

  const safeCurrentRank = currentRank ?? presentationCount;
  const previousRank = Math.min(presentationCount, safeCurrentRank + 1);
  const nextRank = Math.max(1, safeCurrentRank - 1);

  const nextAction = useMemo(() => {
    if (phase === "waiting") {
      return {
        label: `第${safeCurrentRank}位の予告を表示`,
        phase: "teaser" as PresentationPhase,
        rank: safeCurrentRank,
      };
    }
    if (phase === "teaser") {
      return {
        label: `第${safeCurrentRank}位を発表`,
        phase: "revealed" as PresentationPhase,
        rank: safeCurrentRank,
      };
    }
    if (phase === "revealed" && safeCurrentRank > 1) {
      return {
        label: `第${nextRank}位の予告へ進む`,
        phase: "teaser" as PresentationPhase,
        rank: nextRank,
      };
    }
    if (phase === "revealed") {
      return {
        label: "終了画面を表示",
        phase: "finished" as PresentationPhase,
      };
    }
    return {
      label: "待機画面に戻る",
      phase: "waiting" as PresentationPhase,
    };
  }, [nextRank, phase, safeCurrentRank]);

  async function updatePresentation(nextPhase: PresentationPhase, rank?: number) {
    setIsLoading(true);
    setState({ type: "idle", message: "" });
    const response = await fetch(`/api/events/${eventId}/presentation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase: nextPhase, currentRank: rank }),
    });
    const body = (await response.json()) as { error?: string };
    setIsLoading(false);

    if (!response.ok) {
      setState({
        type: "error",
        message: body.error ?? "発表画面の更新に失敗しました。",
      });
      return;
    }

    setState({ type: "success", message: "発表画面へ反映しました。" });
    router.refresh();
  }

  return (
    <div className={styles.presentationControlBox}>
      <div className={styles.presentationGuide}>
        <div className={styles.currentStageCard}>
          <span className={styles.statLabel}>現在の表示</span>
          <strong>{phaseLabels[phase]}</strong>
          <span className={styles.meta}>
            {phase === "teaser" || phase === "revealed"
              ? `第${safeCurrentRank}位`
              : "スクリーンに反映中"}
          </span>
        </div>
        <div className={styles.nextStageCard}>
          <span className={styles.statLabel}>次の操作</span>
          <strong>{nextAction.label}</strong>
          <button
            className={styles.primaryButton}
            disabled={isLoading}
            onClick={() => updatePresentation(nextAction.phase, nextAction.rank)}
            type="button"
          >
            この画面へ進める
          </button>
        </div>
      </div>

      <div className={styles.flowGuide}>
        {[
          ["waiting", "待機"],
          ["teaser", "予告"],
          ["revealed", "順位発表"],
          ["finished", "終了"],
        ].map(([stepPhase, label], index) => (
          <div
            className={`${styles.flowStep} ${
              phase === stepPhase || (phase === "all-results" && stepPhase === "finished")
                ? styles.flowStepActive
                : ""
            }`}
            key={stepPhase}
          >
            <span>{index + 1}</span>
            <strong>{label}</strong>
          </div>
        ))}
      </div>

      <div className={styles.resultActions}>
        <button
          className={styles.button}
          disabled={isLoading || safeCurrentRank >= presentationCount}
          onClick={() => updatePresentation("teaser", previousRank)}
          type="button"
        >
          ひとつ前の順位へ
        </button>
        <button
          className={styles.button}
          disabled={isLoading || safeCurrentRank <= 1}
          onClick={() => updatePresentation("teaser", nextRank)}
          type="button"
        >
          次の順位へ
        </button>
        <button
          className={styles.ghostButton}
          disabled={isLoading}
          onClick={() => updatePresentation("waiting")}
          type="button"
        >
          待機へ戻る
        </button>
      </div>

      {state.message && (
        <span
          className={
            state.type === "error" ? styles.errorText : styles.successText
          }
        >
          {state.message}
        </span>
      )}
    </div>
  );
}

export function EventDangerActions({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>({ type: "idle", message: "" });
  const [isLoading, setIsLoading] = useState(false);

  async function initializeEvent() {
    if (
      !window.confirm(
        "イベントを初期化します。候補者、投票結果、発表状態をすべて削除し、下書き状態に戻します。実行しますか？",
      )
    ) {
      return;
    }

    setIsLoading(true);
    setState({ type: "idle", message: "" });
    const response = await fetch(`/api/events/${eventId}/initialize`, {
      method: "POST",
    });
    const body = (await response.json()) as { error?: string };
    setIsLoading(false);

    if (!response.ok) {
      setState({
        type: "error",
        message: body.error ?? "イベントを初期化できませんでした。",
      });
      return;
    }

    setState({ type: "success", message: "イベントを初期化しました。" });
    router.refresh();
  }

  async function resetVoteResults() {
    if (
      !window.confirm(
        "投票結果をリセットします。候補者とイベント設定は残し、投票、集計、発表状態だけを削除します。実行しますか？",
      )
    ) {
      return;
    }

    setIsLoading(true);
    setState({ type: "idle", message: "" });
    const response = await fetch(`/api/events/${eventId}/reset`, {
      method: "POST",
    });
    const body = (await response.json()) as { error?: string };
    setIsLoading(false);

    if (!response.ok) {
      setState({
        type: "error",
        message: body.error ?? "投票結果をリセットできませんでした。",
      });
      return;
    }

    setState({ type: "success", message: "投票結果をリセットしました。" });
    router.refresh();
  }

  async function deleteEvent() {
    if (
      !window.confirm(
        "このイベントを削除します。候補者、投票、集計データも削除されます。実行しますか？",
      )
    ) {
      return;
    }

    setIsLoading(true);
    setState({ type: "idle", message: "" });
    const response = await fetch(`/api/events/${eventId}`, {
      method: "DELETE",
    });
    const body = (await response.json()) as { error?: string };
    setIsLoading(false);

    if (!response.ok) {
      setState({
        type: "error",
        message: body.error ?? "イベントを削除できませんでした。",
      });
      return;
    }

    router.push("/admin");
  }

  return (
    <div className={styles.dangerBox}>
      <div>
        <h3>イベント整理</h3>
        <p className={styles.meta}>
          候補者を含めて最初からやり直す、投票結果だけ消す、イベント自体を削除する操作です。
        </p>
      </div>
      <div className={styles.resultActions}>
        <button
          className={styles.button}
          disabled={isLoading}
          onClick={initializeEvent}
          type="button"
        >
          イベントを初期化
        </button>
        <button
          className={styles.button}
          disabled={isLoading}
          onClick={resetVoteResults}
          type="button"
        >
          投票結果をリセット
        </button>
        <button
          className={styles.dangerButton}
          disabled={isLoading}
          onClick={deleteEvent}
          type="button"
        >
          イベントを削除
        </button>
      </div>
      {state.message && (
        <span
          className={
            state.type === "error" ? styles.errorText : styles.successText
          }
        >
          {state.message}
        </span>
      )}
    </div>
  );
}
