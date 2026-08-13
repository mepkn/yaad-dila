import { type ReminderDraft } from '@/lib/reminders';

/**
 * The one updater every field on the reminder form calls.
 *
 * Declared here rather than in each card so the three cards and the screen
 * agree on its shape without importing each other.
 */
export type DraftUpdate = <K extends keyof ReminderDraft>(key: K, value: ReminderDraft[K]) => void;
