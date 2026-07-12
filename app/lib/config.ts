// PocketBase server URL. Configure via env — never hardcode in a screen.
// Set EXPO_PUBLIC_POCKETBASE_URL in .env (or the shell) to override.
export const POCKETBASE_URL =
  process.env.EXPO_PUBLIC_POCKETBASE_URL ?? 'http://127.0.0.1:8099';
