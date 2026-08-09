import { ClientResponseError } from 'pocketbase';

import { pb } from '@/lib/pb';

export interface Tag {
  id: string;
  name: string;
}

export type SelectedTag = { id?: string; name: string };

export function listTags(): Promise<Tag[]> {
  return pb.collection('tags').getFullList<Tag>({ sort: 'name' });
}

export function normalizeTagName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

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
