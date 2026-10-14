# Yaad Dila (याद दिला)

"Remind me" in Hindi. A recurring-reminder app for Android with push notifications,
voice input and English/Hindi, built with Expo and Convex.

Platform: Android (sideloaded APK; Play Store later).

## Features

- Reminders that repeat every N minutes, hours, days, weeks or months: once, forever, or a set number of times.
- Push notifications that keep firing on schedule. Tapping one opens its reminder.
- Pause, resume, edit and delete. Active / Paused / Finished lists, paginated on the server.
- Tags to group reminders; tap a tag to see all its reminders.
- A Search tab that searches every reminder's title, message and note on the server.
- Voice reminders: say "remind me to drink water every 2 hours from 9am, 5 times" and the form is filled in (Google Gemini with your own API key).
- English and Hindi. Light, dark or system theme.

## Stack

Expo (SDK 57) · Expo Router · TypeScript · NativeWind + React Native Reusables ·
Convex (database, auth, scheduler, push sending) · Convex Auth · expo-notifications +
Expo Push (FCM) · Google Gemini · i18next.

## Development

Requires Node 22.18+ (`.nvmrc` pins 22).

### 1. Install and run Convex locally

```sh
cd backend
npm install               # convex, tests
printf 'EXPO_PUBLIC_CONVEX_URL=\nEXPO_PUBLIC_CONVEX_SITE_URL=\n' > .env.local   # first time only
npm run dev               # npx convex dev; first run: choose a local deployment
cd ../mobile && npm install   # the app has its own node_modules
```

