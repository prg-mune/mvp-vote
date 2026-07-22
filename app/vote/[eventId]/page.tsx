"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import styles from "./page.module.css";
import type { Candidate, EventStatus, VoteEvent } from "@/lib/types";

type VoteStep = "password" | "nickname" | "select" | "confirm" | "complete";

type EventResponse = {
  event: Omit<VoteEvent, "passwordHash">;
  candidates: Candidate[];
  votes: Array<{ isValid: boolean }>;
  error?: string;
};

type VoteResponse = {
  vote?: { id: string; updatedAt: string };
  error?: string;
};

export default function VotePage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId ?? "demo-2026-mvp";
  const [step, setStep] = useState<VoteStep>("password");
  const [event, setEvent] = useState<EventResponse["event"] | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [validVoteCount, setValidVoteCount] = useState(0);
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [browserId, setBrowserId] = useState("");
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const storedBrowserId =
      window.localStorage.getItem("mvp-voting-browser-id") ||
      crypto.randomUUID();
    window.localStorage.setItem("mvp-voting-browser-id", storedBrowserId);
    setBrowserId(storedBrowserId);
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadEvent() {
      try {
      setIsLoading(true);
      const response = await fetch(`/api/events/${eventId}`);
      const body = (await response.json()) as EventResponse;

      if (!isActive) return;

      if (!response.ok) {
        setMessage(body.error ?? "イベントを読み込めませんでした。");
        setIsLoading(false);
        return;
      }

      const orderedCandidates = [...body.candidates].sort(
        (a, b) => a.displayOrder - b.displayOrder,
      );
      setEvent(body.event);
      setCandidates(orderedCandidates);
      setSelectedIds([]);
      setValidVoteCount(body.votes.filter((vote) => vote.isValid).length);
      setIsLoading(false);
      } catch {
        if (!isActive) return;
        setEvent(null);
        setMessage("イベント情報の読み込みに失敗しました。URLを確認して再読み込みしてください。");
        setIsLoading(false);
      }
    }

    loadEvent();

    return () => {
      isActive = false;
    };
  }, [eventId]);

  const selectionCount = event?.voteSelectionCount ?? 1;
  const selected = useMemo(
    () =>
      selectedIds
        .map((selectedId) =>
          candidates.find((candidate) => candidate.id === selectedId),
        )
        .filter((candidate): candidate is Candidate => Boolean(candidate)),
    [candidates, selectedIds],
  );
  const progress =
    ["password", "nickname", "select", "confirm", "complete"].indexOf(step) + 1;

  async function submitVote() {
    if (selected.length !== selectionCount) return;

    setIsSubmitting(true);
    setMessage("");

    const response = await fetch(`/api/events/${eventId}/votes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password,
        browserId,
        nickname,
        candidateIds: selected.map((candidate) => candidate.id),
      }),
    });
    const body = (await response.json()) as VoteResponse;
    setIsSubmitting(false);

    if (!response.ok) {
      setMessage(body.error ?? "投票を保存できませんでした。");
      return;
    }

    setSubmittedAt(
      new Intl.DateTimeFormat("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(body.vote?.updatedAt ?? new Date())),
    );
    setValidVoteCount((count) => count + 1);
    setStep("complete");
  }

  function toggleCandidate(candidateId: string) {
    setSelectedIds((current) => {
      if (current.includes(candidateId)) {
        return current.filter((selectedId) => selectedId !== candidateId);
      }
      if (current.length >= selectionCount) {
        return current;
      }
      return [...current, candidateId];
    });
  }

  if (isLoading) {
    return (
      <main className={styles.shell}>
        <section className={styles.card}>
          <p className={styles.eyebrow}>MVP Vote</p>
          <h1>読み込み中</h1>
        </section>
      </main>
    );
  }

  if (!event) {
    return <StatusMessage title="イベントが見つかりません" message={message} />;
  }

  if (event.status === "draft") {
    return (
      <StatusMessage
        title="投票受付前です"
        message="管理者が投票受付を開始するまでお待ちください。"
      />
    );
  }

  if (event.status !== "voting" && step !== "complete") {
    return (
      <StatusMessage
        title="投票は締め切られました"
        message="新規投票と投票先の変更はできません。"
      />
    );
  }

  return (
    <main className={styles.shell}>
      <section className={styles.card} aria-label="MVP投票">
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>MVP Vote</p>
            <h1>{event.name}</h1>
            <p>現在{validVoteCount}名が投票済みです</p>
          </div>
          <div className={styles.progress} aria-label={`進行状況 ${progress}/5`}>
            <span style={{ width: `${(progress / 5) * 100}%` }} />
          </div>
        </header>

        {message && <p className={styles.errorText}>{message}</p>}

        {step === "password" && (
          <div className={styles.panel}>
            <div className={styles.copy}>
              <h2>参加パスワードを入力</h2>
              <p>会場で案内されたイベント参加パスワードを入力してください。</p>
            </div>
            <label className={styles.field}>
              <span>イベント参加パスワード</span>
              <input
                value={password}
                onChange={(inputEvent) => setPassword(inputEvent.target.value)}
                placeholder="例: mvp2026"
                type="password"
              />
            </label>
            <div className={styles.actions}>
              <button
                className={styles.primary}
                disabled={!password.trim()}
                onClick={() => setStep("nickname")}
                type="button"
              >
                次へ
              </button>
            </div>
          </div>
        )}

        {step === "nickname" && (
          <div className={styles.panel}>
            <div className={styles.copy}>
              <h2>ニックネームを入力</h2>
              <p>同じブラウザでもニックネームが異なる場合は別投票者として扱います。</p>
            </div>
            <label className={styles.field}>
              <span>ニックネーム</span>
              <input
                value={nickname}
                onChange={(inputEvent) => setNickname(inputEvent.target.value)}
                placeholder="例: たろう"
              />
            </label>
            <div className={styles.actions}>
              <button
                className={styles.secondary}
                onClick={() => setStep("password")}
                type="button"
              >
                戻る
              </button>
              <button
                className={styles.primary}
                disabled={!nickname.trim()}
                onClick={() => setStep("select")}
                type="button"
              >
                候補者を選ぶ
              </button>
            </div>
          </div>
        )}

        {step === "select" && (
          <div className={styles.panel}>
            <div className={styles.copy}>
              <h2>MVP候補者を{selectionCount}名選択</h2>
              <p>
                {selected.length}/{selectionCount}名を選択中です。投票受付中であれば、あとから投票先を変更できます。
              </p>
            </div>
            <div className={styles.candidateList}>
              {candidates.map((candidate) => (
                <button
                  className={`${styles.candidate} ${
                    selectedIds.includes(candidate.id) ? styles.selected : ""
                  }`}
                  key={candidate.id}
                  onClick={() => toggleCandidate(candidate.id)}
                  type="button"
                >
                  <span className={styles.avatar}>{candidate.name.slice(0, 1)}</span>
                  <span>
                    <strong>{candidate.name}</strong>
                    <small>{candidate.description}</small>
                  </span>
                </button>
              ))}
            </div>
            <div className={styles.actions}>
              <button
                className={styles.secondary}
                onClick={() => setStep("nickname")}
                type="button"
              >
                戻る
              </button>
              <button
                className={styles.primary}
                disabled={selected.length !== selectionCount}
                onClick={() => setStep("confirm")}
                type="button"
              >
                確認へ進む
              </button>
            </div>
          </div>
        )}

        {step === "confirm" && selected.length === selectionCount && (
          <div className={styles.panel}>
            <div className={styles.copy}>
              <h2>投票内容の確認</h2>
              <p>選択した{selectionCount}名で投票を確定します。</p>
            </div>
            {selected.map((candidate) => (
              <div className={styles.confirmBox} key={candidate.id}>
                <span>投票先</span>
                <strong>{candidate.name}</strong>
                <p>{candidate.description}</p>
              </div>
            ))}
            <div className={styles.actions}>
              <button
                className={styles.secondary}
                onClick={() => setStep("select")}
                type="button"
              >
                選び直す
              </button>
              <button
                className={styles.primary}
                disabled={isSubmitting}
                onClick={submitVote}
                type="button"
              >
                {isSubmitting ? "保存中..." : "投票を確定する"}
              </button>
            </div>
          </div>
        )}

        {step === "complete" && selected.length > 0 && (
          <div className={styles.panel}>
            <div className={styles.doneMark}>完了</div>
            <div className={styles.copy}>
              <h2>投票が完了しました</h2>
              <p>
                {nickname}さんの現在の投票先は {selected.map((candidate) => candidate.name).join("、")} です。
                {submittedAt ? ` ${submittedAt} に保存しました。` : ""}
              </p>
            </div>
            <div className={styles.actions}>
              <button
                className={styles.primary}
                onClick={() => setStep("select")}
                type="button"
              >
                投票先を変更する
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function StatusMessage({ title, message }: { title: string; message: string }) {
  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>MVP Vote</p>
        <div className={styles.copy}>
          <h1>{title}</h1>
          <p>{message}</p>
        </div>
      </section>
    </main>
  );
}
