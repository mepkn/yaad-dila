import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

// Cancels the reminder's pending run, if any. A run that is already in
// progress can't be cancelled; recordFire ignores it if the reminder changed.
export async function cancelPendingRun(
  ctx: MutationCtx,
  reminder: Doc<"reminders">,
): Promise<void> {
  if (reminder.scheduledFnId === undefined) return;
  const job = await ctx.db.system.get("_scheduled_functions", reminder.scheduledFnId);
  if (job !== null && job.state.kind === "pending") {
    await ctx.scheduler.cancel(reminder.scheduledFnId);
  }
}

// Schedules the fire run for fireAt and returns its id.
export async function scheduleRun(
  ctx: MutationCtx,
  reminderId: Id<"reminders">,
  fireAt: number,
): Promise<Id<"_scheduled_functions">> {
  return await ctx.scheduler.runAt(fireAt, internal.fire.fire, {
    reminderId,
    fireAt,
  });
}

// Replaces any pending run with one for the reminder's current nextFireAt
// (or none if inactive), and stores the new scheduledFnId.
export async function reschedule(
  ctx: MutationCtx,
  reminderId: Id<"reminders">,
): Promise<void> {
  const reminder = await ctx.db.get("reminders", reminderId);
  if (reminder === null) return;
  if (reminder.scheduledFnId !== undefined) {
    const job = await ctx.db.system.get("_scheduled_functions", reminder.scheduledFnId);
    if (job !== null && job.state.kind === "inProgress") {
      const args = job.args[0] as { fireAt?: number } | undefined;
      // That run will record itself and schedule the next one.
      if (reminder.status === "active" && args?.fireAt === reminder.nextFireAt) return;
    }
    await cancelPendingRun(ctx, reminder);
  }
  const scheduledFnId =
    reminder.status === "active"
      ? await scheduleRun(ctx, reminder._id, reminder.nextFireAt)
      : undefined;
  await ctx.db.patch("reminders", reminder._id, { scheduledFnId });
}
