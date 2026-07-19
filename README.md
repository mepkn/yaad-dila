# Yaad Dila

Self-hosted recurring reminder app. Create reminders on your phone; your own server
delivers them as push notifications via [ntfy](https://ntfy.sh) — no Google/Apple push
services, no third-party cloud, your data stays on your infrastructure.

*Yaad Dila* (याद दिला) is Hindi for "remind me".

## Architecture

```
React Native app (Expo)  →  PocketBase  →  your ntfy server  →  your device
     CRUD only              DB + auth +
                            cron + sender
```

The design principle is a thin client and a single-binary backend:

- **PocketBase is the entire backend** — database, auth, REST API, cron scheduler, and
  ntfy delivery in one binary. Server logic lives in `pb_hooks` (JavaScript hooks).
- **The app never schedules anything.** It only creates, edits, and deletes reminder
  records. One server-side cron job ticks every minute, finds every reminder whose fire
  time has arrived, publishes it to that user's ntfy server, and computes the next
  fire time.
- **ntfy does the last mile.** The ntfy Android app maintains the connection to your
  ntfy server and raises the system notification — the reminder app doesn't need to be
  running, or even on the same network as the backend.

### Scheduling model

- A reminder is "every N minutes / hours / days / weeks / months", starting at a
  chosen date and time.
- Repeat modes: fire **once**, **forever**, or a fixed **count** of times.
- The next fire time is always computed from the previous fire time, never from the
  current clock — schedules don't drift when a tick runs late.
- All timestamps are stored in UTC and converted to local time only for display.
- If a send fails (ntfy down, bad credentials), the schedule still advances and the
  error is stored on the reminder, where the app surfaces it.

## Features

- Recurring reminders with the interval/repeat model above
- Per-reminder title, message, and ntfy priority
- Pause and resume from the reminder list
- Tapping a notification deep-links to that reminder's detail screen
- Multi-user: PocketBase auth with per-user data isolation enforced by API rules
- Bring-your-own ntfy server with token or username/password auth; a test button
  verifies the config, and credentials live in the device's secure storage
- English and Hindi UI, following the device language with an in-app override
- Light and dark theme

## Tech stack

| Layer | Tech |
|---|---|
| App | Expo (React Native), Expo Router, [React Native Reusables](https://reactnativereusables.com), NativeWind |
| Backend | [PocketBase](https://pocketbase.io) with custom `pb_hooks` |
| Delivery | [ntfy](https://ntfy.sh) (self-hosted) |
| Packaging | Docker image for the backend, EAS builds for the Android APK |

## Repository layout

```
app/                     Expo app (deployable unit 1)
backend/                 PocketBase backend (deployable unit 2, Docker build context)
  Dockerfile             pinned PocketBase base image + baked hooks and migrations
  pb_hooks/              server logic — cron tick, ntfy sender, validation
  pb_migrations/         collection schema
deploy/yaad-dila-prod/   production compose stack (image tag bumped by CI)
.github/workflows/       backend image build + compose bump on pushes to main
```

## Development

### Prerequisites

- Node.js and an Android device with the app's development client installed
  (physical device; Expo Go is not used)
- The [PocketBase](https://pocketbase.io/docs/) binary downloaded into `backend/`
- Optionally a reachable ntfy server to actually receive notifications

### Backend

```bash
cd backend
./pocketbase serve                      # USB mode (loopback is enough)
./pocketbase serve --http=0.0.0.0:8090  # Wi-Fi mode (bind the LAN)
```

Hooks and migrations are picked up from `pb_hooks/` and `pb_migrations/`
automatically.

### App

```bash
cd app
npm install
npm run dev:usb   # USB/adb mode — no Wi-Fi needed; sets up adb reverse for Metro + PocketBase
npm run dev       # Wi-Fi mode — phone and machine on the same network
```

`app/.env` (see `.env.example`) sets `EXPO_PUBLIC_POCKETBASE_URL`:
`http://localhost:8090` for USB mode, `http://<your-LAN-IP>:8090` for Wi-Fi mode.
This only affects development — production builds bake their URL from `eas.json`.

### Builds

| Command | What it does |
|---|---|
| `npm run build:dev` | Development client APK — needed only after native changes |
| `npm run build:prod` | Production APK with the production backend URL baked in |

Merges to `main` that touch `app/**` also build the production APK automatically via
an EAS workflow.

## Deployment

Pushes to `main` that touch `backend/**` trigger CI to build the backend Docker image,
push it to GitHub Container Registry, and commit the new image tag into
`deploy/yaad-dila-prod/compose.yaml` — the compose file is the deployable artifact,
and redeploying is a pull + restart of that stack. In production, PocketBase listens
on a loopback port behind a Cloudflare Tunnel; nothing is exposed directly to the
internet.
