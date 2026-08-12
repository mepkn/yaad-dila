/// <reference path="../pb_data/types.d.ts" />

// When the cron tick last attempted to send this reminder (UTC). Pairs with
// `last_error`, which the tick clears on success and sets on failure — the two
// together say what happened and when. No separate status field: `last_error`
// already is the status, and a second one could drift out of sync with it.
migrate(
  (app) => {
    const c = app.findCollectionByNameOrId("reminders");
    c.fields.add(
      new DateField({
        name: "last_fired",
        required: false,
      })
    );
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("reminders");
    c.fields.removeByName("last_fired");
    app.save(c);
  }
);
