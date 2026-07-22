import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import styles from "../admin.module.css";
import { AdminLoginForm } from "../AdminLoginForm";
import { CandidateManager } from "../CandidateManager";
import { EventSettingsForm } from "../EventSettingsForm";
import { TieBreakManager } from "../TieBreakManager";
import {
  EventDangerActions,
  EventStatusActions,
  PresentationControls,
} from "../AdminEventActions";
import {
  QrInvitePanel,
  RankingConfirmButton,
  VoteValidityButton,
} from "../AdminUtilityActions";
import { adminSessionCookie, verifyAdminSession } from "@/lib/admin-auth";
import { getBundle, rankCandidates } from "@/lib/data-store";
import type { RankedCandidate } from "@/lib/types";

const statusLabels = {
  draft: "準備中",
  voting: "投票受付中",
  closed: "投票締切",
  presenting: "結果発表中",
  finished: "終了",
};

export default async function AdminEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
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

  const bundle = await getBundle(eventId).catch(() => null);
  if (!bundle) {
    redirect("/admin");
  }

  const results = rankCandidates(bundle);
  const positiveResults = results.filter((candidate) => candidate.votes > 0);
  const zeroVoteResults = results.filter((candidate) => candidate.votes === 0);
  const maxVotes = Math.max(1, ...positiveResults.map((candidate) => candidate.votes));
  const validVotes = bundle.votes.filter((vote) => vote.isValid);
  const invalidVotes = bundle.votes.filter((vote) => !vote.isValid);
  const candidatesById = new Map(
    bundle.candidates.map((candidate) => [candidate.id, candidate]),
  );
  const currentRank =
    bundle.event.presentationState.currentRank ??
    bundle.event.presentationCount;
  const tiedGroups = buildTiedGroups(results);

  return (
    <main className={styles.adminRoot}>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <div className={styles.brand}>
            <div className={styles.brandMark}>MV</div>
            <div className={styles.brandText}>
              <strong>{bundle.event.name}</strong>
              <span className={styles.muted}>イベントID: {bundle.event.id}</span>
            </div>
          </div>
          <div className={styles.topActions}>
            <Link className={styles.ghostButton} href="/admin">
              一覧へ戻る
            </Link>
            <Link
              className={styles.screenLinkButton}
              href={`/presentation/${eventId}`}
              rel="noreferrer"
              target="_blank"
            >
              発表画面を開く →
            </Link>
          </div>
        </header>

        <section className={styles.detailHero}>
          <div>
            <p className={styles.eyebrow}>Event Detail</p>
            <h1>{statusLabels[bundle.event.status]}</h1>
            <p>{bundle.event.description}</p>
          </div>
          <div className={styles.statusRow}>
            <Link
              className={styles.screenLinkButton}
              href={`/vote/${eventId}`}
              rel="noreferrer"
              target="_blank"
            >
              投票画面を開く →
            </Link>
            <QrInvitePanel eventId={eventId} />
            <EventStatusActions
              eventId={eventId}
              status={bundle.event.status}
            />
          </div>
        </section>

        <section className={styles.metrics}>
          <Metric label="候補者" value={String(bundle.candidates.length)} note="最大50名" />
          <Metric label="有効投票" value={String(validVotes.length)} note={`無効 ${invalidVotes.length}`} />
          <Metric label="投票人数" value={`${bundle.event.voteSelectionCount}名`} note="1人が選べるMVP数" />
          <Metric label="発表対象" value={`${bundle.event.presentationCount}名`} note="下位から順に発表" />
        </section>

        <div className={styles.detailLayout}>
          <nav className={styles.sideNav} aria-label="管理メニュー">
            <a href="#settings">イベント設定</a>
            <a href="#candidates">候補者管理</a>
            <a href="#votes">投票一覧</a>
            <a href="#results">集計結果</a>
            <a href="#presentation">発表操作</a>
            <a href="#danger">リセット/削除</a>
          </nav>

          <div className={styles.contentGrid}>
            <section className={styles.panel} id="settings">
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.eyebrow}>Settings</p>
                  <h2>イベント設定</h2>
                </div>
              </div>
              <EventSettingsForm
                candidateCount={bundle.candidates.length}
                event={bundle.event}
                eventId={eventId}
              />
            </section>

            <section className={styles.panel} id="candidates">
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.eyebrow}>Candidates</p>
                  <h2>候補者管理</h2>
                </div>
              </div>
              <CandidateManager
                candidates={bundle.candidates}
                eventId={eventId}
                status={bundle.event.status}
              />
            </section>

            <section className={styles.panel} id="votes">
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.eyebrow}>Votes</p>
                  <h2>投票一覧</h2>
                </div>
                <a
                  className={styles.button}
                  href={`/api/events/${eventId}/csv?type=votes`}
                >
                  CSV出力
                </a>
              </div>
              <div className={styles.voteList}>
                {bundle.votes.length === 0 && (
                  <div className={styles.emptyState}>まだ投票はありません。</div>
                )}
                {bundle.votes.map((vote, index) => {
                  const votedCandidates = vote.candidateIds
                    .map((candidateId) => candidatesById.get(candidateId)?.name)
                    .filter((name): name is string => Boolean(name));

                  return (
                    <div className={styles.voteHistoryRow} key={vote.id}>
                      <span className={styles.voteIndex}>#{index + 1}</span>
                      <div className={styles.voteHistoryMain}>
                        <div className={styles.voteHistoryHeader}>
                          <strong>{vote.nickname}</strong>
                          <span
                            className={
                              vote.isValid ? styles.statusOpen : styles.statusClosed
                            }
                          >
                            {vote.isValid ? "有効" : "無効"}
                          </span>
                        </div>
                        <div className={styles.voteHistoryTargets}>
                          {votedCandidates.length > 0 ? (
                            votedCandidates.map((name) => (
                              <span key={name}>{name}</span>
                            ))
                          ) : (
                            <span>候補者不明</span>
                          )}
                        </div>
                        <span className={styles.meta}>
                          投票日時: {new Date(vote.updatedAt).toLocaleString("ja-JP")}
                        </span>
                      </div>
                      <VoteValidityButton eventId={eventId} vote={vote} />
                    </div>
                  );
                })}
              </div>
            </section>

            <section className={styles.panel} id="results">
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.eyebrow}>Results</p>
                  <h2>集計結果</h2>
                  {bundle.event.rankingConfirmed && (
                    <p className={styles.successText}>順位確定済みです。</p>
                  )}
                  {tiedGroups.length > 0 && !bundle.event.rankingConfirmed && (
                    <p className={styles.noticeText}>
                      同票があります。順位確定前に同票グループの順番を決めてください。
                    </p>
                  )}
                </div>
                <div className={styles.resultActions}>
                  <a
                    className={styles.button}
                    href={`/api/events/${eventId}/csv?type=results`}
                  >
                    集計CSV
                  </a>
                  <RankingConfirmButton
                    disabled={bundle.event.status !== "closed"}
                    eventId={eventId}
                  />
                </div>
              </div>
              <div className={styles.voteList}>
                {positiveResults.map((candidate) => (
                  <div className={styles.voteRow} key={candidate.id}>
                    <span className={styles.rankMark}>{candidate.rank}</span>
                    <div>
                      <strong>{candidate.name}</strong>
                      <div className={styles.barTrack}>
                        <span
                          className={styles.barFill}
                          style={{
                            width: `${Math.round(
                              (candidate.votes / maxVotes) * 100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                    <strong className={styles.voteNumber}>
                      {candidate.votes}票
                    </strong>
                  </div>
                ))}
                {zeroVoteResults.length > 0 && (
                  <div className={styles.zeroVoteSummary}>
                    <div>
                      <strong>0票の候補者 {zeroVoteResults.length}名</strong>
                      <p className={styles.meta}>
                        {zeroVoteResults.map((candidate) => candidate.name).join("、")}
                      </p>
                    </div>
                    <span className={styles.statusDraft}>まとめて表示</span>
                  </div>
                )}
              </div>
              {tiedGroups.length > 0 && (
                <div className={styles.tieBreakStack}>
                  {tiedGroups.map(([voteCount, candidates]) => (
                    <TieBreakManager
                      candidates={candidates}
                      disabled={
                        bundle.event.status !== "closed" ||
                        bundle.event.rankingConfirmed
                      }
                      eventId={eventId}
                      key={voteCount}
                      voteCount={voteCount}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className={styles.panel} id="presentation">
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.eyebrow}>Presentation</p>
                  <h2>発表操作</h2>
                </div>
                <Link
                  className={styles.screenLinkButton}
                  href={`/presentation/${eventId}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  スクリーン表示 →
                </Link>
              </div>
              <PresentationControls
                currentRank={currentRank}
                eventId={eventId}
                phase={bundle.event.presentationState.phase}
                presentationCount={bundle.event.presentationCount}
              />
            </section>

            <section className={styles.panel} id="danger">
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.eyebrow}>Danger Zone</p>
                  <h2>イベント整理</h2>
                </div>
              </div>
              <EventDangerActions eventId={eventId} />
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function buildTiedGroups(results: RankedCandidate[]) {
  return Array.from(
    results.reduce((map, candidate) => {
      if (candidate.votes <= 0) return map;
      const group = map.get(candidate.votes) ?? [];
      group.push(candidate);
      map.set(candidate.votes, group);
      return map;
    }, new Map<number, RankedCandidate[]>()),
  )
    .filter(([, candidates]) => candidates.length > 1)
    .sort(([a], [b]) => b - a);
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
