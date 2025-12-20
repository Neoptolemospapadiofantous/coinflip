export enum GameStatus {
  CREATED = 'created',
  MATCHED = 'matched',
  PENDING_VRF = 'pending_vrf',
  RESOLVED = 'resolved',
  CANCELLED = 'cancelled',
}

export interface Game {
  id: string; // bigint as string
  creator: string; // address
  joiner: string | null; // address
  tier: number;
  amount: string; // in wei
  creatorChoice: boolean; // false = heads, true = tails
  joinerChoice: boolean | null;
  result: boolean | null; // VRF result
  winner: string | null; // address
  status: GameStatus;
  createdAt: Date;
  matchedAt: Date | null;
  resolvedAt: Date | null;
  txHash: string; // creation tx hash
  vrfRequestId: string | null;
}

export interface GameCreate {
  tier: number;
  choice: boolean; // false = heads, true = tails
  amount: string; // in wei
}

export interface GameJoin {
  gameId: string;
  choice: boolean;
  amount: string;
}

export interface GameResult {
  gameId: string;
  result: boolean; // coin flip result
  winner: string;
  amount: string;
}
