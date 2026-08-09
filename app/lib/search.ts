import { type Reminder } from '@/lib/reminders';

export interface ParsedQuery {
  // Lowercased tag name prefixes, from `#token`. ANDed: every one must match.
  tags: string[];
  // Lowercased free text, matched against title / message / note.
  text: string;
}

export function parseSearchQuery(raw: string): ParsedQuery {
  const tags: string[] = [];
  const words: string[] = [];

  for (const token of raw.trim().split(/\s+/)) {
    // A lone "#" is dropped rather than treated as a tag filter, so typing the
    // "#" before its word doesn't blank the list mid-keystroke.
    if (token.startsWith('#')) {
      const name = token.slice(1);
      if (name) tags.push(name.toLowerCase());
    } else if (token) {
      words.push(token);
    }
  }

  return { tags, text: words.join(' ').toLowerCase() };
}

export function matchesSearch(reminder: Reminder, query: ParsedQuery): boolean {
  const names = (reminder.expand?.tags ?? []).map((tag) => tag.name.toLowerCase());
  // Prefix match, so the list narrows while a tag name is still being typed.
  const hasEveryTag = query.tags.every((prefix) => names.some((name) => name.startsWith(prefix)));
  if (!hasEveryTag) return false;

  if (!query.text) return true;
  return [reminder.title, reminder.message, reminder.note].some((field) =>
    (field ?? '').toLowerCase().includes(query.text)
  );
}
