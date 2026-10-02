import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { api } from "@convex/_generated/api";
import {
  deviceName,
  getPermission,
  getPushToken,
  requestPermission,
  type PermissionState,
  type PushTokenResult,
} from "./notifications";

// The token this device registered, so logout can remove exactly that one.
const REGISTERED_TOKEN_KEY = "push.registeredToken";

type PushState = {
  permission: PermissionState | null;
  token: PushTokenResult | null;
  requestAndRegister: () => Promise<void>;
};

const PushContext = createContext<PushState | null>(null);

// Mounted only while signed in: asks for permission, creates the channel and
// registers this device's Expo push token with Convex.
export function PushProvider({ children }: { children: ReactNode }) {
  const register = useMutation(api.pushTokens.register);
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [token, setToken] = useState<PushTokenResult | null>(null);

  const sync = useCallback(
    async (ask: boolean) => {
      const status = ask ? await requestPermission() : await getPermission();
      const result = await getPushToken();
      if (result.kind === "token") {
        try {
          await register({ token: result.token, deviceName: deviceName() });
          await SecureStore.setItemAsync(REGISTERED_TOKEN_KEY, result.token);
        } catch {
          // Retried on next foreground.
        }
      }
      return { status, result };
    },
    [register],
  );

  useEffect(() => {
    let cancelled = false;
    const apply = (ask: boolean) =>
      sync(ask).then(({ status, result }) => {
        if (cancelled) return;
        setPermission(status);
        setToken(result);
      });
    void apply(true);
    // Permission can change in system settings while the app is backgrounded.
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void apply(false);
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [sync]);

  const requestAndRegister = useCallback(async () => {
    const { status, result } = await sync(true);
    setPermission(status);
    setToken(result);
  }, [sync]);

  return (
    <PushContext.Provider value={{ permission, token, requestAndRegister }}>
      {children}
    </PushContext.Provider>
  );
}

export function usePush(): PushState {
  const value = useContext(PushContext);
  if (!value) throw new Error("usePush must be used inside PushProvider");
  return value;
}

// Removes this device's push token from Convex, then signs out.
export function useLogOut(): () => Promise<void> {
  const { signOut } = useAuthActions();
  const unregister = useMutation(api.pushTokens.unregister);
  return useCallback(async () => {
    const token = await SecureStore.getItemAsync(REGISTERED_TOKEN_KEY);
    if (token) {
      try {
        await unregister({ token });
      } catch {
        // Signing out matters more. Whoever signs in next on this device takes
        // the token over (pushTokens.register).
      }
      await SecureStore.deleteItemAsync(REGISTERED_TOKEN_KEY);
    }
    await signOut();
  }, [signOut, unregister]);
}
