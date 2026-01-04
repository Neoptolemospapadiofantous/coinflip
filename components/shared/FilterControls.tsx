'use client';

import { memo } from 'react';
import { Flex, Select, Button, Badge, TextField } from '@radix-ui/themes';
import { Filter, X, Search, Calendar, SortAsc, SortDesc } from 'lucide-react';
import { useTiers } from '@/hooks/useTiers';

export type DateRangeFilter = 'all' | 'today' | '7d' | '30d' | '90d';
export type StatusFilter = 'all' | 'pending' | 'matched' | 'resolved' | 'cancelled' | 'won' | 'lost';
export type SortOption = 'newest' | 'oldest' | 'amount_high' | 'amount_low';

interface FilterControlsProps {
  // Tier filter
  tierFilter?: number | null;
  onTierChange?: (tier: number | null) => void;
  showTierFilter?: boolean;

  // Date range filter
  dateRange?: DateRangeFilter;
  onDateRangeChange?: (range: DateRangeFilter) => void;
  showDateFilter?: boolean;

  // Status filter
  statusFilter?: StatusFilter;
  onStatusChange?: (status: StatusFilter) => void;
  showStatusFilter?: boolean;
  statusOptions?: StatusFilter[];

  // Sort
  sortOption?: SortOption;
  onSortChange?: (sort: SortOption) => void;
  showSortFilter?: boolean;

  // Search
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  showSearch?: boolean;
  searchPlaceholder?: string;

  // Layout
  compact?: boolean;
  className?: string;
}

const dateRangeLabels: Record<DateRangeFilter, string> = {
  all: 'All Time',
  today: 'Today',
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  '90d': 'Last 90 Days',
};

const statusLabels: Record<StatusFilter, string> = {
  all: 'All Status',
  pending: 'Pending',
  matched: 'Matched',
  resolved: 'Resolved',
  cancelled: 'Cancelled',
  won: 'Wins Only',
  lost: 'Losses Only',
};

const sortLabels: Record<SortOption, string> = {
  newest: 'Newest First',
  oldest: 'Oldest First',
  amount_high: 'Highest Amount',
  amount_low: 'Lowest Amount',
};

export const FilterControls = memo(function FilterControls({
  tierFilter,
  onTierChange,
  showTierFilter = false,
  dateRange,
  onDateRangeChange,
  showDateFilter = false,
  statusFilter,
  onStatusChange,
  showStatusFilter = false,
  statusOptions = ['all', 'pending', 'matched', 'resolved', 'cancelled'],
  sortOption,
  onSortChange,
  showSortFilter = false,
  searchQuery,
  onSearchChange,
  showSearch = false,
  searchPlaceholder = 'Search...',
  compact = false,
  className = '',
}: FilterControlsProps) {
  const { data: tiers = [] } = useTiers();

  const hasActiveFilters =
    (tierFilter !== null && tierFilter !== undefined) ||
    (dateRange && dateRange !== 'all') ||
    (statusFilter && statusFilter !== 'all') ||
    (searchQuery && searchQuery.length > 0);

  const clearAllFilters = () => {
    onTierChange?.(null);
    onDateRangeChange?.('all');
    onStatusChange?.('all');
    onSearchChange?.('');
  };

  return (
    <Flex
      gap={compact ? '2' : '3'}
      align="center"
      wrap="wrap"
      className={className}
    >
      {/* Filter Icon */}
      <Filter className="w-4 h-4 text-gray-400 shrink-0" />

      {/* Tier Filter */}
      {showTierFilter && onTierChange && (
        <Select.Root
          value={tierFilter?.toString() ?? 'all'}
          onValueChange={(v) => onTierChange(v === 'all' ? null : parseInt(v))}
        >
          <Select.Trigger placeholder="All Tiers" />
          <Select.Content>
            <Select.Item value="all">All Tiers</Select.Item>
            {tiers.map((tier) => (
              <Select.Item key={tier.id} value={tier.id.toString()}>
                ${tier.amountUsd}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      )}

      {/* Date Range Filter */}
      {showDateFilter && onDateRangeChange && (
        <Select.Root
          value={dateRange ?? 'all'}
          onValueChange={(v) => onDateRangeChange(v as DateRangeFilter)}
        >
          <Select.Trigger>
            <Flex align="center" gap="1">
              <Calendar className="w-3 h-3" />
              <span>{dateRangeLabels[dateRange ?? 'all']}</span>
            </Flex>
          </Select.Trigger>
          <Select.Content>
            {Object.entries(dateRangeLabels).map(([value, label]) => (
              <Select.Item key={value} value={value}>
                {label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      )}

      {/* Status Filter */}
      {showStatusFilter && onStatusChange && (
        <Select.Root
          value={statusFilter ?? 'all'}
          onValueChange={(v) => onStatusChange(v as StatusFilter)}
        >
          <Select.Trigger placeholder="All Status" />
          <Select.Content>
            {statusOptions.map((status) => (
              <Select.Item key={status} value={status}>
                {statusLabels[status]}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      )}

      {/* Sort */}
      {showSortFilter && onSortChange && (
        <Select.Root
          value={sortOption ?? 'newest'}
          onValueChange={(v) => onSortChange(v as SortOption)}
        >
          <Select.Trigger>
            <Flex align="center" gap="1">
              {sortOption === 'oldest' || sortOption === 'amount_low'
                ? <SortAsc className="w-3 h-3" />
                : <SortDesc className="w-3 h-3" />}
              <span>{sortLabels[sortOption ?? 'newest']}</span>
            </Flex>
          </Select.Trigger>
          <Select.Content>
            {Object.entries(sortLabels).map(([value, label]) => (
              <Select.Item key={value} value={value}>
                {label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      )}

      {/* Search */}
      {showSearch && onSearchChange && (
        <TextField.Root
          placeholder={searchPlaceholder}
          value={searchQuery ?? ''}
          onChange={(e) => onSearchChange(e.target.value)}
          size="2"
        >
          <TextField.Slot>
            <Search className="w-3 h-3" />
          </TextField.Slot>
          {searchQuery && searchQuery.length > 0 && (
            <TextField.Slot>
              <Button
                variant="ghost"
                size="1"
                onClick={() => onSearchChange('')}
                className="cursor-pointer"
              >
                <X className="w-3 h-3" />
              </Button>
            </TextField.Slot>
          )}
        </TextField.Root>
      )}

      {/* Active Filter Indicator & Clear */}
      {hasActiveFilters && (
        <Flex align="center" gap="2">
          <Badge color="cyan" variant="soft" size="1">
            Filters Active
          </Badge>
          <Button
            variant="ghost"
            size="1"
            onClick={clearAllFilters}
            className="cursor-pointer text-gray-400 hover:text-white"
          >
            <X className="w-3 h-3" />
            Clear
          </Button>
        </Flex>
      )}
    </Flex>
  );
});

// Date range helper function
export function getDateRangeStart(range: DateRangeFilter): Date | null {
  const now = new Date();
  switch (range) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case 'all':
    default:
      return null;
  }
}
