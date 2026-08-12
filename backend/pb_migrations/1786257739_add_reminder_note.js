/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId("reminders");
    c.fields.add(
      new TextField({
        name: "note",
        type: "text",
        required: false,
      })
    );
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("reminders");
    c.fields.removeByName("note");
    app.save(c);
  }
);
