'use client';

import { useState, useCallback } from 'react';
import { Flex, Text, IconButton, Tooltip } from '@radix-ui/themes';
import { Copy, Check } from 'lucide-react';
import { formatGameId } from '@/lib/utils';
import { playSound } from '@/lib/sounds';

type TextSize = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type ResponsiveSize = TextSize | { initial?: TextSize; xs?: TextSize; sm?: TextSize; md?: TextSize; lg?: TextSize; xl?: TextSize };

interface CopyableGameIdProps {
  gameId: string;
  size?: ResponsiveSize;
  showLabel?: boolean;
  className?: string;
}

export function CopyableGameId({ gameId, size = '2', showLabel = true, className = '' }: CopyableGameIdProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(gameId);
      setCopied(true);
      playSound.success();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = gameId;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      playSound.success();
      setTimeout(() => setCopied(false), 2000);
    }
  }, [gameId]);

  return (
    <Flex align="center" gap="1" className={className}>
      {showLabel && (
        <Text size={size} color="gray">
          Game
        </Text>
      )}
      <Tooltip content={copied ? 'Copied!' : 'Copy game ID'}>
        <Flex
          align="center"
          gap="1"
          className="cursor-pointer hover:bg-slate-700/50 rounded px-1.5 py-0.5 transition-colors"
          onClick={handleCopy}
        >
          <Text size={size} className="font-mono text-cyan-400">
            {formatGameId(gameId)}
          </Text>
          <IconButton
            size="1"
            variant="ghost"
            color={copied ? 'green' : 'gray'}
            className="!p-0.5"
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
          >
            {copied ? (
              <Check className="w-3 h-3" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </IconButton>
        </Flex>
      </Tooltip>
    </Flex>
  );
}
