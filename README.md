# Yaad Dila

Self-hosted recurring reminder app. Create reminders on your phone; your own server
delivers them as push notifications via [ntfy](https://ntfy.sh) — no Google/Apple push
services, no third-party cloud.

*Yaad Dila* (याद दिला) is Hindi for "remind me".

## How it works

```
React Native app (Expo)  →  PocketBase  →  your ntfy server  →  your device
     CRUD only              DB + auth +
                            cron + sender
```

- **PocketBase is the entire backend** — database, auth, REST API, cron scheduler, and
  ntfy sending in one binary. Server logic lives in `pb_hooks` (JavaScript on goja).
- **The app never schedules anything.** It is a CRUD frontend; a single server-side
  cron job ticks every minute and fires whatever is due.
- Tapping a notification deep-links straight to that reminder's detail screen.

## Features

- Recurring reminders: every N minutes / hours / days / weeks / months
- Repeat modes: once, forever, or a fixed number of times
- Per-reminder priority, pause/resume, and last-send-error surfacing
- Multi-user with per-user isolation (PocketBase API rules)
- Bring-your-own ntfy server, with token or basic auth (stored in secure storage on device)
- i18n (English + Hindi), light/dark theme
- All timestamps stored in UTC; schedules never drift (next fire is computed from the
  previous fire time, not from "now")

## Stack

| Layer | Tech |
|---|---|
| App | Expo (React Native), Expo Router, [React Native Reusables](https://reactnativereusables.com) + NativeWind |
| Backend | [PocketBase](https://pocketbase.io) with custom `pb_hooks` |
| Delivery | [ntfy](https://ntfy.sh) (self-hosted) |
| Packaging | Docker image for the backend, EAS builds for the Android APK |

## Repo layout

```
app/                     Expo app (deployable unit 1)
backend/                 PocketBase image (deployable unit 2, Docker build context)
  pb_hooks/              server logic — cron tick + ntfy sender
  pb_migrations/         collection schema
deploy/yaad-dila-prod/   production compose stack (image tag bumped by CI)
.github/workflows/       backend image build + compose bump on main
```

`SPEC.md` documents the data model and scheduling algorithm; `PHASES.md` the build
order and completion gates.

## Local development

Backend:

```bash
cd backend
./pocketbase serve        # download the PocketBase binary here first
```

App (dev client on a physical device — no Expo Go):

```bash
cd app
npm install
npm run dev:usb           # USB/adb mode: Metro + PocketBase over adb reverse
# or
npm run dev               # Wi-Fi mode: phone and machine on the same network
```

`app/.env` sets `EXPO_PUBLIC_POCKETBASE_URL` (`http://localhost:8090` for USB mode,
`http://<your-LAN-IP>:8090` for Wi-Fi mode; see `.env.example`). Production builds
bake their URL from `eas.json`.

## Builds

- `npm run build:dev` — development client APK (rebuild only after native changes)
- `npm run build:prod` — production APK
- Merges to `main` touching `app/**` also auto-build the production APK via an EAS
  workflow.

## Deployment

Pushes to `main` touching `backend/**` trigger CI to build the backend Docker image,
push it to ghcr, and commit the new image tag into `deploy/yaad-dila-prod/compose.yaml`.
The stack runs PocketBase on a loopback port behind a Cloudflare Tunnel; redeploying is
a pull + restart of the compose stack.
