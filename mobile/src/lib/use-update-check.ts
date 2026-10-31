import type { TFunction } from "i18next";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";
import { checkForUpdate, currentCommit, deleteDownloadedUpdates, installUpdate } from "./update";

/** Checks for a new release; manual (from Settings) also reports "up to date" and errors. */
export async function runUpdateCheck(t: TFunction, manual: boolean): Promise<void> {
  try {
    const result = await checkForUpdate();
    if (result.kind === "available") {
      Alert.alert(t("update.availableTitle"), t("update.availableMessage", { tag: result.tag, current: currentCommit }), [
        { text: t("update.later"), style: "cancel" },
        {
          text: t("update.install"),
          onPress: () => {
            installUpdate(result.url).catch((e: unknown) =>
              Alert.alert(t("update.failedTitle"), e instanceof Error ? e.message : String(e)),
            );
          },
        },
      ]);
    } else if (manual) {
      Alert.alert(
        t(result.kind === "dev" ? "update.devTitle" : "update.upToDateTitle"),
        t(result.kind === "dev" ? "update.devMessage" : "update.upToDateMessage", { current: currentCommit }),
      );
    }
  } catch (e) {
    if (manual) Alert.alert(t("update.failedTitle"), e instanceof Error ? e.message : String(e));
  }
}

/** On launch: delete the APK an earlier update left, then look for a new one. */
export function useUpdateCheck(): void {
  const { t } = useTranslation();
  useEffect(() => {
    deleteDownloadedUpdates();
    void runUpdateCheck(t, false);
    // Once per launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
