/**
 * One shape for "the user pressed a button that talks to the network".
 *
 * Every mutating action in the app was written the same way by hand: set busy,
 * clear the status, try the work, translate the error, clear busy in a finally.
 * The shape is right; writing it out each time is what let the copies drift —
 * only one of them ever checked for an aborted request.
 *
 * Deliberately thin. It owns busy, status, the abort rule and the error
 * translation, and nothing else. No retries, no timeouts, no caching: those are
 * a data-fetching library's job, and adopting one is a much larger decision.
 */
import * as React from 'react';

import { describeError } from '@/lib/errors';

export type ActionStatus = { kind: 'ok' | 'error'; text: string } | null;

export interface ActionOptions {
  /** Shown when the work resolves. Already translated — pass t('…'). */
  success?: string;
  /**
   * Stay busy after success. For an action that navigates away: releasing the
   * button during the transition invites a second press on work already done.
   */
  keepBusyOnSuccess?: boolean;
}

export interface Action<A extends unknown[]> {
  run: (...args: A) => Promise<void>;
  busy: boolean;
  status: ActionStatus;
  /** Drops the message, e.g. when a sibling action takes over the status line. */
  clear: () => void;
}

export function useAction<A extends unknown[]>(
  work: (...args: A) => Promise<unknown>,
  options: ActionOptions = {}
): Action<A> {
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<ActionStatus>(null);

  // The work is usually an inline closure over current state, so it is a new
  // function every render. Reading it from a ref keeps `run` stable without
  // asking every caller to wrap their work in useCallback.
  const latest = React.useRef({ work, options });
  latest.current = { work, options };

  const run = React.useCallback(async (...args: A) => {
    const { work: currentWork, options: currentOptions } = latest.current;
    setBusy(true);
    setStatus(null);
    try {
      await currentWork(...args);
      setStatus(currentOptions.success ? { kind: 'ok', text: currentOptions.success } : null);
      if (!currentOptions.keepBusyOnSuccess) setBusy(false);
    } catch (err) {
      // An abort is the SDK cancelling a superseded request, not a failure —
      // report nothing and let the newer request speak.
      if (!(err as { isAbort?: boolean })?.isAbort) {
        setStatus({ kind: 'error', text: describeError(err) });
      }
      setBusy(false);
    }
  }, []);

  const clear = React.useCallback(() => setStatus(null), []);

  return { run, busy, status, clear };
}
