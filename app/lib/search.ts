import { pb } from '@/lib/pb';

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

// Translates a parsed query into a PocketBase filter. Matching used to run in
// memory over the whole list; now that the list is paginated the client only
// holds one page, so searching locally would confidently report "no matches"
// for a reminder sitting on a later page. Returns '' for an empty query.
export function buildSearchFilter(query: ParsedQuery): string {
  const clauses: string[] = [];

  query.tags.forEach((tag, i) => {
    // `?~` is the any-of operator for the multi-relation `tags`; ANDing one
    // clause per tag therefore means "has a tag matching each prefix".
    // PocketBase only auto-wraps the operand in % when none is supplied, so the
    // explicit trailing % keeps this a prefix match — the list narrows while a
    // tag name is still being typed instead of sitting empty.
    clauses.push(pb.filter(`tags.name ?~ {:tag${i}}`, { [`tag${i}`]: `${tag}%` }));
  });

  if (query.text) {
    // Deliberately not matching tag names: that is what makes `#birthday gift`
    // mean something different from `gift`.
    clauses.push(pb.filter('(title ~ {:q} || message ~ {:q} || note ~ {:q})', { q: query.text }));
  }

  return clauses.join(' && ');
}
