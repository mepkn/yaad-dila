// Shared helpers for pb_hooks. Loaded with require() INSIDE each hook handler —
// PocketBase serializes handler functions and runs them in pooled VMs, so
// top-level functions from the .pb.js file are NOT visible inside handlers.
// (Verified the hard way in Phase 1; require() of siblings verified in Phase 0.)

// PocketBase stores dates as "YYYY-MM-DD HH:MM:SS.sssZ"; make them Date-parseable.
function parseUTC(s) {
  return new Date(String(s).replace(" ", "T"));
}

// SPEC §2.1 — advance from the previous fire time, never from Date.now().
function computeNext(base, n, unit) {
  const d = new Date(base.getTime());
  switch (unit) {
    case "minutes":
      d.setUTCMinutes(d.getUTCMinutes() + n);
      break;
    case "hours":
      d.setUTCHours(d.getUTCHours() + n);
      break;
    case "days":
      d.setUTCDate(d.getUTCDate() + n);
      break;
    case "weeks":
      d.setUTCDate(d.getUTCDate() + n * 7);
      break;
    case "months":
      d.setUTCMonth(d.getUTCMonth() + n);
      break;
  }
  return d;
}

// goja has no btoa and $security has no base64 helper (Phase 0 finding).
function b64encode(str) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < str.length; i += 3) {
    const c1 = str.charCodeAt(i);
    const c2 = i + 1 < str.length ? str.charCodeAt(i + 1) : NaN;
    const c3 = i + 2 < str.length ? str.charCodeAt(i + 2) : NaN;
    const e1 = c1 >> 2;
    const e2 = ((c1 & 3) << 4) | (isNaN(c2) ? 0 : c2 >> 4);
    const e3 = isNaN(c2) ? 64 : ((c2 & 15) << 2) | (isNaN(c3) ? 0 : c3 >> 6);
    const e4 = isNaN(c3) ? 64 : c3 & 63;
    out +=
      chars.charAt(e1) +
      chars.charAt(e2) +
      (e3 === 64 ? "=" : chars.charAt(e3)) +
      (e4 === 64 ? "=" : chars.charAt(e4));
  }
  return out;
}

// SPEC §3 — POST {base_url}/{topic}. Throws on any failure.
function sendNtfy(config, reminder) {
  const baseUrl = config.getString("base_url").replace(/\/+$/, "");
  const topic = config.getString("topic");
  if (baseUrl === "" || topic === "") {
    throw new Error("ntfy_config has empty base_url or topic");
  }

  const headers = {
    Title: reminder.getString("title"),
    Priority: String(reminder.getInt("priority") || 3),
  };

  const authType = config.getString("auth_type");
  if (authType === "token") {
    headers["Authorization"] = "Bearer " + config.getString("token");
  } else if (authType === "basic") {
    headers["Authorization"] =
      "Basic " +
      b64encode(
        config.getString("username") + ":" + config.getString("password")
      );
  }

  const res = $http.send({
    url: baseUrl + "/" + topic,
    method: "POST",
    body: reminder.getString("message"),
    headers: headers,
    timeout: 15,
  });

  if (res.statusCode >= 400) {
    throw new Error("ntfy returned HTTP " + res.statusCode + ": " + res.raw);
  }
}

// SPEC §4 — shared create/update validation.
function validateReminder(record) {
  if (record.getString("title").trim() === "") {
    throw new BadRequestError("title is required");
  }
  if (record.getString("message").trim() === "") {
    throw new BadRequestError("message is required");
  }
  if (record.getInt("interval_n") < 1) {
    throw new BadRequestError("interval_n must be at least 1");
  }
  const priority = record.getInt("priority");
  if (priority < 1 || priority > 5) {
    throw new BadRequestError("priority must be between 1 and 5");
  }
  if (
    record.getString("repeat_mode") === "count" &&
    record.getInt("repeat_count") < 1
  ) {
    throw new BadRequestError(
      "repeat_count must be at least 1 when repeat_mode is count"
    );
  }
}

module.exports = {
  parseUTC: parseUTC,
  computeNext: computeNext,
  b64encode: b64encode,
  sendNtfy: sendNtfy,
  validateReminder: validateReminder,
};
