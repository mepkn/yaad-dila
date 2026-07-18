/// <reference path="../pb_data/types.d.ts" />

// Phase 1 — ntfy_config and reminders collections per SPEC.md §1.
// `users` is PocketBase's built-in auth collection; nothing to add there.

const RULE = "user = @request.auth.id";

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    const ntfyConfig = new Collection({
      type: "base",
      name: "ntfy_config",
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
        { name: "base_url", type: "text", required: true },
        { name: "topic", type: "text", required: true },
        {
          name: "auth_type",
          type: "select",
          maxSelect: 1,
          values: ["none", "token", "basic"],
        },
        { name: "token", type: "text" },
        { name: "username", type: "text" },
        { name: "password", type: "text" },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX `idx_ntfy_config_user` ON `ntfy_config` (`user`)",
      ],
    });
    app.save(ntfyConfig);

    const reminders = new Collection({
      type: "base",
      name: "reminders",
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
        { name: "title", type: "text", required: true },
        { name: "message", type: "text", required: true },
        { name: "priority", type: "number", onlyInt: true },
        { name: "interval_n", type: "number", required: true, onlyInt: true },
        {
          name: "interval_unit",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["minutes", "hours", "days", "weeks", "months"],
        },
        {
          name: "repeat_mode",
          type: "select",
          maxSelect: 1,
          values: ["once", "forever", "count"],
        },
        { name: "repeat_count", type: "number", onlyInt: true },
        { name: "fired_count", type: "number", onlyInt: true },
        { name: "start_at", type: "date", required: true },
        { name: "next_fire", type: "date" },
        { name: "active", type: "bool" },
        { name: "last_error", type: "text" },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE INDEX `idx_reminders_next_fire` ON `reminders` (`next_fire`)",
      ],
    });
    app.save(reminders);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("reminders"));
    app.delete(app.findCollectionByNameOrId("ntfy_config"));
  }
);
