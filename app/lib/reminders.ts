/**
 * Everything the app knows about a Reminder: its shape, how it reads on screen,
 * which bucket it falls in, and — below — the only code that reads or writes the
 * `reminders` collection.
 *
 * Screens call the operations at the bottom of this file and nothing else. The
 * PocketBase filter grammar, the sort, `expand`, `skipTotal`, the request-key
 * rules, the abort quirk, and the dirty flag are implementation details and stay
 * private: they are the facts this module exists to stop every screen relearning.
 */
import type { ParsedReminder } from '@/lib/gemini';
import i18n from '@/lib/i18n';
import { pb } from '@/lib/pb';
import { markRemindersDirty } from '@/lib/reminders-dirty';
import { buildSearchFilter, parseSearchQuery } from '@/lib/search';
import { resolveTagIds, type SelectedTag, type Tag } from '@/lib/tags';
export type IntervalUnit = 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
export type RepeatMode = 'once' | 'forever' | 'count';

export interface Reminder {
  id: string;
  title: string;
  message: string;
  note: string;
  tags: string[];
  priority: number;
  interval_n: number;
  interval_unit: IntervalUnit;
  repeat_mode: RepeatMode;
  repeat_count: number;
  fired_count: number;
  start_at: string;
  next_fire: string;
  active: boolean;
  // Empty until the cron tick has attempted this reminder at least once.
  last_fired: string;
  last_error: string;
  expand?: { tags?: Tag[] };
}

// PocketBase serializes dates as "2026-07-12 10:00:00.000Z" — the space makes
// `new Date()` parsing implementation-defined, so normalize to ISO 8601 first.
export function parseUTC(value: string): Date {
  return new Date(value.replace(' ', 'T'));
}

