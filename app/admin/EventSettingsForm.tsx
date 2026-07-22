"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./admin.module.css";

type EventSettings = {
  name: string;
  description?: string;
  presentationCount: number;
  voteSelectionCount: number;
};

type MessageState = {
  type: "idle" | "success" | "error";
  text: string;
};

export function EventSettingsForm({
  eventId,
  event,
  candidateCount,
}: {
  eventId: string;
  event: EventSettings;
  candidateCount: number;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: event.name,
    description: event.description ?? "",
    password: "",
    presentationCount: event.presentationCount,
    voteSelectionCount: event.voteSelectionCount,
  });
  const [message, setMessage] = useState<MessageState>({
    type: "idle",
    text: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  async function saveSettings() {
    setIsLoading(true);
    setMessage({ type: "idle", text: "" });

    const response = await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description,
        password: form.password || undefined,
        presentationCount: form.presentationCount,
        voteSelectionCount: form.voteSelectionCount,
      }),
    });
    const body = (await response.json()) as { error?: string };
    setIsLoading(false);

    if (!response.ok) {
      setMessage({
        type: "error",
        text: body.error ?? "イベント設定を保存できませんでした。",
      });
      return;
    }

    setForm((current) => ({ ...current, password: "" }));
    setMessage({ type: "success", text: "イベント設定を保存しました。" });
    router.refresh();
  }

  return (
    <div className={styles.settingsForm}>
      <label className={`${styles.field} ${styles.fieldWide}`}>
        <span>イベント名</span>
        <input
          disabled={isLoading}
          onChange={(event) =>
            setForm((current) => ({ ...current, name: event.target.value }))
          }
          value={form.name}
        />
      </label>
      <label className={`${styles.field} ${styles.fieldWide}`}>
        <span>イベント説明</span>
        <input
          disabled={isLoading}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
          value={form.description}
        />
      </label>
      <label className={styles.field}>
        <span>参加パスワード</span>
        <input
          disabled={isLoading}
          onChange={(event) =>
            setForm((current) => ({ ...current, password: event.target.value }))
          }
          placeholder="変更する場合だけ入力"
          type="password"
          value={form.password}
        />
      </label>
      <label className={styles.field}>
        <span>投票人数</span>
        <input
          disabled={isLoading}
          max={Math.max(1, candidateCount || 10)}
          min={1}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              voteSelectionCount: Number(event.target.value),
            }))
          }
          type="number"
          value={form.voteSelectionCount}
        />
      </label>
      <label className={styles.field}>
        <span>発表人数</span>
        <input
          disabled={isLoading}
          max={Math.max(1, candidateCount || 10)}
          min={1}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              presentationCount: Number(event.target.value),
            }))
          }
          type="number"
          value={form.presentationCount}
        />
      </label>
      <div className={styles.resultActions}>
        <button
          className={styles.primaryButton}
          disabled={isLoading || !form.name.trim()}
          onClick={saveSettings}
          type="button"
        >
          設定を保存
        </button>
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
    </div>
  );
}
