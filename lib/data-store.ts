import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type {
  Candidate,
  EventStatus,
  PresentationPhase,
  RankedCandidate,
  TieBreak,
  Vote,
  VoteEvent,
} from "./types";

type EventBundle = {
  event: VoteEvent;
  candidates: Candidate[];
  votes: Vote[];
  tieBreaks: TieBreak[];
};

const dataRoot = path.join(process.cwd(), "data", "events");
const maxCandidates = 50;

const defaultPresentationSettings = {
  showVotes: true,
  showImage: true,
  showDescription: true,
  showAllResults: true,
  showVotesInAllResults: true,
};

const sampleCandidates = [
  ["青山 玲奈", "チーム全体を前に進めた推進力"],
  ["佐藤 光", "困難な案件を安定して完遂"],
  ["中村 蒼", "周囲を巻き込む改善提案"],
  ["伊藤 真央", "丁寧なサポートで参加者を支援"],
  ["田中 悠", "新しい挑戦を形にした行動力"],
  ["山本 結衣", "周囲が動きやすい環境づくり"],
] as const;

export function hashPassword(password: string) {
  return createHash("sha256").update(`mvp-vote:${password}`).digest("hex");
}

export function verifyPassword(password: string, hash: string) {
  return hashPassword(password) === hash;
}

export function publicEvent(event: VoteEvent) {
  const { passwordHash: _passwordHash, ...safeEvent } = event;
  return safeEvent;
}

export async function ensureSeedData() {
  await mkdir(dataRoot, { recursive: true });
  const eventId = "demo-2026-mvp";
  const eventDir = eventPath(eventId);

  try {
    const bundle = await getBundleFiles(eventId);
    if (
      bundle.event.name !== "2026 MVP投票" ||
      bundle.candidates.some(
        (candidate, index) => candidate.name !== sampleCandidates[index]?.[0],
      )
    ) {
      await writeBundle(eventId, normalizeDemoBundle(bundle));
    }
    return;
  } catch {
    const now = new Date().toISOString();
    const event: VoteEvent = {
      id: eventId,
      name: "2026 MVP投票",
      description: "会場参加者がスマートフォンからMVP候補者へ投票します。",
      passwordHash: hashPassword("mvp2026"),
      status: "voting",
      presentationCount: 3,
      voteSelectionCount: 1,
      presentationSettings: defaultPresentationSettings,
      rankingConfirmed: false,
      presentationState: { phase: "waiting" },
      createdAt: now,
      updatedAt: now,
    };
    const candidates = sampleCandidates.map(([name, description], index) => ({
      id: slugId(name, index),
      eventId,
      name,
      description,
      displayOrder: index + 1,
      createdAt: now,
      updatedAt: now,
    }));
    const votes: Vote[] = [
      createVote(eventId, "browser-a", "あき", [candidates[0].id], now),
      createVote(eventId, "browser-b", "みな", [candidates[0].id], now),
      createVote(eventId, "browser-c", "けん", [candidates[0].id], now),
      createVote(eventId, "browser-d", "はる", [candidates[1].id], now),
      createVote(eventId, "browser-e", "りお", [candidates[1].id], now),
      createVote(eventId, "browser-f", "そら", [candidates[2].id], now),
      createVote(eventId, "browser-g", "まい", [candidates[2].id], now),
      createVote(eventId, "browser-h", "ゆう", [candidates[3].id], now),
    ];

    await writeBundle(eventId, { event, candidates, votes, tieBreaks: [] });
  }
}

