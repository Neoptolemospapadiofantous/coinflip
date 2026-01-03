'use client';

import { useEffect } from 'react';
import { Music, Music2 } from 'lucide-react';
import { Button } from '@radix-ui/themes';
import { musicManager } from '@/lib/music';
import { useUIStore, useMusicEnabled, useMusicVolume } from '@/store/uiStore';

export function MusicToggle() {
  const enabled = useMusicEnabled();
  const volume = useMusicVolume();
  const toggleMusic = useUIStore((state) => state.toggleMusic);

  // Sync musicManager with store
  useEffect(() => {
    musicManager.setEnabled(enabled);
  }, [enabled]);

  // Sync volume
  useEffect(() => {
    musicManager.setVolume(volume);
  }, [volume]);

  return (
    <Button
      variant="ghost"
      size="2"
      onClick={toggleMusic}
      className="cursor-pointer"
      title={enabled ? 'Disable music' : 'Enable music'}
    >
      {enabled ? (
        <Music className="w-5 h-5 text-purple-400 animate-pulse" />
      ) : (
        <Music2 className="w-5 h-5 text-gray-500" />
      )}
    </Button>
  );
}
