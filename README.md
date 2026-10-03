# Yaad Dila (याद दिला)

"Remind me" in Hindi. A recurring-reminder app for Android, built with Expo, Convex, and Expo push notifications.

## Architecture

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

- **The app** (`src/`) uses Expo Router, NativeWind and React Native Reusables. The RNR primitives live in `src/components/ui/`, and screens only use the app's own wrappers in `src/components/cmp/cmp-*.tsx`.
- **Convex** (`convex/`) is the entire backend.
  - `schema.ts`: `reminders`, `tags`, `pushTokens`, plus the Convex Auth tables. `reminderTags` is a join table that mirrors `reminders.tagIds`, so that tag counts and tag deletion are index lookups.
  - `auth.ts`: Convex Auth with the Password provider. The app keeps its tokens in `expo-secure-store`.
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

## Development

### 1. Install and run Convex locally

```sh
npm install
npx convex dev            # first run: choose a local deployment (no account needed)
```

This writes `EXPO_PUBLIC_CONVEX_URL` to `.env.local`. Keep it running; it redeploys whenever `convex/` changes.

> **Phone vs. local backend:** `127.0.0.1` on a phone is the phone itself.
> - **Android emulator:** set `EXPO_PUBLIC_CONVEX_URL=http://10.0.2.2:3210`.
> - **USB device:** run `adb reverse tcp:3210 tcp:3210` and `adb reverse tcp:3211 tcp:3211`.
> - **Device on the same Wi-Fi:** use your computer's LAN IP.
>
> Restart Metro after changing `.env.local`.

### 2. Configure Convex Auth (once per deployment)

Convex Auth needs a JWT key pair and a `SITE_URL`:

```sh
npx @convex-dev/auth      # interactive: generates JWT_PRIVATE_KEY + JWKS
npx convex env set SITE_URL yaaddila://
```

### 3. Optional: Expo access token

If you enable "Enhanced security for push notifications" in the Expo project settings, set the token on the deployment:

```sh
npx convex env set EXPO_ACCESS_TOKEN <token>
```

### 4. Checks

```sh
npm run typecheck   # app + convex
npm run lint
npm test            # convex-test: scheduling math, fire flow, authz
```

## Push notifications: FCM credentials in EAS

Remote push doesn't work in Expo Go, so you need a development build. Set it up once:

1. Link the project to EAS:
   ```sh
   npx eas-cli@latest login
   npx eas-cli@latest init        # adds extra.eas.projectId to app.json
   ```
   The app needs `projectId` to get an Expo push token. Until it is set, Settings shows "Push isn't configured".
2. Set up Firebase:
   1. In the [Firebase console](https://console.firebase.google.com), create a project.
   2. Add an Android app with the package name **`com.pknspace.yaaddila`**.
   3. Download `google-services.json` and put it in the project root.
   4. Add `"googleServicesFile": "./google-services.json"` under `expo.android` in `app.json`.
3. Upload the FCM V1 service account key:
   1. In Firebase, go to Project settings → Service accounts and click **Generate new private key**.
   2. Run `npx eas-cli@latest credentials`, then choose Android → development (or production) → **Google Service Account** → **Manage your Google Service Account Key for Push Notifications (FCM V1)**.
   3. Upload the JSON key file. You can also upload it from the Expo dashboard, under Project → Credentials.

Don't commit the service account key. Committing `google-services.json` is common practice, but keep it out of public repositories if you'd rather not publish it.

## Building a development build

```sh
npx eas-cli@latest build --profile development --platform android
```

The first build creates `eas.json` and signing credentials. Install the APK it produces on your phone, then run:

```sh
npx expo start --dev-client
```

To build locally instead, which needs Android Studio and the SDK, run `npx expo run:android`.

After you sign in, the app:
1. creates the high-importance `reminders` notification channel,
2. asks for notification permission,
3. registers the device's Expo push token with Convex.

Logging out removes the token. Use **Settings → Send test notification** to check the whole path: Convex → Expo Push → FCM → device.

## Deployment

Production backend: Convex deployment `formal-setter-463` (`https://formal-setter-463.convex.cloud`).
EAS project: `@mepkn/yaad-dila`.

### One-time setup (already done)

- `.env.prod.local` (git-ignored) holds `CONVEX_DEPLOY_KEY=prod:...` (dashboard → Settings → Deploy key).
- `.eas-token` (git-ignored) holds `export EXPO_TOKEN=...` for the personal Expo account. The scripts source it, so your global `eas` login is never used or changed.
- On the production Convex deployment, `JWT_PRIVATE_KEY`, `JWKS` and `SITE_URL=yaaddila://` are set (`npx convex env list` with the deploy key).
- The EAS environments `preview` and `production` have `EXPO_PUBLIC_CONVEX_URL=https://formal-setter-463.convex.cloud`.
- The FCM V1 service-account key is uploaded in EAS credentials for `com.pknspace.yaaddila`.

### Scripts

| Command | What it does |
|---|---|
| `npm run deploy:backend` | Typechecks and tests `convex/`, then deploys it to production. Run it whenever `convex/` changes. |
| `npm run build:android:preview` | Builds an installable APK on EAS cloud. Download it from the link EAS prints. |
| `npm run build:android:preview:local` | Builds the same APK on this Mac into `dist/` (needs JDK 17 + Android SDK). Install it with `adb install -r dist/<file>.apk`. |
| `npm run build:android:production` | Builds a Play Store AAB on EAS cloud. The version code auto-increments. |
| `npm run build:android:production:local` | Builds the same AAB locally into `dist/`. |
| `npm run submit:android` | Uploads the latest production build to Google Play. The very first upload has to be done by hand in the Play Console. |
| `npm run eas -- <args>` | Runs any other `eas` command as the personal account, e.g. `npm run eas -- credentials`. |

A release build (preview or production) bundles the JavaScript and talks to the production backend. It doesn't need Metro or `convex dev`, and it has no dev menu. It's signed with the EAS release keystore, so uninstall a development build before installing it.

### Typical release

```sh
npm run deploy:backend               # if convex/ changed
npm run build:android:preview:local  # or :preview for a cloud build
adb install -r dist/yaad-dila-preview-*.apk
```