export async function listEvents() {
  await ensureSeedData();
  const entries = await readdir(dataRoot, { withFileTypes: true });
  const eventReads = await Promise.allSettled(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) =>
        readJson<VoteEvent>(path.join(dataRoot, entry.name, "event.json")),
      ),
  );
  const events = eventReads
    .filter(
      (result): result is PromiseFulfilledResult<VoteEvent> =>
        result.status === "fulfilled",
    )
    .map((result) => result.value);
  return events.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createEvent(input: {
  name: string;
  description?: string;
  password: string;
  presentationCount?: number;
  voteSelectionCount?: number;
}) {
  await ensureSeedData();
  const now = new Date().toISOString();
  const eventId = randomUUID();
  const event: VoteEvent = {
    id: eventId,
    name: input.name.trim(),
    description: input.description?.trim(),
    passwordHash: hashPassword(input.password),
    status: "draft",
    presentationCount: clamp(input.presentationCount ?? 3, 1, 10),
    voteSelectionCount: clamp(input.voteSelectionCount ?? 1, 1, 10),
    presentationSettings: defaultPresentationSettings,
    rankingConfirmed: false,
    presentationState: { phase: "waiting" },
    createdAt: now,
    updatedAt: now,
  };

  await writeBundle(eventId, {
    event,
    candidates: [],
    votes: [],
    tieBreaks: [],
  });

  return event;
}

export async function getBundle(eventId: string): Promise<EventBundle> {
  await ensureSeedData();
  return getBundleFiles(eventId);
}

async function getBundleFiles(eventId: string): Promise<EventBundle> {
  const eventDir = eventPath(eventId);
  const [event, candidates, votes, tieBreaks] = await Promise.all([
    readJson<VoteEvent>(path.join(eventDir, "event.json")),
    readJson<Candidate[]>(path.join(eventDir, "candidates.json")),
    readJson<Vote[]>(path.join(eventDir, "votes.json")),
    readJson<TieBreak[]>(path.join(eventDir, "tie-breaks.json")),
  ]);

  return normalizeBundle({ event, candidates, votes, tieBreaks });
}

function normalizeBundle(bundle: EventBundle): EventBundle {
  const candidates = bundle.candidates.map((candidate) => ({
    ...candidate,
    imagePath: candidate.imagePath ?? "",
  }));
  return {
    ...bundle,
    event: {
      ...bundle.event,
      voteSelectionCount: bundle.event.voteSelectionCount ?? 1,
    },
    candidates,
    votes: bundle.votes.map((vote) => {
      const candidateIds = validCandidateIds(voteCandidateIds(vote), candidates);
      return {
        ...vote,
        candidateId: candidateIds[0],
        candidateIds,
      };
    }),
  };
}

