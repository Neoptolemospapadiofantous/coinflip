'use client';

import { Card, Flex, Heading, Text, Badge, ScrollArea } from '@radix-ui/themes';
import { useActiveGamesList, useGameStore, MAX_CONCURRENT_GAMES } from '@/store/gameStore';
import { Game } from '@/types/game';
import { Users, Loader2, Trophy, ChevronRight, Wifi } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useAccount } from 'wagmi';

interface ActiveGameCardProps {
  game: Game;
  onViewGame: (game: Game) => void;
  userAddress?: string;
}

function ActiveGameCard({ game, onViewGame, userAddress }: ActiveGameCardProps) {
  const isCreator = game.creator_address?.toLowerCase() === userAddress?.toLowerCase();
  const isWinner = game.winner_address?.toLowerCase() === userAddress?.toLowerCase();
  const userChoice = isCreator ? game.creator_choice : game.joiner_choice;

  const getStatusColor = () => {
    switch (game.status) {
      case 'pending':
        return 'yellow';
      case 'matched':
        return 'cyan';
      case 'resolved':
        return isWinner ? 'green' : 'red';
      default:
        return 'gray';
    }
  };

  const getStatusIcon = () => {
    switch (game.status) {
      case 'pending':
        return <Users className="w-3 h-3" />;
      case 'matched':
        return <Loader2 className="w-3 h-3 animate-spin" />;
      case 'resolved':
        return <Trophy className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (game.status) {
      case 'pending':
        return 'Waiting';
      case 'matched':
        return 'Flipping';
      case 'resolved':
        return isWinner ? 'Won!' : 'Lost';
      default:
        return game.status;
    }
  };

  return (
    <Card
      className={`card-simple cursor-pointer hover:border-cyan-500/50 transition-all ${
        game.status === 'resolved' && isWinner ? 'border-green-500/50' : ''
      }`}
      onClick={() => onViewGame(game)}
    >
      <Flex direction="column" gap="2" p="3">
        <Flex justify="between" align="center">
          <Text size="1" className="font-mono text-gray-500">
            #{game.id}
          </Text>
          <Badge size="1" color={getStatusColor()} variant="soft">
            <Flex align="center" gap="1">
              {getStatusIcon()}
              {getStatusText()}
            </Flex>
          </Badge>
        </Flex>

        <Flex justify="between" align="center">
          <Flex align="center" gap="2">
            <Text size="2">{userChoice ? '🪙' : '👑'}</Text>
            <Text size="2" weight="bold">
              {formatCurrency(BigInt(game.amount))}
            </Text>
          </Flex>
          <ChevronRight className="w-4 h-4 text-gray-500" />
        </Flex>

        {game.status === 'resolved' && (
          <Text size="1" className={isWinner ? 'text-green-400' : 'text-red-400'}>
            {isWinner ? `+${formatCurrency(BigInt(game.payout || 0))}` : `-${formatCurrency(BigInt(game.amount))}`}
          </Text>
        )}
      </Flex>
    </Card>
  );
}

export function ActiveGamesPanel() {
  const { address } = useAccount();
  const activeGames = useActiveGamesList();
  const { queueModal } = useGameStore();

  // Real-time updates are handled centrally by useRealtimeSync (in Providers)
  // This component just displays the games from the Zustand store

  const handleViewGame = (game: Game) => {
    if (game.status === 'matched' || game.status === 'resolved') {
      queueModal(game, game.status === 'matched' ? 'matched' : 'resolved');
    }
  };

  // Don't render if no active games
  if (activeGames.length === 0) {
    return null;
  }

  // Filter to only show pending/matched games (resolved ones auto-close)
  const visibleGames = activeGames.filter(
    (g) => g.status === 'pending' || g.status === 'matched'
  );

  if (visibleGames.length === 0) {
    return null;
  }

  return (
    <Card className="card-solid border-purple-500/30 fixed bottom-4 right-4 z-40 w-72 max-h-80">
      <Flex direction="column" gap="3" p="3">
        <Flex justify="between" align="center">
          <Heading size="3">Active Games</Heading>
          <Badge size="1" color="cyan">
            {visibleGames.length}/{MAX_CONCURRENT_GAMES}
          </Badge>
        </Flex>

        <ScrollArea style={{ maxHeight: '200px' }}>
          <Flex direction="column" gap="2">
            {visibleGames.map((game) => (
              <ActiveGameCard
                key={game.id}
                game={game}
                onViewGame={handleViewGame}
                userAddress={address}
              />
            ))}
          </Flex>
        </ScrollArea>

        <Flex align="center" justify="center" gap="2">
          <Wifi className="w-3 h-3 text-green-400" />
          <Text size="1" color="gray">
            Live updates active
          </Text>
        </Flex>
      </Flex>
    </Card>
  );
}
