/// <reference path="../pb_data/types.d.ts" />

// The users collection kept PocketBase's default public create rule because it
// was never covered by a migration. Since this server is publicly reachable,
// account creation must be restricted to superusers in the admin UI. In
// PocketBase, a null rule means superusers only; an empty string means anyone,
// including unauthenticated guests.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.createRule = null;
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.createRule = "";
    app.save(users);
  },
);
