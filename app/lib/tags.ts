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

export async function resolveTagIds(selected: SelectedTag[]): Promise<string[]> {
  return Promise.all(
    selected.map(async (tag) => {
      if (tag.id) return tag.id;

      const name = normalizeTagName(tag.name);
      try {
        const created = await pb.collection('tags').create<Tag>({
          name,
          user: pb.authStore.record?.id,
        });
        return created.id;
      } catch (err) {
        if (!isUniqueConstraintError(err)) throw err;
        const existing = await pb
          .collection('tags')
          .getFirstListItem<Tag>(pb.filter('name = {:name}', { name }));
        return existing.id;
      }
    })
  );
}
