export interface QueueEntry {
  id: string;
  gameId: string;
  tier: number;
  playerAddress: string;
  choice: boolean;
  joinedAt: Date;
  expiresAt: Date;
}

export interface QueueMatch {
  gameId: string;
  creator: string;
  joiner: string;
  tier: number;
  amount: string;
  matchedAt: Date;
}

export interface QueueState {
  isInQueue: boolean;
  queuedTier: number | null;
  queuedGameId: string | null;
  joinedAt: Date | null;
  matchedWith: string | null;
}
