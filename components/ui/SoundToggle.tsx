'use client';

import { useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@radix-ui/themes';
import { soundManager } from '@/lib/sounds';
import { useUIStore, useSoundPreferences } from '@/store/uiStore';

export function SoundToggle() {
  const { enabled, volume } = useSoundPreferences();
  const toggleSound = useUIStore((state) => state.toggleSound);

  // Sync soundManager with store
  useEffect(() => {
    soundManager.setEnabled(enabled);
  }, [enabled]);

  return (
    <Button
      variant="ghost"
      size="2"
      onClick={toggleSound}
      className="cursor-pointer"
      title={enabled ? 'Disable sounds' : 'Enable sounds'}
    >
      {enabled ? (
        <Volume2 className="w-5 h-5" />
      ) : (
        <VolumeX className="w-5 h-5 text-gray-500" />
      )}
    </Button>
  );
}
