# Yaad Dila — Build Spec

Build "Yaad Dila" (याद दिला — Hindi for "remind me"), a recurring-reminder mobile app,
using Expo + Convex + expo-notifications.

## Stack
- Expo (latest SDK), Expo Router, TypeScript, NativeWind, React Native Reusables
- Component layering: React Native Reusables primitives live in components/ui/; screens never
  import them directly — each primitive is wrapped by an app-owned Cmp* component in
  components/cmp/cmp-*.tsx
- Keyboard: `react-native-keyboard-controller`, with `KeyboardProvider` at the root.
  - Form screens use `CmpKeyboardAwareScrollView`, which scrolls the focused field above the keyboard.
  - A full-height editor with a bottom bar uses `CmpKeyboardPadding`.
  - Dialogs rise by half the keyboard height (in `components/ui/dialog.tsx`).
  - Lists with a search box at the top, and screens without inputs, need nothing.
  - No fixed offsets such as `mb-[40vh]`, no RN `KeyboardAvoidingView`, no bottom sheets.
- Convex Cloud as the entire backend (database, auth, scheduling, push sending)
- Convex Auth with email + password; auth tokens stored in expo-secure-store
- expo-notifications + Expo Push Service (FCM on Android)
- Android first; use a development build / EAS (remote push does not work in Expo Go)

## Data model (camelCase, Convex conventions)
- reminders: userId, title (required), message (required), note (optional), tagIds,
  intervalCount (int ≥ 1), intervalUnit (minutes | hours | days | weeks | months),
  repeatMode (once | forever | count), repeatTimes (only for count), firedCount,
  startAt, nextFireAt, lastFiredAt, active, lastError (optional), scheduledFnId (optional)
- tags: userId, name (unique per user)
- pushTokens: userId, token, deviceName
- Timestamps are UTC milliseconds; convert to local time only for display.
- Use Convex's built-in _id and _creationTime; no manual created/updated fields.
- Index every query; no full-table scans.

## Scheduling rules (most important part — get these exactly right)
- A reminder fires every intervalCount intervalUnits, starting at startAt.
- once: fires one time, then becomes inactive. count: fires repeatTimes times, then inactive.
  forever: never ends.
- Compute the next fire time from the previous scheduled fire time, not from the current
  clock, so a late run never shifts the schedule. Month intervals use calendar months
  (Jan 31 + 1 month → end of February).
- Each reminder schedules its own next run with ctx.scheduler.runAt(nextFireAt) and stores
  scheduledFnId. Editing, pausing or deleting cancels the pending run; resuming or editing
  reschedules it. Resuming a paused reminder skips missed fire times and schedules the next
  future one. No cron jobs.
- If a push fails (no registered device, Expo error), the schedule still advances and the
  reason is saved in lastError and shown on the reminder; a successful send clears it.

## Backend (convex/)
- Read convex/_generated/ai/guidelines.md first and follow it.
- Every public query/mutation gets the user via getAuthUserId and checks ownership of every
  document it touches. Never accept a userId argument from the client.
- Validate all arguments with validators; enforce the rules above server-side.
- fire: an internal action that sends to all of the user's push tokens via the Expo push API
  (title, message, channelId, data: { reminderId }), then an internal mutation records
  lastFiredAt / firedCount / lastError, computes nextFireAt and schedules the next run (or
  deactivates the reminder).
- Delete push tokens that Expo reports as DeviceNotRegistered.

## App
- Auth screens: sign up, log in, log out.
- On login: request notification permission, create one Android notification channel
  ("reminders", high importance), register the Expo push token with Convex; remove it on logout.
- Tapping a notification deep-links to that reminder's detail/edit screen.
- Reminders tab: live list with search, status filter (active / paused / finished), and cards
  showing title, schedule summary, next fire time, fired count, and lastError if any.
  Pause/resume from the list. Floating add button.
- Reminder form: title, message, note, tags (pick existing or create), start date/time,
  interval count + unit, repeat mode + times.
- Tags tab: tags with reminder counts; rename and delete.
- Settings: account (email, log out), notification permission status + "send test
  notification" (through Convex), appearance (light / dark / system), language
  (English / Hindi / follow device), voice AI key.
- Voice reminders: the user speaks or types a sentence (e.g. "remind me to drink water every
  2 hours from 9am, 5 times") and Google Gemini (model alias gemini-flash-latest) parses it into
  the reminder fields to prefill the form. The user's own Gemini API key is stored on the device
  in secure storage; the app calls Gemini directly and the backend is never involved.
- Full English + Hindi translations for all strings.

## Process
1. Before coding, summarise your understanding and plan, and ask me about anything ambiguous.
2. Build in small steps: Convex schema + auth → reminder CRUD → scheduler + push → app screens
   → notifications and deep links → tags → voice AI → i18n and theme polish.
3. Run tsc (app and convex) and lint after each step. Write convex-test tests for the
   scheduling math (next fire, each repeat mode, month edge cases, resume skips missed times,
   failure still advances) and for authz (a user cannot read or modify another user's
   reminders or tags).
4. Write a README covering the architecture (Expo app → Convex → Expo Push → device), Convex
   setup, FCM credentials in EAS, and building a dev build.
5. Don't add Co-Authored-By trailers to commits.
