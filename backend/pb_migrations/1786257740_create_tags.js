/// <reference path="../pb_data/types.d.ts" />

const RULE = "user = @request.auth.id";

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const tags = new Collection({
      type: "base",
      name: "tags",
      listRule: RULE,
      viewRule: RULE,
      createRule: RULE,
      updateRule: RULE,
      deleteRule: RULE,
      fields: [
        {
          name: "user",
          type: "relation",
          required: true,
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: "name", type: "text", required: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX `idx_tags_user_name` ON `tags` (`user`, `name`)",
      ],
    });
    app.save(tags);

    const c = app.findCollectionByNameOrId("reminders");
    c.fields.add(
      // maxSelect must be > 1 for a multi-value relation: PocketBase treats
      // maxSelect 0 or 1 as a SINGLE relation, which stores one id and expands
      // to an object instead of an array.
      new RelationField({
        name: "tags",
        collectionId: tags.id,
        maxSelect: 999,
        required: false,
        cascadeDelete: false,
      })
    );
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("reminders");
    c.fields.removeByName("tags");
    app.save(c);
    app.delete(app.findCollectionByNameOrId("tags"));
  }
);
