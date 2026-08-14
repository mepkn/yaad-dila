/**
 * The tags list's sequencing: when it fetches, and what a delete does before
 * the server has agreed.
 *
 * Deliberately smaller than useReminderList. This list has one page, no search
 * and no filter, so it needs no pagination, no debounce and no request tickets.
 * Adding them "for symmetry" would make the two modules look alike while doing
 * different work.
 */
import { describeError } from '@/lib/errors';
import { deleteTag, listTagsWithCounts, type TagWithCount } from '@/lib/tags';
import { useFocusEffect } from 'expo-router';
import * as React from 'react';

export interface TagList {
  items: TagWithCount[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  /** Refetch and show the full-screen loading state. */
  reload: () => Promise<void>;
  /** Refetch behind the pull-to-refresh spinner. */
  refresh: () => Promise<void>;
  remove: (tag: TagWithCount) => Promise<void>;
}

export function useTagList(): TagList {
  const [items, setItems] = React.useState<TagWithCount[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchTags = React.useCallback(async () => {
    try {
      setItems(await listTagsWithCounts());
      setError(null);
    } catch (err) {
      // An abort is a superseded request cancelling itself, not a failure.
      if ((err as { isAbort?: boolean })?.isAbort) return;
      setError(describeError(err));
    }
  }, []);

  const reload = React.useCallback(async () => {
    setLoading(true);
    await fetchTags();
    setLoading(false);
  }, [fetchTags]);

  /**
   * Reload on every focus, not only on mount.
   *
   * Deliberately unlike the reminder list, which refetches on focus only after
   * a mutation: that list would lose its appended pages and scroll position
   * (#40). This one is a single page with nothing to lose, and the reminder
   * form creates tags too — so returning to the tab must show them.
   */
  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      setLoading(true);
      fetchTags().finally(() => {
        if (active) setLoading(false);
      });
      return () => {
        active = false;
      };
    }, [fetchTags])
  );

  async function refresh() {
    setRefreshing(true);
    await fetchTags();
    setRefreshing(false);
  }

  async function remove(tag: TagWithCount) {
    // Drop the row first — a failed delete puts it back via the reload below.
    setItems((prev) => prev.filter((candidate) => candidate.id !== tag.id));
    try {
      await deleteTag(tag.id);
    } catch (err) {
      setError(describeError(err));
      await fetchTags();
    }
  }

  return { items, loading, refreshing, error, reload, refresh, remove };
}
