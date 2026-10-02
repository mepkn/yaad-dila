import type { TokenStorage } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import * as SecureStore from "expo-secure-store";

const url = process.env.EXPO_PUBLIC_CONVEX_URL;
if (!url) throw new Error("EXPO_PUBLIC_CONVEX_URL is not set. Run `npx convex dev` first.");

export const convex = new ConvexReactClient(url, { unsavedChangesWarning: false });

// SecureStore keys allow only [A-Za-z0-9._-]; Convex Auth keys include the URL.
const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, "_");

export const secureTokenStorage: TokenStorage = {
  getItem: (key) => SecureStore.getItemAsync(safeKey(key)),
  setItem: (key, value) => SecureStore.setItemAsync(safeKey(key), value),
  removeItem: (key) => SecureStore.deleteItemAsync(safeKey(key)),
};
