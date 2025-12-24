'use client';

import { useState, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@radix-ui/themes';
import { soundManager } from '@/lib/sounds';

export function SoundToggle() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    // Load saved preference from localStorage
    const saved = localStorage.getItem('soundEnabled');
    if (saved !== null) {
      const isEnabled = saved === 'true';
      setEnabled(isEnabled);
      soundManager.setEnabled(isEnabled);
    }
  }, []);

  const toggleSound = () => {
    const newState = soundManager.toggle();
    setEnabled(newState);
    localStorage.setItem('soundEnabled', String(newState));
  };

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
