"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./admin.module.css";
import type { RankedCandidate } from "@/lib/types";

type MessageState = {
  type: "idle" | "success" | "error";
  text: string;
};

export function TieBreakManager({
  eventId,
  voteCount,
  candidates,
  disabled,
}: {
  eventId: string;
  voteCount: number;
  candidates: RankedCandidate[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [orderedCandidates, setOrderedCandidates] = useState(candidates);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<MessageState>({
    type: "idle",
    text: "",
  });

  useEffect(() => {
    setOrderedCandidates(candidates);
  }, [candidates]);

  function reorderCandidate(candidateId: string, nextIndex: number) {
    setOrderedCandidates((current) => {
      const index = current.findIndex((candidate) => candidate.id === candidateId);
      if (index < 0 || index === nextIndex) return current;

      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(nextIndex, 0, moved);
      return next;
    });
    setMessage({ type: "idle", text: "" });
  }

  function moveCandidate(candidateId: string, direction: -1 | 1) {
    const index = orderedCandidates.findIndex(
      (candidate) => candidate.id === candidateId,
    );
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= orderedCandidates.length) {
      return;
    }
    reorderCandidate(candidateId, nextIndex);
  }

  async function saveTieBreak() {
    setIsLoading(true);
    setMessage({ type: "idle", text: "" });

    const response = await fetch(`/api/events/${eventId}/ranking`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voteCount,
        orderedIds: orderedCandidates.map((candidate) => candidate.id),
      }),
    });
    const body = (await response.json()) as { error?: string };
    setIsLoading(false);

    if (!response.ok) {
      setMessage({
        type: "error",
        text: body.error ?? "同票順位を保存できませんでした。",
      });
      return;
    }

    setMessage({ type: "success", text: "同票順位を保存しました。" });
    router.refresh();
  }

  return (
    <div className={styles.tieBreakBox}>
      <div className={styles.tieBreakHeader}>
        <div>
          <strong>{voteCount}票の同票グループ</strong>
          <span className={styles.meta}>
            上から順に順位へ反映されます。行をドラッグして並び替えてください。
          </span>
        </div>
        <button
          className={styles.button}
          disabled={disabled || isLoading}
          onClick={saveTieBreak}
          type="button"
        >
          同票順位を保存
        </button>
      </div>
      <div className={styles.tieList}>
        {orderedCandidates.map((candidate, index) => (
          <div
            className={`${styles.tieRow} ${
              draggingId === candidate.id ? styles.tieRowDragging : ""
            }`}
            draggable={!disabled && !isLoading}
            key={candidate.id}
            onDragEnd={() => setDraggingId(null)}
            onDragOver={(event) => {
              event.preventDefault();
              if (!draggingId || draggingId === candidate.id) return;
              reorderCandidate(draggingId, index);
            }}
            onDragStart={(event) => {
              setDraggingId(candidate.id);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", candidate.id);
            }}
          >
            <span className={styles.dragHandle} aria-hidden="true">
              ::
            </span>
            <span className={styles.rankMark}>{index + 1}</span>
            <div className={styles.candidateInfo}>
              <strong>{candidate.name}</strong>
              <span className={styles.meta}>{candidate.votes}票</span>
            </div>
            <div className={styles.orderButtons}>
              <button
                className={styles.compactButton}
                disabled={disabled || isLoading || index === 0}
                onClick={() => moveCandidate(candidate.id, -1)}
                title="上へ移動"
                type="button"
              >
                ↑
              </button>
              <button
                className={styles.compactButton}
                disabled={
                  disabled || isLoading || index === orderedCandidates.length - 1
                }
                onClick={() => moveCandidate(candidate.id, 1)}
                title="下へ移動"
                type="button"
              >
                ↓
              </button>
            </div>
          </div>
        ))}
      </div>
      {message.text && (
        <span
          className={
            message.type === "error" ? styles.errorText : styles.successText
          }
        >
          {message.text}
        </span>
      )}
    </div>
  );
}
