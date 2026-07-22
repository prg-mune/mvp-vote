"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import styles from "./admin.module.css";
import type { Candidate, EventStatus } from "@/lib/types";

type CandidateFormState = {
  name: string;
  description: string;
  imagePath: string;
};

type MessageState = {
  type: "idle" | "success" | "error";
  text: string;
};

function sortCandidates(candidates: Candidate[]) {
  return [...candidates].sort((a, b) => a.displayOrder - b.displayOrder);
}

function parseBulkCandidates(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", description = "", ...imageParts] = line.split(",");
      return {
        name: name.trim(),
        description: description.trim(),
        imagePath: imageParts.join(",").trim(),
      };
    })
    .filter((candidate) => candidate.name);
}

const emptyCandidate: CandidateFormState = {
  name: "",
  description: "",
  imagePath: "",
};

export function CandidateManager({
  eventId,
  status,
  candidates,
}: {
  eventId: string;
  status: EventStatus;
  candidates: Candidate[];
}) {
  const router = useRouter();
  const [newCandidate, setNewCandidate] =
    useState<CandidateFormState>(emptyCandidate);
  const [bulkText, setBulkText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCandidate, setEditingCandidate] =
    useState<CandidateFormState>(emptyCandidate);
  const [orderedCandidates, setOrderedCandidates] = useState<Candidate[]>(
    sortCandidates(candidates),
  );
  const [message, setMessage] = useState<MessageState>({
    type: "idle",
    text: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  const isEditable = status === "draft";
  const bulkCandidates = useMemo(() => parseBulkCandidates(bulkText), [bulkText]);
  const originalOrderIds = useMemo(
    () => sortCandidates(candidates).map((candidate) => candidate.id).join(","),
    [candidates],
  );
  const currentOrderIds = orderedCandidates
    .map((candidate) => candidate.id)
    .join(",");
  const hasOrderChanged = currentOrderIds !== originalOrderIds;

  useEffect(() => {
    setOrderedCandidates(sortCandidates(candidates));
  }, [candidates]);

  async function addCandidate() {
    setIsLoading(true);
    setMessage({ type: "idle", text: "" });

    const response = await fetch(`/api/events/${eventId}/candidates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCandidate),
    });
    const body = (await response.json()) as { error?: string };
    setIsLoading(false);

    if (!response.ok) {
      setMessage({
        type: "error",
        text: body.error ?? "候補者を追加できませんでした。",
      });
      return;
    }

    setNewCandidate(emptyCandidate);
    setMessage({ type: "success", text: "候補者を追加しました。" });
    router.refresh();
  }

  async function addBulkCandidates() {
    setIsLoading(true);
    setMessage({ type: "idle", text: "" });

    const response = await fetch(`/api/events/${eventId}/candidates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidates: bulkCandidates }),
    });
    const body = (await response.json()) as { error?: string };
    setIsLoading(false);

    if (!response.ok) {
      setMessage({
        type: "error",
        text: body.error ?? "候補者を一括登録できませんでした。",
      });
      return;
    }

    setBulkText("");
    setMessage({
      type: "success",
      text: `${bulkCandidates.length}名の候補者を登録しました。`,
    });
    router.refresh();
  }

  async function saveCandidate(candidateId: string) {
    setIsLoading(true);
    setMessage({ type: "idle", text: "" });

    const response = await fetch(
      `/api/events/${eventId}/candidates/${candidateId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingCandidate),
      },
    );
    const body = (await response.json()) as { error?: string };
    setIsLoading(false);

    if (!response.ok) {
      setMessage({
        type: "error",
        text: body.error ?? "候補者を保存できませんでした。",
      });
      return;
    }

    setEditingId(null);
    setMessage({ type: "success", text: "候補者を保存しました。" });
    router.refresh();
  }

  async function deleteCandidate(candidate: Candidate) {
    if (
      !window.confirm(
        `${candidate.name}さんを候補者から削除します。実行しますか？`,
      )
    ) {
      return;
    }

    setIsLoading(true);
    setMessage({ type: "idle", text: "" });

    const response = await fetch(
      `/api/events/${eventId}/candidates/${candidate.id}`,
      { method: "DELETE" },
    );
    const body = (await response.json()) as { error?: string };
    setIsLoading(false);

    if (!response.ok) {
      setMessage({
        type: "error",
        text: body.error ?? "候補者を削除できませんでした。",
      });
      return;
    }

    setEditingId(null);
    setMessage({ type: "success", text: "候補者を削除しました。" });
    router.refresh();
  }

  async function saveOrder() {
    setIsLoading(true);
    setMessage({ type: "idle", text: "" });

    const response = await fetch(`/api/events/${eventId}/candidates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderedIds: orderedCandidates.map((candidate) => candidate.id),
      }),
    });
    const body = (await response.json()) as { error?: string };
    setIsLoading(false);

    if (!response.ok) {
      setMessage({
        type: "error",
        text: body.error ?? "並び順を保存できませんでした。",
      });
      return;
    }

    setMessage({ type: "success", text: "並び順を保存しました。" });
    router.refresh();
  }

  function startEdit(candidate: Candidate) {
    setEditingId(candidate.id);
    setEditingCandidate({
      name: candidate.name,
      description: candidate.description ?? "",
      imagePath: candidate.imagePath ?? "",
    });
    setMessage({ type: "idle", text: "" });
  }

  function moveCandidate(candidateId: string, direction: -1 | 1) {
    setOrderedCandidates((current) => {
      const index = current.findIndex((candidate) => candidate.id === candidateId);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next.map((candidate, orderIndex) => ({
        ...candidate,
        displayOrder: orderIndex + 1,
      }));
    });
    setMessage({ type: "idle", text: "" });
  }

  return (
    <div className={styles.managerStack}>
      {!isEditable && (
        <p className={styles.noticeText}>
          投票受付開始後は候補者の追加・編集・並び替えはできません。
        </p>
      )}

      <div className={styles.inlineForm}>
        <label className={styles.field}>
          <span>候補者名</span>
          <input
            disabled={!isEditable || isLoading}
            onChange={(event) =>
              setNewCandidate((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
            placeholder="例: 山田 太郎"
            value={newCandidate.name}
          />
        </label>
        <label className={styles.field}>
          <span>紹介文</span>
          <input
            disabled={!isEditable || isLoading}
            onChange={(event) =>
              setNewCandidate((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            placeholder="候補者の紹介文"
            value={newCandidate.description}
          />
        </label>
        <label className={styles.field}>
          <span>画像URL</span>
          <input
            disabled={!isEditable || isLoading}
            onChange={(event) =>
              setNewCandidate((current) => ({
                ...current,
                imagePath: event.target.value,
              }))
            }
            placeholder="https://example.com/photo.jpg"
            value={newCandidate.imagePath}
          />
        </label>
        <button
          className={styles.primaryButton}
          disabled={!isEditable || isLoading || !newCandidate.name.trim()}
          onClick={addCandidate}
          type="button"
        >
          候補者を追加
        </button>
      </div>

      <div className={styles.bulkForm}>
        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span>候補者を一括登録</span>
          <textarea
            disabled={!isEditable || isLoading}
            onChange={(event) => setBulkText(event.target.value)}
            placeholder={
              "山田 太郎,チームを支えた推進力,https://example.com/yamada.jpg\n佐藤 花子,改善提案で成果に貢献,https://example.com/sato.jpg"
            }
            value={bulkText}
          />
        </label>
        <div className={styles.resultActions}>
          <button
            className={styles.button}
            disabled={!isEditable || isLoading || bulkCandidates.length === 0}
            onClick={addBulkCandidates}
            type="button"
          >
            {bulkCandidates.length > 0
              ? `${bulkCandidates.length}名を一括登録`
              : "一括登録"}
          </button>
          <span className={styles.small}>
            1行につき「候補者名,説明文,画像URL」の形式です。画像URLは省略できます。
          </span>
        </div>
      </div>

      <div className={styles.inlineActions}>
        <button
          className={styles.button}
          disabled={!isEditable || isLoading || !hasOrderChanged}
          onClick={saveOrder}
          type="button"
        >
          並び順を保存
        </button>
        {hasOrderChanged && (
          <span className={styles.small}>
            保存すると投票画面の表示順に反映されます。
          </span>
        )}
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

      <div className={styles.candidateList}>
        {orderedCandidates.map((candidate, index) => {
          const isEditing = editingId === candidate.id;
          return (
            <div className={styles.candidateRow} key={candidate.id}>
              <span className={styles.avatar}>
                {candidate.imagePath ? (
                  <img alt="" src={candidate.imagePath} />
                ) : (
                  candidate.displayOrder
                )}
              </span>
              {isEditing ? (
                <div className={styles.editFields}>
                  <input
                    disabled={isLoading}
                    onChange={(event) =>
                      setEditingCandidate((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="候補者名"
                    value={editingCandidate.name}
                  />
                  <input
                    disabled={isLoading}
                    onChange={(event) =>
                      setEditingCandidate((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="紹介文"
                    value={editingCandidate.description}
                  />
                  <input
                    disabled={isLoading}
                    onChange={(event) =>
                      setEditingCandidate((current) => ({
                        ...current,
                        imagePath: event.target.value,
                      }))
                    }
                    placeholder="画像URL"
                    value={editingCandidate.imagePath}
                  />
                </div>
              ) : (
                <div className={styles.candidateInfo}>
                  <strong className={styles.candidateName}>
                    {candidate.name}
                  </strong>
                  <span className={styles.candidateDesc}>
                    {candidate.description}
                  </span>
                  {candidate.imagePath && (
                    <span className={styles.meta}>画像URL登録済み</span>
                  )}
                </div>
              )}
              <div className={styles.orderButtons}>
                <button
                  className={styles.compactButton}
                  disabled={!isEditable || isLoading || index === 0}
                  onClick={() => moveCandidate(candidate.id, -1)}
                  title="上へ移動"
                  type="button"
                >
                  ↑
                </button>
                <button
                  className={styles.compactButton}
                  disabled={
                    !isEditable ||
                    isLoading ||
                    index === orderedCandidates.length - 1
                  }
                  onClick={() => moveCandidate(candidate.id, 1)}
                  title="下へ移動"
                  type="button"
                >
                  ↓
                </button>
              </div>
              {isEditing ? (
                <div className={styles.resultActions}>
                  <button
                    className={styles.primaryButton}
                    disabled={isLoading || !editingCandidate.name.trim()}
                    onClick={() => saveCandidate(candidate.id)}
                    type="button"
                  >
                    保存
                  </button>
                  <button
                    className={styles.ghostButton}
                    disabled={isLoading}
                    onClick={() => setEditingId(null)}
                    type="button"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <div className={styles.resultActions}>
                  <button
                    className={styles.ghostButton}
                    disabled={!isEditable || isLoading}
                    onClick={() => startEdit(candidate)}
                    type="button"
                  >
                    編集
                  </button>
                  <button
                    className={styles.dangerButton}
                    disabled={!isEditable || isLoading}
                    onClick={() => deleteCandidate(candidate)}
                    type="button"
                  >
                    削除
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