function normalizeDemoBundle(bundle: EventBundle): EventBundle {
  const now = new Date().toISOString();
  const candidates = sampleCandidates.map(([name, description], index) => {
    const existing = bundle.candidates[index];
    return {
      id: existing?.id ?? slugId(name, index),
      eventId: "demo-2026-mvp",
      name,
      description,
      displayOrder: index + 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
  });
  const nicknameByBrowser = new Map([
    ["browser-a", "あき"],
    ["browser-b", "みな"],
    ["browser-c", "けん"],
    ["browser-d", "はる"],
    ["browser-e", "りお"],
    ["browser-f", "そら"],
    ["browser-g", "まい"],
    ["browser-h", "ゆう"],
  ]);

  return {
    event: {
      ...bundle.event,
      id: "demo-2026-mvp",
      name: "2026 MVP投票",
      description: "会場参加者がスマートフォンからMVP候補者へ投票します。",
      voteSelectionCount: bundle.event.voteSelectionCount ?? 1,
      updatedAt: now,
    },
    candidates,
    votes: bundle.votes.map((vote) => ({
      ...vote,
      eventId: "demo-2026-mvp",
      nickname: nicknameByBrowser.get(vote.browserId) ?? vote.nickname,
      candidateId: firstValidCandidateId(voteCandidateIds(vote), candidates) ?? candidates[0].id,
      candidateIds: validCandidateIds(voteCandidateIds(vote), candidates),
    })),
    tieBreaks: bundle.tieBreaks,
  };
}

export async function updateEvent(
  eventId: string,
  input: Partial<
    Pick<
      VoteEvent,
      | "name"
      | "description"
      | "presentationCount"
      | "voteSelectionCount"
      | "presentationSettings"
    >
  > & { password?: string },
) {
  const bundle = await getBundle(eventId);
  const { password, ...eventInput } = input;
  bundle.event = {
    ...bundle.event,
    ...eventInput,
    passwordHash: password?.trim()
      ? hashPassword(password)
      : bundle.event.passwordHash,
    presentationCount: input.presentationCount
      ? clamp(input.presentationCount, 1, bundle.candidates.length || 10)
      : bundle.event.presentationCount,
    voteSelectionCount: input.voteSelectionCount
      ? clamp(input.voteSelectionCount, 1, bundle.candidates.length || 10)
      : bundle.event.voteSelectionCount ?? 1,
    updatedAt: new Date().toISOString(),
  };
  await writeBundle(eventId, bundle);
  return bundle.event;
}

export async function resetEvent(eventId: string) {
  const bundle = await getBundle(eventId);
  const now = new Date().toISOString();

  bundle.event = {
    ...bundle.event,
    status: "draft",
    rankingConfirmed: false,
    rankingConfirmedAt: undefined,
    presentationState: { phase: "waiting" },
    updatedAt: now,
  };
  bundle.votes = [];
  bundle.tieBreaks = [];

  await writeBundle(eventId, bundle);
  return bundle.event;
}

export async function initializeEvent(eventId: string) {
  const bundle = await getBundle(eventId);
  const now = new Date().toISOString();

  bundle.event = {
    ...bundle.event,
    status: "draft",
    presentationCount: 1,
    voteSelectionCount: 1,
    rankingConfirmed: false,
    rankingConfirmedAt: undefined,
    presentationState: { phase: "waiting" },
    updatedAt: now,
  };
  bundle.candidates = [];
  bundle.votes = [];
  bundle.tieBreaks = [];

  await writeBundle(eventId, bundle);
  return bundle.event;
}

export async function deleteEvent(eventId: string) {
  await ensureSeedData();
  await rm(eventPath(eventId), { recursive: true, force: false });
}

export async function setEventStatus(eventId: string, status: EventStatus) {
  const bundle = await getBundle(eventId);

  if (status === "voting" && bundle.candidates.length < 6) {
    throw new Error("候補者が6名未満のため投票を開始できません。");
  }

  bundle.event = {
    ...bundle.event,
    status,
    updatedAt: new Date().toISOString(),
  };
  await writeBundle(eventId, bundle);
  return bundle.event;
}

export async function addCandidate(
  eventId: string,
  input: { name: string; description?: string; imagePath?: string },
) {
  const bundle = await getBundle(eventId);
  if (bundle.event.status !== "draft") {
    throw new Error("投票受付開始後は候補者を追加できません。");
  }
  if (bundle.candidates.length >= maxCandidates) {
    throw new Error(`候補者は最大${maxCandidates}名です。`);
  }

  const now = new Date().toISOString();
  const candidate: Candidate = {
    id: randomUUID(),
    eventId,
    name: input.name.trim(),
    description: input.description?.trim(),
    imagePath: input.imagePath?.trim() ?? "",
    displayOrder: bundle.candidates.length + 1,
    createdAt: now,
    updatedAt: now,
  };
  bundle.candidates.push(candidate);
  bundle.event.updatedAt = now;
  await writeBundle(eventId, bundle);
  return candidate;
}

export async function addCandidates(
  eventId: string,
  inputs: Array<{ name: string; description?: string; imagePath?: string }>,
) {
  const bundle = await getBundle(eventId);
  if (bundle.event.status !== "draft") {
    throw new Error("投票受付開始後は候補者を追加できません。");
  }

  const normalized = inputs
    .map((input) => ({
      name: input.name.trim(),
      description: input.description?.trim(),
      imagePath: input.imagePath?.trim() ?? "",
    }))
    .filter((input) => input.name);

  if (normalized.length === 0) {
    throw new Error("候補者名を入力してください。");
  }
  if (bundle.candidates.length + normalized.length > maxCandidates) {
    throw new Error(`候補者は最大${maxCandidates}名です。`);
  }

  const now = new Date().toISOString();
  const candidates = normalized.map((input, index): Candidate => ({
    id: randomUUID(),
    eventId,
    name: input.name,
    description: input.description,
    imagePath: input.imagePath,
    displayOrder: bundle.candidates.length + index + 1,
    createdAt: now,
    updatedAt: now,
  }));

  bundle.candidates.push(...candidates);
  bundle.event.updatedAt = now;
  await writeBundle(eventId, bundle);
  return candidates;
}

export async function updateCandidate(
  eventId: string,
  candidateId: string,
  input: { name?: string; description?: string; imagePath?: string },
) {
  const bundle = await getBundle(eventId);
  if (bundle.event.status !== "draft") {
    throw new Error("投票受付開始後は候補者を編集できません。");
  }

  const candidate = bundle.candidates.find((item) => item.id === candidateId);
  if (!candidate) {
    throw new Error("候補者が存在しません。");
  }

  if (typeof input.name === "string") {
    const name = input.name.trim();
    if (!name) {
      throw new Error("候補者名を入力してください。");
    }
    candidate.name = name;
  }
  if (typeof input.description === "string") {
    candidate.description = input.description.trim();
  }
  if (typeof input.imagePath === "string") {
    candidate.imagePath = input.imagePath.trim();
  }

  const now = new Date().toISOString();
  candidate.updatedAt = now;
  bundle.event.updatedAt = now;
  await writeBundle(eventId, bundle);
  return candidate;
}

export async function deleteCandidate(eventId: string, candidateId: string) {
  const bundle = await getBundle(eventId);
  if (bundle.event.status !== "draft") {
    throw new Error("投票受付開始後は候補者を削除できません。");
  }

  const deleteIndex = bundle.candidates.findIndex(
    (candidate) => candidate.id === candidateId,
  );
  if (deleteIndex < 0) {
    throw new Error("候補者が存在しません。");
  }

  const now = new Date().toISOString();
  bundle.candidates = bundle.candidates
    .filter((candidate) => candidate.id !== candidateId)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((candidate, index) => ({
      ...candidate,
      displayOrder: index + 1,
      updatedAt: now,
    }));
  bundle.event.presentationCount = clamp(
    bundle.event.presentationCount,
    1,
    bundle.candidates.length || 1,
  );
  bundle.event.voteSelectionCount = clamp(
    bundle.event.voteSelectionCount ?? 1,
    1,
    bundle.candidates.length || 1,
  );
  bundle.event.updatedAt = now;

  await writeBundle(eventId, bundle);
  return bundle.candidates;
}

export async function reorderCandidates(eventId: string, orderedIds: string[]) {
  const bundle = await getBundle(eventId);
  if (bundle.event.status !== "draft") {
    throw new Error("投票受付開始後は並び替えできません。");
  }
  const order = new Map(orderedIds.map((id, index) => [id, index + 1]));
  bundle.candidates = bundle.candidates
    .map((candidate) => ({
      ...candidate,
      displayOrder: order.get(candidate.id) ?? candidate.displayOrder,
      updatedAt: new Date().toISOString(),
    }))
    .sort((a, b) => a.displayOrder - b.displayOrder);
  bundle.event.updatedAt = new Date().toISOString();
  await writeBundle(eventId, bundle);
  return bundle.candidates;
}

export async function castVote(
  eventId: string,
  input: {
    password: string;
    browserId: string;
    nickname: string;
    candidateIds: string[];
  },
) {
  const bundle = await getBundle(eventId);
  if (bundle.event.status !== "voting") {
    throw new Error("現在は投票を受け付けていません。");
  }
  if (!verifyPassword(input.password, bundle.event.passwordHash)) {
    throw new Error("イベント参加パスワードが異なります。");
  }
  const candidateIds = [...new Set(input.candidateIds)];
  const selectionCount = bundle.event.voteSelectionCount ?? 1;
  if (candidateIds.length !== selectionCount) {
    throw new Error(`MVP候補者を${selectionCount}名選択してください。`);
  }
  if (
    candidateIds.some(
      (candidateId) =>
        !bundle.candidates.some((candidate) => candidate.id === candidateId),
    )
  ) {
    throw new Error("候補者が存在しません。");
  }

  const nickname = input.nickname.trim();
  if (!nickname) {
    throw new Error("ニックネームを入力してください。");
  }

  const now = new Date().toISOString();
  const existing = bundle.votes.find(
    (vote) =>
      vote.browserId === input.browserId &&
      vote.nickname === nickname &&
      vote.eventId === eventId,
  );

  if (existing) {
    existing.candidateId = candidateIds[0];
    existing.candidateIds = candidateIds;
    existing.isValid = true;
    existing.invalidatedAt = undefined;
    existing.updatedAt = now;
    await writeBundle(eventId, bundle);
    return existing;
  }

  const vote = createVote(
    eventId,
    input.browserId,
    nickname,
    candidateIds,
    now,
  );
  bundle.votes.push(vote);
  await writeBundle(eventId, bundle);
  return vote;
}

export async function setVoteValidity(
  eventId: string,
  voteId: string,
  isValid: boolean,
) {
  const bundle = await getBundle(eventId);
  const vote = bundle.votes.find((item) => item.id === voteId);
  if (!vote) {
    throw new Error("投票が存在しません。");
  }
  const now = new Date().toISOString();
  vote.isValid = isValid;
  vote.invalidatedAt = isValid ? undefined : now;
  vote.updatedAt = now;
  await writeBundle(eventId, bundle);
  return vote;
}

export async function setPresentationState(
  eventId: string,
  phase: PresentationPhase,
  currentRank?: number,
) {
  const bundle = await getBundle(eventId);
  bundle.event.presentationState = { phase, currentRank };
  bundle.event.status = phase === "finished" ? "finished" : "presenting";
  bundle.event.updatedAt = new Date().toISOString();
  await writeBundle(eventId, bundle);
  return bundle.event.presentationState;
}

export async function confirmRanking(eventId: string) {
  const bundle = await getBundle(eventId);
  if (bundle.event.status !== "closed") {
    throw new Error("投票締切後に順位を確定してください。");
  }
  const now = new Date().toISOString();
  bundle.event.rankingConfirmed = true;
  bundle.event.rankingConfirmedAt = now;
  bundle.event.updatedAt = now;
  await writeBundle(eventId, bundle);
  return bundle.event;
}

export async function saveTieBreak(
  eventId: string,
  voteCount: number,
  orderedCandidateIds: string[],
) {
  const bundle = await getBundle(eventId);
  if (bundle.event.status !== "closed") {
    throw new Error("投票締切後に同票順位を決定してください。");
  }
  if (!Number.isInteger(voteCount) || voteCount <= 0) {
    throw new Error("同票グループの票数が不正です。");
  }

  const validVotes = bundle.votes.filter((vote) => vote.isValid);
  const counts = new Map<string, number>();
  validVotes.forEach((vote) => {
    voteCandidateIds(vote).forEach((candidateId) =>
      counts.set(candidateId, (counts.get(candidateId) ?? 0) + 1),
    );
  });
  const tiedCandidateIds = bundle.candidates
    .filter((candidate) => (counts.get(candidate.id) ?? 0) === voteCount)
    .map((candidate) => candidate.id);

  if (tiedCandidateIds.length < 2) {
    throw new Error("指定された票数に同票グループがありません。");
  }

  const expectedIds = new Set(tiedCandidateIds);
  const orderedIds = [...new Set(orderedCandidateIds)];
  const hasSameMembers =
    orderedIds.length === expectedIds.size &&
    orderedIds.every((candidateId) => expectedIds.has(candidateId));

  if (!hasSameMembers) {
    throw new Error("同票グループ内の候補者をすべて並べてください。");
  }

  const now = new Date().toISOString();
  bundle.tieBreaks = [
    ...bundle.tieBreaks.filter((tieBreak) => tieBreak.voteCount !== voteCount),
    {
      eventId,
      voteCount,
      orderedCandidateIds: orderedIds,
      confirmedAt: now,
    },
  ].sort((a, b) => b.voteCount - a.voteCount);
  bundle.event.rankingConfirmed = false;
  bundle.event.rankingConfirmedAt = undefined;
  bundle.event.updatedAt = now;

  await writeBundle(eventId, bundle);
  return bundle.tieBreaks;
}

export async function getResults(eventId: string) {
  const bundle = await getBundle(eventId);
  return rankCandidates(bundle);
}

export function rankCandidates(bundle: EventBundle): RankedCandidate[] {
  const validVotes = bundle.votes.filter((vote) => vote.isValid);
  const counts = new Map<string, number>();
  validVotes.forEach((vote) => {
    voteCandidateIds(vote).forEach((candidateId) =>
      counts.set(candidateId, (counts.get(candidateId) ?? 0) + 1),
    );
  });

  const tieOrders = new Map<string, number>();
  bundle.tieBreaks.forEach((tieBreak) => {
    tieBreak.orderedCandidateIds.forEach((id, index) => {
      tieOrders.set(`${tieBreak.voteCount}:${id}`, index);
    });
  });

  const sorted = [...bundle.candidates].sort((a, b) => {
    const voteDiff = (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0);
    if (voteDiff !== 0) return voteDiff;
    const aTie = tieOrders.get(`${counts.get(a.id) ?? 0}:${a.id}`) ?? 999;
    const bTie = tieOrders.get(`${counts.get(b.id) ?? 0}:${b.id}`) ?? 999;
    if (aTie !== bTie) return aTie - bTie;
    return a.displayOrder - b.displayOrder;
  });

  return sorted.map((candidate, index) => ({
    ...candidate,
    rank: index + 1,
    votes: counts.get(candidate.id) ?? 0,
    isPresentationTarget: index < bundle.event.presentationCount,
  }));
}

function eventPath(eventId: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(eventId)) {
    throw new Error("イベントIDが不正です。");
  }
  return path.join(dataRoot, eventId);
}

