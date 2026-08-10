/// <reference path="../pb_data/types.d.ts" />

// The app paginates the reminders list with getList(page, perPage), and every
// one of those queries is scoped by the list rule (`user = @request.auth.id`)
// then sorted — but `reminders` had no index on `user` at all. These two
// composites cover the sorts the list screen actually issues:
//   (user, next_fire)         -> the "all"/"upcoming"/"paused"/"past" sorts
//   (user, active, next_fire) -> the "all" sort, which leads with `-active`
//
// `idx_reminders_next_fire` is deliberately kept: the cron tick scans
// `next_fire <= now` across ALL users with no `user` prefix, so neither
// composite can serve it.
migrate(
  (app) => {
    const c = app.findCollectionByNameOrId("reminders");
    c.indexes = [
      "CREATE INDEX `idx_reminders_next_fire` ON `reminders` (`next_fire`)",
      "CREATE INDEX `idx_reminders_user_next_fire` ON `reminders` (`user`, `next_fire`)",
      "CREATE INDEX `idx_reminders_user_active_next_fire` ON `reminders` (`user`, `active`, `next_fire`)",
    ];
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("reminders");
    c.indexes = [
      "CREATE INDEX `idx_reminders_next_fire` ON `reminders` (`next_fire`)",
    ];
    app.save(c);
  }
);
