import { ClientResponseError } from 'pocketbase';

import { pb } from '@/lib/pb';
import { markRemindersDirty } from '@/lib/reminders-dirty';

export interface Tag {
  id: string;
  name: string;
}

export type SelectedTag = { id?: string; name: string };

export interface TagWithCount extends Tag {
  count: number;
}

export function listTags(): Promise<Tag[]> {
  return pb.collection('tags').getFullList<Tag>({ sort: 'name' });
}

/** What the `tag_counts` view returns; `count` is the app-side name for it. */
interface TagCountRow extends Tag {
  reminder_count: number;
}

/**
 * Every tag plus how many reminders carry it — one request, whatever the tag
 * count.
 *
 * This used to fetch the tags, then issue a per-tag count request in parallel.
 * That fan-out degraded itself: measured against the request log, a lone count
 * query costs ~4ms but nine racing ones cost ~156ms EACH, so a three-tag
 * account spent ~490ms opening the screen. The `tag_counts` view does the same
 * arithmetic in SQL (see the migration) and answers in one round trip.
 */
export async function listTagsWithCounts(): Promise<TagWithCount[]> {
  const rows = await pb.collection('tag_counts').getFullList<TagCountRow>({ sort: 'name' });

  return rows.map((row) => ({ id: row.id, name: row.name, count: row.reminder_count }));
}

/**
 * What a save can mean in this domain. Anything else — no network, a stale
 * token — throws, so it reaches the caller's useAction like every other
 * failure in the app.
 */
export type SaveTagOutcome = 'saved' | 'duplicate' | 'empty';

/**
 * Create a tag, or rename one when `id` is given.
 *
 * Normalization, the create-or-rename choice, and PocketBase's way of
 * reporting the unique index all live here. A caller decides what a duplicate
 * MEANS to it — the dialog complains, resolveTagIds below reuses the existing
 * tag — but no caller has to recognise one.
 *
 * The list screen renders tag badges from `expand: 'tags'`, so a rename changes
 * what it shows: a successful rename marks the reminders list dirty.
 */
export async function saveTag(name: string, id?: string): Promise<SaveTagOutcome> {
  const normalized = normalizeTagName(name);
  if (!normalized) return 'empty';

  try {
    if (id) {
      await pb.collection('tags').update<Tag>(id, { name: normalized });
      markRemindersDirty();
    } else {
      await pb.collection('tags').create<Tag>({
        name: normalized,
        user: pb.authStore.record?.id,
      });
    }
    return 'saved';
  } catch (err) {
    if (!isUniqueConstraintError(err)) throw err;
    return 'duplicate';
  }
}

// PocketBase strips a deleted record's id out of every relation field that
// referenced it, so the reminders themselves survive and simply lose the badge.
export async function deleteTag(id: string): Promise<void> {
  await pb.collection('tags').delete(id);
  markRemindersDirty();
}

export function normalizeTagName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

// The unique index is per (user, name). Private: callers speak in outcomes.
function isUniqueConstraintError(err: unknown): boolean {
  if (!(err instanceof ClientResponseError) || err.status !== 400) return false;
  const fields = err.response?.data as Record<string, { code?: string }> | undefined;
  return Object.values(fields ?? {}).some((field) => field.code === 'validation_not_unique');
}

// Creates run one at a time, never in parallel. The PocketBase SDK derives a
// request key from method + path and auto-cancels duplicate in-flight requests,
// so concurrent creates against the same collection abort each other — and an
// aborted request surfaces as status 0, i.e. a bogus "server unreachable".
export async function resolveTagIds(selected: SelectedTag[]): Promise<string[]> {
  const ids: string[] = [];

  for (const tag of selected) {
    if (tag.id) {
      ids.push(tag.id);
      continue;
    }

    const name = normalizeTagName(tag.name);
    try {
      // Deliberately not saveTag(): here a duplicate is success, not a
      // complaint — the user asked for a tag by name and one already exists.
      const created = await pb.collection('tags').create<Tag>({
        name,
        user: pb.authStore.record?.id,
      });
      ids.push(created.id);
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;
      const existing = await pb
        .collection('tags')
        .getFirstListItem<Tag>(pb.filter('name = {:name}', { name }));
      ids.push(existing.id);
    }
  }

  return ids;
}