async function writeBundle(eventId: string, bundle: EventBundle) {
  const eventDir = eventPath(eventId);
  await mkdir(path.join(eventDir, "backups"), { recursive: true });
  await Promise.all([
    writeJson(path.join(eventDir, "event.json"), bundle.event),
    writeJson(path.join(eventDir, "candidates.json"), bundle.candidates),
    writeJson(path.join(eventDir, "votes.json"), bundle.votes),
    writeJson(path.join(eventDir, "tie-breaks.json"), bundle.tieBreaks),
  ]);
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function writeJson(filePath: string, value: unknown) {
  const tmpPath = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmpPath, filePath);
}

function createVote(
  eventId: string,
  browserId: string,
  nickname: string,
  candidateIds: string[],
  now: string,
): Vote {
  return {
    id: randomUUID(),
    eventId,
    browserId,
    nickname,
    candidateId: candidateIds[0],
    candidateIds,
    isValid: true,
    votedAt: now,
    updatedAt: now,
  };
}

function voteCandidateIds(vote: Vote) {
  return vote.candidateIds?.length ? vote.candidateIds : vote.candidateId ? [vote.candidateId] : [];
}

function validCandidateIds(candidateIds: string[], candidates: Candidate[]) {
  const validIds = new Set(candidates.map((candidate) => candidate.id));
  return [...new Set(candidateIds)].filter((candidateId) =>
    validIds.has(candidateId),
  );
}

function firstValidCandidateId(candidateIds: string[], candidates: Candidate[]) {
  return validCandidateIds(candidateIds, candidates)[0];
}

function slugId(name: string, index: number) {
  return `${index + 1}-${createHash("sha1").update(name).digest("hex").slice(0, 8)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
