/**
 * A one-bit signal from "something mutated a reminder" to "the list should
 * refetch the next time it focuses".
 *
 * Deliberately a module-level boolean rather than React state or a context:
 * the flag is written by a screen that is about to unmount and read by a screen
 * that is about to focus, so nothing needs to re-render when it changes. The
 * list reads it with `consumeRemindersDirty()`, which clears it, so a mutation
 * causes exactly one refetch.
 */
let dirty = false;

export function markRemindersDirty(): void {
  dirty = true;
}

/** Reads the flag and clears it. */
export function consumeRemindersDirty(): boolean {
  const was = dirty;
  dirty = false;
  return was;
}
