import { ConvexError } from "convex/values";
import type { TFunction } from "i18next";

// Server error codes live under several namespaces; the first match wins.
const NAMESPACES = ["errors", "form.errors", "tags.errors", "auth.errors"];

function translateCode(t: TFunction, code: string): string | undefined {
  for (const ns of NAMESPACES) {
    const key = `${ns}.${code}`;
    const text = t(key);
    if (text !== key) return text;
  }
  return undefined;
}

export function errorCode(error: unknown): string | undefined {
  if (error instanceof ConvexError && typeof error.data === "string") return error.data;
  return undefined;
}

export function errorMessage(t: TFunction, error: unknown): string {
  const code = errorCode(error);
  if (code) return translateCode(t, code) ?? t("common.somethingWentWrong");
  return t("common.somethingWentWrong");
}

// Convex Auth reports bad credentials and duplicate accounts as plain errors.
export function authErrorMessage(t: TFunction, error: unknown, flow: "signIn" | "signUp"): string {
  const code = errorCode(error);
  if (code) return translateCode(t, code) ?? t("common.somethingWentWrong");
  const message = error instanceof Error ? error.message : "";
  if (/already exists/i.test(message)) return t("auth.errors.accountExists");
  if (flow === "signIn" && /InvalidAccountId|InvalidSecret|Invalid credentials/i.test(message)) {
    return t("auth.errors.invalidCredentials");
  }
  // Production hides plain error text ("Server Error"). Validation failures are
  // ConvexErrors handled above, so a remaining sign-up failure is a taken email.
  return flow === "signIn" ? t("auth.errors.invalidCredentials") : t("auth.errors.accountExists");
}

// reminders.lastError is either "noDevices" or a raw Expo error message.
export function lastErrorMessage(t: TFunction, lastError: string): string {
  if (lastError === "noDevices") return t("errors.noDevices");
  return t("errors.pushFailed", { detail: lastError });
}
