'use client';

import { Button, DropdownMenu, Flex, Text } from '@radix-ui/themes';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { useUIStore, useTheme, ThemeAccentColor, ThemeAppearance } from '@/store/uiStore';

const ACCENT_COLORS: { value: ThemeAccentColor; label: string; class: string }[] = [
  { value: 'cyan', label: 'Cyan', class: 'bg-cyan-500' },
  { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-500' },
  { value: 'pink', label: 'Pink', class: 'bg-pink-500' },
  { value: 'red', label: 'Red', class: 'bg-red-500' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-500' },
  { value: 'yellow', label: 'Yellow', class: 'bg-yellow-500' },
  { value: 'green', label: 'Green', class: 'bg-green-500' },
  { value: 'teal', label: 'Teal', class: 'bg-teal-500' },
];

const APPEARANCE_OPTIONS: { value: ThemeAppearance; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function ThemeSwitcher() {
  const theme = useTheme();
  const { setAppearance, setAccentColor } = useUIStore();

  const currentAppearance = APPEARANCE_OPTIONS.find((o) => o.value === theme.appearance);
  const AppearanceIcon = currentAppearance?.icon || Moon;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <Button variant="ghost" size="2" className="cursor-pointer">
          <AppearanceIcon className="w-5 h-5" />
        </Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Content align="end" className="min-w-[200px]">
        <DropdownMenu.Label>Appearance</DropdownMenu.Label>
        {APPEARANCE_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <DropdownMenu.Item
              key={option.value}
              onClick={() => setAppearance(option.value)}
              className="cursor-pointer"
            >
              <Flex align="center" gap="2" justify="between" className="w-full">
                <Flex align="center" gap="2">
                  <Icon className="w-4 h-4" />
                  <Text size="2">{option.label}</Text>
                </Flex>
                {theme.appearance === option.value && (
                  <Check className="w-4 h-4 text-cyan-400" />
                )}
              </Flex>
            </DropdownMenu.Item>
          );
        })}

        <DropdownMenu.Separator />

        <DropdownMenu.Label>Accent Color</DropdownMenu.Label>
        <Flex wrap="wrap" gap="1" p="2">
          {ACCENT_COLORS.map((color) => (
            <button
              key={color.value}
              onClick={() => setAccentColor(color.value)}
              className={`w-6 h-6 rounded-full ${color.class} cursor-pointer transition-transform hover:scale-110 ${
                theme.accentColor === color.value ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' : ''
              }`}
              title={color.label}
            />
          ))}
        </Flex>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

// Compact version for headers
export function ThemeToggle() {
  const theme = useTheme();
  const { setAppearance } = useUIStore();

  const cycleAppearance = () => {
    const order: ThemeAppearance[] = ['dark', 'light', 'system'];
    const currentIndex = order.indexOf(theme.appearance);
    const nextIndex = (currentIndex + 1) % order.length;
    setAppearance(order[nextIndex]);
  };

  const Icon = theme.appearance === 'light' ? Sun : theme.appearance === 'dark' ? Moon : Monitor;

  return (
    <Button
      variant="ghost"
      size="2"
      onClick={cycleAppearance}
      className="cursor-pointer"
      title={`Theme: ${theme.appearance}`}
    >
      <Icon className="w-5 h-5" />
    </Button>
  );
}
