export type EventStatus =
  | "draft"
  | "voting"
  | "closed"
  | "presenting"
  | "finished";

export type PresentationPhase =
  | "waiting"
  | "teaser"
  | "revealed"
  | "all-results"
  | "finished";

export type PresentationSettings = {
  showVotes: boolean;
  showImage: boolean;
  showDescription: boolean;
  showAllResults: boolean;
  showVotesInAllResults: boolean;
};

export type VoteEvent = {
  id: string;
  name: string;
  description?: string;
  passwordHash: string;
  status: EventStatus;
  presentationCount: number;
  voteSelectionCount: number;
  presentationSettings: PresentationSettings;
  rankingConfirmed: boolean;
  presentationState: {
    phase: PresentationPhase;
    currentRank?: number;
  };
  rankingConfirmedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type Candidate = {
  id: string;
  eventId: string;
  name: string;
  imagePath?: string;
  description?: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type Vote = {
  id: string;
  eventId: string;
  browserId: string;
  nickname: string;
  candidateId?: string;
  candidateIds: string[];
  isValid: boolean;
  votedAt: string;
  updatedAt: string;
  invalidatedAt?: string;
};

export type TieBreak = {
  eventId: string;
  voteCount: number;
  orderedCandidateIds: string[];
  confirmedAt?: string;
};

export type RankedCandidate = Candidate & {
  rank: number;
  votes: number;
  isPresentationTarget: boolean;
};