This writes `EXPO_PUBLIC_CONVEX_URL` to `backend/.env.local` (the empty line tells it the name; Expo
isn't in `backend/`, so it would otherwise write `CONVEX_URL`). It's the only dev env file: the app's
`start`/`android` scripts read it. Keep `convex dev` running; it redeploys whenever `backend/convex/` changes.

> **Phone vs. local backend:** `127.0.0.1` on a phone is the phone itself.
> - **Android emulator:** set `EXPO_PUBLIC_CONVEX_URL=http://10.0.2.2:3210`.
> - **USB device:** run `adb reverse tcp:3210 tcp:3210` and `adb reverse tcp:3211 tcp:3211`.
> - **Device on the same Wi-Fi:** use your computer's LAN IP.
>
> Restart Metro after changing `backend/.env.local`.

### 2. Configure Convex Auth (once per deployment)

In `backend/`:

```sh
npx @convex-dev/auth      # interactive: generates JWT_PRIVATE_KEY + JWKS
npx convex env set SITE_URL yaaddila://
npx convex env set ALLOWED_EMAILS you@example.com   # comma-separated; nobody else can sign up or sign in
```

`ALLOWED_EMAILS` fails closed: if it's unset, every sign-up, sign-in and API call is refused.

If you enable "Enhanced security for push notifications" in the Expo project, also set
`npx convex env set EXPO_ACCESS_TOKEN <token>`.

### 3. Development build

Remote push doesn't work in Expo Go, so the app runs as a development build:

In `mobile/`:

```sh
npm run android                  # build and install the dev client on a USB phone
npm start                        # Metro; don't use CI=1, it turns off reloads
```

After you sign in, the app creates the high-importance `reminders` notification channel,
asks for notification permission, and registers the device's Expo push token with Convex.
Logging out removes the token. **Settings → Send test notification** checks the whole path:
Convex → Expo Push → FCM → device.

## Scripts

No root `package.json`: run each part's scripts in its folder.

| Command | What it does |
|---|---|
| `scripts/check.sh` | Every part's checks (backend, then mobile). Run before committing |
| `scripts/deploy-backend.sh` | Checks, then deploys `backend/convex/` to production (`DRY_RUN=1` previews) |
| `scripts/build-android.sh preview local` | Installable APK, built on this Mac into `mobile/dist/` (`cloud` builds on EAS) |
| `scripts/build-android.sh production cloud` | Play Store AAB on EAS cloud (version code auto-increments); `local` builds into `mobile/dist/` |
| `scripts/eas.sh <args>` | Any `eas` command as the personal account, e.g. `submit --platform android --profile production` |
| `backend/`: `npm run dev` | Local Convex backend with hot reload |
| `backend/`: `npm run typecheck` / `lint` / `test` | Backend typecheck, ESLint, convex-test (scheduling math, fire flow, authz) |
| `backend/`: `npm run check` | All three |
| `mobile/`: `npm start` | Metro for the development build |
| `mobile/`: `npm run android` | Build and install the development build on a USB phone |
| `mobile/`: `npm run check` | App typecheck and lint |
| `mobile/`: `npm run icons` | Regenerate the app icon and splash images |

## Deployment

The app is two parts. The backend is the Convex production deployment `formal-setter-463`
(`https://formal-setter-463.convex.cloud`). The Android app is built with EAS (`@mepkn/yaad-dila`).

### One-time setup (already done)

- `backend/.env.prod.local` (git-ignored) holds `CONVEX_DEPLOY_KEY=prod:...` (dashboard → Settings → Deploy key). See `backend/.env.example`.
- `mobile/.eas-token` (git-ignored, see `mobile/.env.example`) holds `export EXPO_TOKEN=...` for the personal Expo account. The scripts read it, so your global `eas` login is never used or changed.
- On the production Convex deployment, `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL=yaaddila://` and `ALLOWED_EMAILS` are set.
- The EAS environments `preview` and `production` have `EXPO_PUBLIC_CONVEX_URL=https://formal-setter-463.convex.cloud`.

### Backend

```sh
scripts/deploy-backend.sh        # checks, then npx convex deploy to production
```

Run it whenever `backend/convex/` changes.

### Android

#### Push credentials (FCM)

1. In the [Firebase console](https://console.firebase.google.com), add an Android app
   `com.pknspace.yaaddila`. Its `google-services.json` is committed in `mobile/`
   and referenced from `mobile/app.json`.
2. In Firebase, go to Project settings → Service accounts and click **Generate new private key**.
3. Run `scripts/eas.sh credentials`, then choose Android → **Google Service Account** →
   **FCM V1** and upload the JSON. Don't commit that key.

#### Preview (APK)

```sh
scripts/build-android.sh preview local   # or `preview cloud` to build on EAS
adb uninstall com.pknspace.yaaddila   # first time: remove the development build
adb install -r mobile/dist/yaad-dila-preview-*.apk
```

A release build bundles the JavaScript and talks to the production backend. It doesn't need
Metro or `convex dev`, and it has no dev menu. It's signed with the EAS release keystore,
which is why the development build has to be uninstalled first.

#### Production (Play Store, later)

`scripts/build-android.sh production cloud` builds an AAB. Before the first release you need a
Google Play developer account, a store listing, a privacy policy and the Data safety form.
The first upload is done by hand in the Play Console; after that, `scripts/eas.sh submit --platform android --profile production`
uploads new builds.

## How it works

```
┌──────────────┐  queries/mutations   ┌──────────────────────────────┐
│  Expo app    │ ───────────────────▶ │  Convex                      │
│  (Android)   │ ◀─── live updates ── │  db · auth · scheduler       │
│              │                      │                              │
│  registers   │                      │  reminder ──runAt(next)──▶   │
│  push token  │                      │  fire (internal action)      │
└──────▲───────┘                      └──────────────┬───────────────┘
       │ notification                                │ POST /push/send
       │ (tap → /reminder/:id)                       ▼
┌──────┴───────┐        FCM           ┌──────────────────────────────┐
│   Device     │ ◀─────────────────── │  Expo Push Service           │
└──────────────┘                      └──────────────────────────────┘
```

- **The app** (`mobile/src/`, its own `package.json`) uses Expo Router, NativeWind and React Native Reusables. The RNR primitives live in `mobile/src/components/ui/`, and screens only use the app's own wrappers in `mobile/src/components/cmp/cmp-*.tsx`.
- **Convex** (`backend/convex/`, its own `package.json`) is the entire backend.
  - `schema.ts`: `reminders`, `tags`, `pushTokens`, plus the Convex Auth tables. `reminderTags` is a join table that mirrors `reminders.tagIds`, so that tag counts and tag deletion are index lookups.
  - `auth.ts`: Convex Auth with the Password provider. Only emails in `ALLOWED_EMAILS` can sign up or sign in, and `requireUserId` re-checks the list on every call, so removing an email also ends that user's sessions. The app keeps its tokens in `expo-secure-store`.
  - `reminders.ts` and `tags.ts`: the public API. Every function gets the user from `getAuthUserId` and checks that the user owns every document it touches.
  - `fire.ts`: the scheduled `fire` action, then `recordFire`.
  - `lib/schedule.ts`: the scheduling math as pure functions. The app imports it too.
- **Scheduling.** There are no cron jobs. Each active reminder has exactly one pending `ctx.scheduler.runAt(nextFireAt, internal.fire.fire)` run, and its id is stored in `scheduledFnId`.
  - **Firing.** `fire` sends to every token the user has (title, message, `channelId: "reminders"`, `data.reminderId`). `recordFire` then increments `firedCount`, sets `lastFiredAt` and `lastError`, computes the next time, and schedules it or deactivates the reminder.
  - **Next fire time.** Occurrence *k* is `startAt + k × interval`, always counted from `startAt`. A late run therefore never shifts the schedule, and month steps don't drift: Jan 31 → Feb 28 → Mar 31.
  - **Units and time zones.** Minutes and hours are exact durations. Days, weeks and months follow the local calendar of the reminder's `timeZone`, which is the IANA zone the device sent when the reminder was saved.
  - **Edit, pause, resume, delete.** Editing, pausing and deleting cancel the pending run. Resuming and editing schedule the first occurrence that hasn't passed yet; missed occurrences are skipped and don't count toward `repeatTimes`.
  - **Failures.** If no device is registered or Expo returns an error, the schedule still advances and the reason goes into `lastError`. The next successful send clears it. Tokens that Expo reports as `DeviceNotRegistered` are deleted.
- **Voice.** On-device speech-to-text (`expo-speech-recognition`) produces text, and typed text works too. The app sends that text straight to Gemini (`gemini-flash-latest`) with the user's own API key, which is kept in SecureStore. The backend is never involved.
