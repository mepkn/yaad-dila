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

// A reminder the engine deactivated after completing its schedule, as opposed
// to one the user paused.
export function isFinished(r: Reminder): boolean {
  if (r.active) return false;
  if (r.repeat_mode === 'once') return r.fired_count >= 1;
  if (r.repeat_mode === 'count') return r.fired_count >= r.repeat_count;
  return false;
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

// --- Server-side equivalents of isFinished()/statusOf() ------------------
// The list is paginated, so bucketing happens in the PocketBase query, not in
// memory. These MUST stay in sync with isFinished()/statusOf() above — if the
// completion rule changes, change it in both places or the chips and the cards
// will disagree about the same reminder.

const FINISHED =
  '((repeat_mode = "once" && fired_count >= 1) || (repeat_mode = "count" && fired_count >= repeat_count))';

// PocketBase filters have no group-level NOT, so "not finished" is De Morgan'd
// by hand rather than written as !(FINISHED). The first clause covers "forever"
// plus any unset repeat_mode, matching isFinished()'s final `return false`.
const NOT_FINISHED =
  '((repeat_mode != "once" && repeat_mode != "count") || (repeat_mode = "once" && fired_count < 1) || (repeat_mode = "count" && fired_count < repeat_count))';

// Empty string means "no constraint" — dropped before joining.
function statusFilter(status: ReminderStatus): string {
  switch (status) {
    case 'upcoming':
      return 'active = true';
    case 'past':
      return `active = false && ${FINISHED}`;
    case 'paused':
      return `active = false && ${NOT_FINISHED}`;
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

// What a screen supplies to create or update a reminder. Server-owned fields
// (next_fire, fired_count, active, last_fired, last_error) are absent by design:
// the backend computes them and an app write would fight the cron tick.
export interface ReminderDraft {
  title: string;
  message: string;
  note: string;
  // Tags the user picked; ones without an id are created on save.
  tags: SelectedTag[];
  priority: number;
  interval_n: number;
  interval_unit: IntervalUnit;
  repeat_mode: RepeatMode;
  repeat_count: number;
  // Device-local; stored as UTC (SPEC §5.4).
  start_at: Date;
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
    priority: draft.priority,
    interval_n: draft.interval_n,
    interval_unit: draft.interval_unit,
    repeat_mode: draft.repeat_mode,
    // A count is meaningless in the other modes; storing a stale one would show
    // up again if the user switched back to "count".
    repeat_count: draft.repeat_mode === 'count' ? draft.repeat_count : 0,
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
