"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./admin.module.css";
import type { Vote } from "@/lib/types";

type MessageState = {
  type: "idle" | "success" | "error";
  text: string;
};

export function VoteValidityButton({
  eventId,
  vote,
}: {
  eventId: string;
  vote: Vote;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function toggleValidity() {
    setIsLoading(true);
    await fetch(`/api/events/${eventId}/votes/${vote.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isValid: !vote.isValid }),
    });
    setIsLoading(false);
    router.refresh();
  }

  return (
    <button
      className={vote.isValid ? styles.ghostButton : styles.primaryButton}
      disabled={isLoading}
      onClick={toggleValidity}
      type="button"
    >
      {vote.isValid ? "無効化" : "復活"}
    </button>
  );
}

export function RankingConfirmButton({
  eventId,
  disabled,
}: {
  eventId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<MessageState>({ type: "idle", text: "" });
  const [isLoading, setIsLoading] = useState(false);

  async function confirmRanking() {
    setIsLoading(true);
    setState({ type: "idle", text: "" });
    const response = await fetch(`/api/events/${eventId}/ranking`, {
      method: "POST",
    });
    const body = (await response.json()) as { error?: string };
    setIsLoading(false);

    if (!response.ok) {
      setState({
        type: "error",
        text: body.error ?? "順位を確定できませんでした。",
      });
      return;
    }

    setState({ type: "success", text: "順位を確定しました。" });
    router.refresh();
  }

  return (
    <div className={styles.inlineActions}>
      <button
        className={styles.primaryButton}
        disabled={disabled || isLoading}
        onClick={confirmRanking}
        type="button"
      >
        順位を確定
      </button>
      {state.text && (
        <span
          className={
            state.type === "error" ? styles.errorText : styles.successText
          }
        >
          {state.text}
        </span>
      )}
    </div>
  );
}

export function QrInvitePanel({ eventId }: { eventId: string }) {
  const [copied, setCopied] = useState(false);

  const voteUrl =
    typeof window === "undefined"
      ? `/vote/${eventId}`
      : `${window.location.origin}/vote/${eventId}`;

  async function copyUrl() {
    await navigator.clipboard.writeText(voteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className={styles.inlineActions}>
      <Link
        className={styles.screenLinkButton}
        href={`/qr/${eventId}`}
        rel="noreferrer"
        target="_blank"
      >
        QR画面を開く ↗
      </Link>
      <button className={styles.ghostButton} onClick={copyUrl} type="button">
        参加URLをコピー
      </button>
      {copied && <span className={styles.successText}>コピーしました。</span>}
    </div>
  );
}