// All display goes through here: UTC in the DB, device-local on screen (SPEC §5.4).
export function formatLocal(value: string): string {
  const d = parseUTC(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(i18n.language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// --- The completion rule ------------------------------------------------
// How many sends complete a reminder, declared once. Both readers below are
// derived from this table: the in-memory predicate the cards use, and the
// PocketBase filter the chips use. Add a repeat mode here and both follow.
//
// The cron tick in backend/pb_hooks/reminders.pb.js applies the same rule and
// CANNOT import this — goja, separate deployable unit. That copy is a declared
// seam, not an oversight; both sides point at each other.

type CompletionTarget =
  // No number of sends ever completes it ("forever", and any unset mode).
  | { finite: false }
  // `operand` is the target as a PocketBase field expression, `of` reads the
  // same target from a record in memory. One entry, so they cannot diverge.
  | { finite: true; operand: string; of: (r: Reminder) => number };

const COMPLETION: Record<RepeatMode, CompletionTarget> = {
  once: { finite: true, operand: '1', of: () => 1 },
  count: { finite: true, operand: 'repeat_count', of: (r) => r.repeat_count },
  forever: { finite: false },
};

const FINITE_MODES = (Object.keys(COMPLETION) as RepeatMode[]).filter(
  (mode) => COMPLETION[mode].finite
);

// A reminder the engine deactivated after completing its schedule, as opposed
// to one the user paused.
export function isFinished(r: Reminder): boolean {
  if (r.active) return false;
  // An unset repeat_mode has no entry, so it is never finished.
  const target = COMPLETION[r.repeat_mode] as CompletionTarget | undefined;
  if (!target?.finite) return false;
  return r.fired_count >= target.of(r);
}

export const REMINDER_STATUSES = ['all', 'upcoming', 'paused', 'past'] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];
export type ReminderBucket = Exclude<ReminderStatus, 'all'>;

// The single definition of which bucket a reminder falls in. Every reminder
// lands in exactly one — no overlap, no leftovers. "upcoming" is keyed on
// `active`, not on `next_fire > now`: an active reminder whose next_fire has
// just slipped into the past is about to fire on the next cron tick.
export function statusOf(r: Reminder): ReminderBucket {
  if (r.active) return 'upcoming';
  return isFinished(r) ? 'past' : 'paused';
}

// --- Server-side form of the same rule -----------------------------------
// The list is paginated, so bucketing happens in the PocketBase query, not in
// memory. Both polarities are generated from COMPLETION, so they agree with
// isFinished() by construction.

/**
 * The completion rule as a PocketBase filter.
 *
 * PocketBase has no group-level NOT, so `finished: false` cannot be written as
 * !(finished). It is De Morgan'd here instead of by hand: every finite mode
 * flips its comparison, and a leading clause covers the modes with no finite
 * target — "forever" plus any unset repeat_mode — matching isFinished()'s
 * `return false` for them.
 */
function completionFilter(finished: boolean): string {
  const clauses = FINITE_MODES.map((mode) => {
    const target = COMPLETION[mode];
    if (!target.finite) return '';
    return `(repeat_mode = "${mode}" && fired_count ${finished ? '>=' : '<'} ${target.operand})`;
  });

  if (!finished) {
    clauses.unshift(`(${FINITE_MODES.map((mode) => `repeat_mode != "${mode}"`).join(' && ')})`);
  }

  return `(${clauses.join(' || ')})`;
}

// Empty string means "no constraint" — dropped before joining.
function statusFilter(status: ReminderStatus): string {
  switch (status) {
    case 'upcoming':
      return 'active = true';
    case 'past':
      return `active = false && ${completionFilter(true)}`;
    case 'paused':
      return `active = false && ${completionFilter(false)}`;
    default:
      return '';
  }
}

// Single-bucket views sort by when the reminder fires; "past" is the one bucket
// where the interesting end is the recent one. "all" leads with `-active` so
// still-scheduled reminders come first — the backend never clears `next_fire`
// on completion, so a plain `next_fire` sort would put finished ones on top.
function sortFor(status: ReminderStatus): string {
  if (status === 'all') return '-active,next_fire';
  return status === 'past' ? '-next_fire' : 'next_fire';
}

// --- Reading and writing reminders --------------------------------------
// The only place in the app that touches pb.collection('reminders').

const PAGE_SIZE = 30;

export interface ReminderPage {
  items: Reminder[];
  hasMore: boolean;
}

export interface ListRemindersOptions {
  page: number;
  status: ReminderStatus;
  // Raw search box text, `#tag` syntax and all. Parsing it is this module's job.
  query: string;
  // True while adding a page to a list already on screen, false when the list is
  // being replaced (first load, refresh, new query). Only the request key differs,
  // but getting it wrong makes two live requests abort each other.
  append: boolean;
}

/**
 * One page of reminders, newest constraint first.
 *
 * Returns null when the request was aborted — the SDK cancels an in-flight
 * request whose key a newer one reuses, which is this module cancelling itself
 * on purpose, not a failure. Callers show nothing and wait for the newer reply.
 */
export async function listReminders(opts: ListRemindersOptions): Promise<ReminderPage | null> {
  const filter = [statusFilter(opts.status), buildSearchFilter(parseSearchQuery(opts.query))]
    .filter(Boolean)
    .join(' && ');

  try {
    const result = await pb.collection('reminders').getList<Reminder>(opts.page, PAGE_SIZE, {
      filter,
      sort: sortFor(opts.status),
      expand: 'tags',
      // We only need "is there another page", which the short-page check below
      // answers — skipping the COUNT query makes each fetch cheaper.
      skipTotal: true,
      // Without an explicit key the SDK dedupes by method+path, so a page append
      // and a refresh would abort each other with status 0 (the same hazard
      // documented in lib/tags.ts). Distinct keys keep them apart, while a new
      // search reusing 'reminders-list' cancels the stale one on purpose.
      requestKey: opts.append ? 'reminders-page' : 'reminders-list',
    });

    return { items: result.items, hasMore: result.items.length === PAGE_SIZE };
  } catch (err) {
    if ((err as { isAbort?: boolean })?.isAbort) return null;
    throw err;
  }
}

/** True when the query text narrows the list, i.e. a bare "#" does not count. */
export function isSearching(query: string): boolean {
  const parsed = parseSearchQuery(query);
  return parsed.tags.length > 0 || parsed.text.length > 0;
}

export function getReminder(id: string): Promise<Reminder> {
  return pb.collection('reminders').getOne<Reminder>(id, { expand: 'tags' });
}

// --- The draft ----------------------------------------------------------
// A reminder as the form holds it while the user edits it. Server-owned fields
// (next_fire, fired_count, active, last_fired, last_error) are absent by design:
// the backend computes them and an app write would fight the cron tick.
//
// Numbers are held as text because a number input must accept an empty box
// mid-typing. Every conversion to a real number happens in saveReminder, so no
// screen calls Number() and no screen decides what an empty box means.
export interface ReminderDraft {
  title: string;
  message: string;
  note: string;
  // Tags the user picked; ones without an id are created on save.
  tags: SelectedTag[];
  priority: string;
  interval_n: string;
  interval_unit: IntervalUnit;
  repeat_mode: RepeatMode;
  repeat_count: string;
  // Device-local; stored as UTC (SPEC §5.4).
  start_at: Date;
}

const DEFAULT_PRIORITY = '3';

export function emptyDraft(): ReminderDraft {
  return {
    title: '',
    message: '',
    note: '',
    tags: [],
    priority: DEFAULT_PRIORITY,
    interval_n: '1',
    interval_unit: 'days',
    repeat_mode: 'once',
    repeat_count: '2',
    start_at: new Date(),
  };
}

/** The one place a stored reminder becomes an editable draft. */
export function draftFromRecord(r: Reminder): ReminderDraft {
  const empty = emptyDraft();
  return {
    title: r.title,
    message: r.message,
    note: r.note ?? '',
    tags: (r.expand?.tags ?? []).map((tag) => ({ id: tag.id, name: tag.name })),
    priority: String(r.priority || DEFAULT_PRIORITY),
    interval_n: String(r.interval_n),
    interval_unit: r.interval_unit,
    repeat_mode: r.repeat_mode,
    // The backend zeroes repeat_count outside "count" mode, and an empty box is
    // not an editable starting point — keep the default so switching to "count"
    // lands on a usable number.
    repeat_count: r.repeat_count >= 1 ? String(r.repeat_count) : empty.repeat_count,
    start_at: parseUTC(r.start_at),
  };
}

/**
 * A voice parse folded into the draft.
 *
 * Only the fields Gemini returns are replaced; note, tags and priority stay as
 * the user left them, since the parse never speaks about them.
 */
export function draftFromParsed(draft: ReminderDraft, parsed: ParsedReminder): ReminderDraft {
  return {
    ...draft,
    title: parsed.title,
    message: parsed.message,
    interval_n: String(parsed.interval_n),
    interval_unit: parsed.interval_unit,
    repeat_mode: parsed.repeat_mode,
    repeat_count: parsed.repeat_count >= 1 ? String(parsed.repeat_count) : draft.repeat_count,
    start_at: parsed.start_at,
  };
}

/** The same conditions the backend validates, checked before a round-trip. */
export function isDraftValid(draft: ReminderDraft): boolean {
  if (draft.title.trim() === '' || draft.message.trim() === '') return false;
  // An empty or non-numeric box reads as 0, which fails this the same way a
  // typed 0 does.
  const intervalN = Number(draft.interval_n);
  if (!Number.isFinite(intervalN) || intervalN < 1) return false;
  if (draft.repeat_mode !== 'count') return true;
  const repeatCount = Number(draft.repeat_count);
  return Number.isFinite(repeatCount) && repeatCount >= 1;
}

/** Creates when `id` is omitted, updates otherwise. */
export async function saveReminder(draft: ReminderDraft, id?: string): Promise<Reminder> {
  const data = {
    user: pb.authStore.record?.id,
    title: draft.title.trim(),
    message: draft.message.trim(),
    note: draft.note,
    // Resolving may create tags; it runs serially and retries on the unique
    // constraint, both of which the caller should never have to know about.
    tags: await resolveTagIds(draft.tags),
    priority: Number(draft.priority),
    interval_n: Number(draft.interval_n),
    interval_unit: draft.interval_unit,
    repeat_mode: draft.repeat_mode,
    // A count is meaningless in the other modes; storing a stale one would show
    // up again if the user switched back to "count".
    repeat_count: draft.repeat_mode === 'count' ? Number(draft.repeat_count) : 0,
    // The backend computes next_fire from this.
    start_at: draft.start_at.toISOString(),
  };

  const saved = id
    ? await pb.collection('reminders').update<Reminder>(id, data)
    : await pb.collection('reminders').create<Reminder>(data);

  markRemindersDirty();
  return saved;
}

export async function deleteReminder(id: string): Promise<void> {
  await pb.collection('reminders').delete(id);
  markRemindersDirty();
}

/**
 * Pause or resume a reminder.
 *
 * Deliberately does NOT mark the list dirty: the list patches the row in place,
 * and a refetch would reset pagination and throw away the scroll position.
 */
export async function setReminderActive(id: string, active: boolean): Promise<void> {
  await pb.collection('reminders').update(id, { active });
}
