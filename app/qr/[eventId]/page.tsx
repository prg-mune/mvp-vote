"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import styles from "./page.module.css";
import type { VoteEvent } from "@/lib/types";

type EventResponse = {
  event?: Omit<VoteEvent, "passwordHash">;
  error?: string;
};

export default function QrDisplayPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId ?? "demo-2026-mvp";
  const [event, setEvent] = useState<EventResponse["event"]>();
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [message, setMessage] = useState("読み込み中...");

  const voteUrl =
    typeof window === "undefined"
      ? `/vote/${eventId}`
      : `${window.location.origin}/vote/${eventId}`;

  useEffect(() => {
    let isActive = true;

    async function load() {
      const [eventResponse, qr] = await Promise.all([
        fetch(`/api/events/${eventId}`, { cache: "no-store" }),
        QRCode.toDataURL(voteUrl, {
          margin: 2,
          width: 520,
          color: {
            dark: "#102033",
            light: "#ffffff",
          },
        }),
      ]);
      const body = (await eventResponse.json()) as EventResponse;
      if (!isActive) return;

      if (!eventResponse.ok || !body.event) {
        setMessage(body.error ?? "イベント情報を読み込めませんでした。");
        return;
      }

      setEvent(body.event);
      setQrDataUrl(qr);
      setMessage("");
    }

    void load();
    return () => {
      isActive = false;
    };
  }, [eventId, voteUrl]);

  return (
    <main className={styles.qrRoot}>
      <section className={styles.qrStage}>
        <div className={styles.heading}>
          <p>MVP Voting App</p>
          <h1>{event?.name ?? "投票参加QR"}</h1>
        </div>
        <div className={styles.qrFrame}>
          {qrDataUrl ? (
            <img alt="投票参加用QRコード" src={qrDataUrl} />
          ) : (
            <span>{message}</span>
          )}
        </div>
        <div className={styles.urlBox}>
          <span>スマートフォンで読み取って投票してください</span>
          <code>{voteUrl}</code>
        </div>
      </section>
    </main>
  );
}
