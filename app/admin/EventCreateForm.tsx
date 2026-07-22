"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./admin.module.css";

type FormState = {
  name: string;
  description: string;
  password: string;
  presentationCount: number;
  voteSelectionCount: number;
};

export function EventCreateForm() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState<FormState>({
    name: "",
    description: "",
    password: "",
    presentationCount: 3,
    voteSelectionCount: 1,
  });

  async function createEvent() {
    setIsLoading(true);
    setMessage("");

    const response = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = (await response.json()) as {
      event?: { id: string };
      error?: string;
    };
    setIsLoading(false);

    if (!response.ok || !body.event) {
      setMessage(body.error ?? "イベントを作成できませんでした。");
      return;
    }

    router.push(`/admin/${body.event.id}`);
  }

  return (
    <div className={styles.createEventBox}>
      <button
        className={styles.primaryButton}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        新規イベント作成
      </button>

      {isOpen && (
        <div className={styles.createEventForm}>
          <label className={styles.field}>
            <span>イベント名</span>
            <input
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="例: 2026 MVP投票"
              value={form.name}
            />
          </label>
          <label className={styles.field}>
            <span>イベント説明</span>
            <input
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="任意の説明"
              value={form.description}
            />
          </label>
          <label className={styles.field}>
            <span>参加パスワード</span>
            <input
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              placeholder="投票者が入力するパスワード"
              type="password"
              value={form.password}
            />
          </label>
          <label className={styles.field}>
            <span>投票人数</span>
            <input
              max={10}
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
              max={10}
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
              disabled={!form.name.trim() || !form.password.trim() || isLoading}
              onClick={createEvent}
              type="button"
            >
              {isLoading ? "作成中..." : "作成して開く"}
            </button>
            <button
              className={styles.ghostButton}
              disabled={isLoading}
              onClick={() => setIsOpen(false)}
              type="button"
            >
              キャンセル
            </button>
          </div>
          {message && <span className={styles.errorText}>{message}</span>}
        </div>
      )}
    </div>
  );
}
