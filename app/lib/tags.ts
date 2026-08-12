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

/**
 * Every tag plus how many reminders carry it.
 *
 * One count query per tag, each with its own `requestKey`. Without distinct
 * keys the SDK dedupes by method + path and the parallel counts abort each
 * other as status 0 — the same hazard documented on `resolveTagIds` below.
 */
export async function listTagsWithCounts(): Promise<TagWithCount[]> {
  const tags = await listTags();

  return Promise.all(
    tags.map(async (tag) => {
      const result = await pb.collection('reminders').getList(1, 1, {
        filter: pb.filter('tags.id ?= {:id}', { id: tag.id }),
        fields: 'id',
        requestKey: `tag-count-${tag.id}`,
      });
      return { ...tag, count: result.totalItems };
    })
  );
}

export function createTag(name: string): Promise<Tag> {
  return pb.collection('tags').create<Tag>({
    name: normalizeTagName(name),
    user: pb.authStore.record?.id,
  });
}

// The list screen renders tag badges from `expand: 'tags'`, so a rename or a
// delete changes what it shows — both mark the reminders list dirty so it
// refetches the next time it focuses.
export async function renameTag(id: string, name: string): Promise<Tag> {
  const tag = await pb.collection('tags').update<Tag>(id, { name: normalizeTagName(name) });
  markRemindersDirty();
  return tag;
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

export function isUniqueConstraintError(err: unknown): boolean {
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
