/// <reference path="../pb_data/types.d.ts" />

// Phase 1 backend engine. See SPEC.md §2–§4.
// goja (ES5-ish) — no npm imports, plain date math, $http.send only.
//
// Handlers are serialized into pooled VMs, so all shared helpers live in
// lib.js and are require()d INSIDE each handler.

// SPEC §2.2 — on create: next_fire = start_at, fired_count = 0, active = true.
onRecordCreate((e) => {
  const lib = require(`${__hooks}/lib.js`);

  if (e.record.getInt("priority") === 0) {
    e.record.set("priority", 3);
  }
  if (e.record.getString("repeat_mode") === "") {
    e.record.set("repeat_mode", "once");
  }

  lib.validateReminder(e.record);

  // SPEC §4 — reject creation without a usable ntfy_config.
  let config = null;
  try {
    config = e.app.findFirstRecordByFilter("ntfy_config", "user = {:user}", {
      user: e.record.getString("user"),
    });
  } catch (err) {
    // not found
  }
  if (
    !config ||
    config.getString("base_url").trim() === "" ||
    config.getString("topic").trim() === ""
  ) {
    throw new BadRequestError(
      "set up your ntfy config (base_url and topic) before creating reminders"
    );
  }

  e.record.set("next_fire", e.record.getString("start_at"));
  e.record.set("fired_count", 0);
  e.record.set("active", true);
  e.next();
}, "reminders");

// SPEC §2.3 — on update: recompute schedule only if scheduling fields changed.
// The cron tick's own saves touch none of these fields, so they pass through.
onRecordUpdate((e) => {
  const lib = require(`${__hooks}/lib.js`);

  lib.validateReminder(e.record);

  const old = e.record.original();
  const schedulingChanged =
    e.record.getInt("interval_n") !== old.getInt("interval_n") ||
    e.record.getString("interval_unit") !== old.getString("interval_unit") ||
    e.record.getString("repeat_mode") !== old.getString("repeat_mode") ||
    e.record.getInt("repeat_count") !== old.getInt("repeat_count") ||
    e.record.getString("start_at") !== old.getString("start_at");

  if (schedulingChanged) {
    e.record.set("next_fire", e.record.getString("start_at"));
    e.record.set("fired_count", 0);
    e.record.set("active", true);
  }
  e.next();
}, "reminders");

// The cron tick — SPEC §2.4. ONE job total, every minute.
cronAdd("checkReminders", "* * * * *", () => {
  const lib = require(`${__hooks}/lib.js`);

  const nowStr = new Date().toISOString().replace("T", " ");

  const due = $app.findRecordsByFilter(
    "reminders",
    "active = true && next_fire <= {:now}",
    "next_fire",
    500,
    0,
    { now: nowStr }
  );

  for (let i = 0; i < due.length; i++) {
    const r = due[i];

    // Each reminder individually wrapped — one bad ntfy endpoint must not
    // kill the tick for the others.
    try {
      let config = null;
      try {
        config = $app.findFirstRecordByFilter("ntfy_config", "user = {:user}", {
          user: r.getString("user"),
        });
      } catch (err) {
        // not found
      }

      try {
        if (!config) {
          throw new Error("no ntfy_config for this user");
        }
        lib.sendNtfy(config, r);
        r.set("last_error", "");
      } catch (sendErr) {
        // Still advance the schedule — a dead ntfy server must not freeze
        // the reminder forever.
        r.set("last_error", String(sendErr));
        $app
          .logger()
          .error("checkReminders: send failed", "reminder", r.id, "error", String(sendErr));
      }

      // The time we actually attempted the send, not the time it was due —
      // if a tick runs late, the user should be able to see that it did.
      r.set("last_fired", new Date().toISOString());

      const firedCount = r.getInt("fired_count") + 1;
      r.set("fired_count", firedCount);

      const repeatMode = r.getString("repeat_mode");
      if (repeatMode === "once") {
        r.set("active", false);
      } else if (
        repeatMode === "count" &&
        firedCount >= r.getInt("repeat_count")
      ) {
        r.set("active", false);
      } else {
        // Hard constraint: advance from previous next_fire, never from now.
        const next = lib.computeNext(
          lib.parseUTC(r.getString("next_fire")),
          r.getInt("interval_n"),
          r.getString("interval_unit")
        );
        r.set("next_fire", next.toISOString());
      }

      $app.save(r);
    } catch (err) {
      $app
        .logger()
        .error("checkReminders: tick failed", "reminder", r.id, "error", String(err));
    }
  }
});
