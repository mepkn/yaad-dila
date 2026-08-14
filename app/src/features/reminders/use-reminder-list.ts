/**
 * The reminder list's sequencing: what a fetch is started by, which reply is
 * allowed to win, and when the list refetches on its own.
 *
 * Four things start a fetch — the search box (debounced), a bucket chip,
 * returning to a screen after a mutation, and pull-to-refresh or reaching the
 * end of the list. Two rules decide which reply survives: a ticket per fetch,
 * and the null that `listReminders` returns for an aborted request. One rule
 * protects the scroll position: toggling a reminder patches its row in place
 * and never refetches (the fix in #40).
 *
 * All of it used to sit above the JSX in reminders-list-screen.tsx. The screen
 * now reads values and draws them.
 */
import { describeError } from '@/lib/errors';
import {
  isSearching,
  listReminders,
  setReminderActive,
  statusOf,
  type Reminder,
  type ReminderStatus,
} from '@/lib/reminders';
import { consumeRemindersDirty } from '@/lib/reminders-dirty';
import { useFocusEffect } from 'expo-router';
import * as React from 'react';

const SEARCH_DEBOUNCE_MS = 300;

export interface ReminderList {
  items: Reminder[];
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  hasMore: boolean;
  error: string | null;
  /** True when the query narrows the list — a lone "#" does not count. */
  searching: boolean;
  query: string;
  setQuery: (value: string) => void;
  status: ReminderStatus;
  setStatus: (value: ReminderStatus) => void;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  setActive: (reminder: Reminder, active: boolean) => Promise<void>;
}

export function useReminderList(): ReminderList {
  const [items, setItems] = React.useState<Reminder[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const [debouncedQuery, setDebouncedQuery] = React.useState('');
  // Filter state is deliberately not persisted: every visit to home starts at
  // "all", so a reminder can never be missing because of a forgotten filter.
  const [status, setStatus] = React.useState<ReminderStatus>('all');

  const page = React.useRef(1);
  // Every fetch takes a ticket; a response whose ticket is stale is dropped, so
  // a slow reply for an old query can never overwrite newer results.
  const requestId = React.useRef(0);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchPage = React.useCallback(
    async (pageNum: number, replace: boolean) => {
      const ticket = ++requestId.current;
      try {
        const result = await listReminders({
          page: pageNum,
          status,
          query: debouncedQuery,
          append: !replace,
        });

        // null means the request was aborted in favour of a newer one.
        if (!result) return;
        if (ticket !== requestId.current) return;

        page.current = pageNum;
        setHasMore(result.hasMore);
        setItems((prev) => (replace ? result.items : [...prev, ...result.items]));
        setError(null);
      } catch (err) {
        if (ticket !== requestId.current) return;
        setError(describeError(err));
      }
    },
    [status, debouncedQuery]
  );

  const reload = React.useCallback(() => {
    let active = true;
    setLoading(true);
    fetchPage(1, true).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [fetchPage]);

  // First mount, and every time the query shape changes.
  React.useEffect(reload, [reload]);

  // On focus we only refetch when a mutation actually happened. Reloading on
  // every focus would throw away the appended pages and the scroll position
  // just because the user opened a reminder and came back. Server-side changes
  // (a cron fire flipping a reminder to done) are picked up by pull-to-refresh.
  useFocusEffect(
    React.useCallback(() => {
      if (!consumeRemindersDirty()) return;
      return reload();
    }, [reload])
  );

  async function loadMore() {
    // onEndReached fires repeatedly while the user sits at the bottom; without
    // these guards it stacks duplicate requests for the same page.
    if (!hasMore || loadingMore || loading || refreshing) return;
    setLoadingMore(true);
    await fetchPage(page.current + 1, false);
    setLoadingMore(false);
  }

  async function refresh() {
    setRefreshing(true);
    await fetchPage(1, true);
    setRefreshing(false);
  }

  async function setActive(reminder: Reminder, active: boolean) {
    // Patch in place rather than refetching: a reload would reset pagination
    // and throw away the user's scroll position.
    setItems((prev) => prev.map((r) => (r.id === reminder.id ? { ...r, active } : r)));
    try {
      await setReminderActive(reminder.id, active);
      // Only drop the row once the server has agreed. Removing it optimistically
      // would mean a failed update has to re-insert it at the right position,
      // which a map() can no longer do.
      if (status !== 'all') {
        setItems((prev) => prev.filter((r) => statusOf(r) === status));
      }
    } catch (err) {
      setError(describeError(err));
      setItems((prev) => prev.map((r) => (r.id === reminder.id ? reminder : r)));
    }
  }

  return {
    items,
    loading,
    loadingMore,
    refreshing,
    hasMore,
    error,
    searching: isSearching(debouncedQuery),
    query,
    setQuery,
    status,
    setStatus,
    loadMore,
    refresh,
    setActive,
  };
}
