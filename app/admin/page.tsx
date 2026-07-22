import Link from "next/link";
import { cookies } from "next/headers";
import styles from "./admin.module.css";
import { AdminLoginForm } from "./AdminLoginForm";
import { EventCreateForm } from "./EventCreateForm";
import { LogoutButton } from "./LogoutButton";
import { adminSessionCookie, verifyAdminSession } from "@/lib/admin-auth";
import { getBundle, listEvents } from "@/lib/data-store";

const statusLabels = {
  draft: "準備中",
  voting: "投票受付中",
  closed: "投票締切",
  presenting: "結果発表中",
  finished: "終了",
};

export default async function AdminPage() {
  const cookieStore = await cookies();
  const isLoggedIn = verifyAdminSession(
    cookieStore.get(adminSessionCookie)?.value,
  );

  if (!isLoggedIn) {
    return (
      <main className={styles.adminRoot}>
        <div className={styles.shell}>
          <header className={styles.topbar}>
            <div className={styles.brand}>
              <div className={styles.brandMark}>MV</div>
              <div className={styles.brandText}>
                <strong>MVP投票 管理画面</strong>
                <span className={styles.muted}>Password required</span>
              </div>
            </div>
          </header>
          <section className={styles.loginOnly}>
            <AdminLoginForm />
          </section>
        </div>
      </main>
    );
  }

  const events = await listEvents();
  const bundles = await Promise.all(events.map((event) => getBundle(event.id)));
  const totalCandidates = bundles.reduce(
    (sum, bundle) => sum + bundle.candidates.length,
    0,
  );
  const totalVotes = bundles.reduce((sum, bundle) => sum + bundle.votes.length, 0);
  const activeEvents = events.filter((event) => event.status === "voting").length;

  return (
    <main className={styles.adminRoot}>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <div className={styles.brand}>
            <div className={styles.brandMark}>MV</div>
            <div className={styles.brandText}>
              <strong>MVP投票 管理画面</strong>
              <span className={styles.muted}>イベント管理</span>
            </div>
          </div>
          <div className={styles.topActions}>
            <LogoutButton />
          </div>
        </header>

        <section className={styles.detailHero}>
          <div>
            <p className={styles.eyebrow}>Admin Console</p>
            <h1>イベント一覧</h1>
            <p>ログイン済みの管理者だけがイベントと投票状況を確認できます。</p>
          </div>
          <EventCreateForm />
        </section>

        <section className={styles.metrics} aria-label="全体サマリー">
          <Metric label="イベント数" value={String(events.length)} note="JSON保存済み" />
          <Metric label="候補者数" value={String(totalCandidates)} note="6名以上で受付開始" />
          <Metric label="総投票数" value={String(totalVotes)} note={`${activeEvents}件が受付中`} />
        </section>

        <section>
          <div className={styles.eventGrid}>
            {bundles.map(({ event, candidates, votes }) => {
              const validVotes = votes.filter((vote) => vote.isValid).length;
              return (
                <Link
                  className={styles.eventCard}
                  href={`/admin/${event.id}`}
                  key={event.id}
                >
                  <div className={styles.statusRow}>
                    <span className={`${styles.statusBadge} ${styles.statusOpen}`}>
                      {statusLabels[event.status]}
                    </span>
                    <span className={styles.meta}>
                      更新 {new Date(event.updatedAt).toLocaleString("ja-JP")}
                    </span>
                  </div>
                  <h3>{event.name}</h3>
                  <p>{event.description}</p>
                  <div className={styles.eventStats}>
                    <Stat label="候補者" value={String(candidates.length)} />
                    <Stat label="有効投票" value={String(validVotes)} />
                    <Stat label="発表人数" value={String(event.presentationCount)} />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className={styles.metricCard}>
      <span className={styles.statLabel}>{label}</span>
      <strong className={styles.metricValue}>{value}</strong>
      <span className={styles.meta}>{note}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.statBox}>
      <span className={styles.statLabel}>{label}</span>
      <strong className={styles.statValue}>{value}</strong>
    </div>
  );
}
