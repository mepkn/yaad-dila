/// <reference path="../pb_data/types.d.ts" />

// A read-only view that carries each tag's reminder count alongside the tag.
//
// The tags screen used to fetch the tag list, then issue one count request PER
// TAG (`reminders?filter=tags.id ?= '<id>'&perPage=1`, reading `totalItems`).
// Measured against the request log: a lone count query costs ~4ms, but the nine
// of them the screen fires in parallel cost ~156ms EACH — the fan-out degrades
// itself, so a 3-tag database took ~490ms to open a tab that has no data in it.
// The same counts as one aggregate take ~1ms, and stay flat as tags grow.
//
// `id` is mandatory in a view query — PocketBase keys records by it. `user` is
// here to carry the API rule; without that column the view would expose every
// user's tags. The count is scoped by `r.user = t.user` as well: tag ids are
// already per-user, but the view must not depend on that to stay isolated.
//
// `json_each` is how a multi-value relation is stored — PocketBase keeps the
// related ids in a JSON array column, so counting means expanding it per row.
const VIEW_QUERY = `
  SELECT
    t.id AS id,
    t.user AS user,
    t.name AS name,
    (
      SELECT COUNT(*)
      FROM reminders r
      WHERE r.user = t.user
        AND EXISTS (
          SELECT 1 FROM json_each(r.tags) je WHERE je.value = t.id
        )
    ) AS reminder_count
  FROM tags t
`;

migrate(
  (app) => {
    const view = new Collection({
      type: "view",
      name: "tag_counts",
      // A view is read-only: PocketBase rejects create/update/delete against
      // it regardless, so only the read rules are meaningful here.
      listRule: "user = @request.auth.id",
      viewRule: "user = @request.auth.id",
      viewQuery: VIEW_QUERY,
    });
    app.save(view);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("tag_counts"));
  }
);
