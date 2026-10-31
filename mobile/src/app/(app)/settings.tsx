import { useAction, useQuery } from "convex/react";
import { Bell, LogOut, Send } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Linking, View } from "react-native";
import { api } from "@convex/_generated/api";
import { CmpButton } from "@/components/cmp/cmp-button";
import { CmpCard, CmpCardContent, CmpCardHeader, CmpCardTitle } from "@/components/cmp/cmp-card";
import { CmpKeyboardAwareScrollView } from "@/components/cmp/cmp-keyboard-aware-scroll-view";
import { CmpSegmented } from "@/components/cmp/cmp-segmented";
import { CmpSeparator } from "@/components/cmp/cmp-separator";
import { CmpText } from "@/components/cmp/cmp-text";
import { errorMessage, lastErrorMessage } from "@/lib/errors";
import type { LanguagePref } from "@/lib/i18n";
import { usePreferences, type ThemePref } from "@/lib/preferences";
import { useLogOut, usePush } from "@/lib/push";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <CmpCard>
      <CmpCardHeader>
        <CmpCardTitle>{title}</CmpCardTitle>
      </CmpCardHeader>
      <CmpCardContent className="gap-3">{children}</CmpCardContent>
    </CmpCard>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="gap-0.5">
      <CmpText variant="muted">{label}</CmpText>
      <CmpText>{value}</CmpText>
    </View>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const me = useQuery(api.users.me);
  const logOut = useLogOut();
  const { permission, token, requestAndRegister } = usePush();
  const sendTest = useAction(api.pushTokens.sendTest);
  const { theme, setTheme, language, setLanguage } = usePreferences();
  const [testResult, setTestResult] = useState<string>();
  const [testing, setTesting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  async function test() {
    setTesting(true);
    setTestResult(undefined);
    try {
      const result = await sendTest({
        title: t("settings.testTitle"),
        message: t("settings.testMessage"),
      });
      setTestResult(
        result.error && result.delivered === 0
          ? lastErrorMessage(t, result.error)
          : t("settings.testSent", { n: result.delivered }),
      );
    } catch (e) {
      setTestResult(errorMessage(t, e));
    } finally {
      setTesting(false);
    }
  }

  const permissionText =
    permission === "granted"
      ? t("settings.permissionGranted")
      : permission === "denied"
        ? t("settings.permissionDenied")
        : t("settings.permissionUndetermined");

  const deviceText =
    token?.kind === "token"
      ? t("settings.deviceRegistered")
      : token?.kind === "notConfigured"
        ? t("settings.pushNotConfigured")
        : token?.kind === "unavailable"
          ? t("settings.pushUnavailable")
          : t("settings.deviceNotRegistered");

  return (
    <CmpKeyboardAwareScrollView
      className="bg-background flex-1"
      contentContainerClassName="gap-4 p-4 pb-12">
      <Section title={t("settings.account")}>
        <Row label={t("settings.signedInAs")} value={me?.email ?? "…"} />
        <CmpButton
          variant="outline"
          icon={LogOut}
          label={t("auth.logOut")}
          loading={loggingOut}
          onPress={async () => {
            setLoggingOut(true);
            try {
              await logOut();
            } finally {
              setLoggingOut(false);
            }
          }}
        />
      </Section>

      <Section title={t("settings.notifications")}>
        <Row label={t("settings.permission")} value={permissionText} />
        <Row label={t("settings.device")} value={deviceText} />
        {permission === "undetermined" && (
          <CmpButton icon={Bell} label={t("settings.allow")} onPress={requestAndRegister} />
        )}
        {permission === "denied" && (
          <CmpButton
            variant="outline"
            label={t("settings.openSettings")}
            onPress={() => void Linking.openSettings()}
          />
        )}
        <CmpSeparator />
        <CmpButton
          variant="secondary"
          icon={Send}
          label={t("settings.sendTest")}
          loading={testing}
          onPress={test}
        />
        {testResult && <CmpText variant="muted">{testResult}</CmpText>}
      </Section>

      <Section title={t("settings.appearance")}>
        <CmpSegmented<ThemePref>
          value={theme}
          onChange={setTheme}
          options={(["light", "dark", "system"] as const).map((value) => ({
            value,
            label: t(`settings.themes.${value}`),
          }))}
        />
      </Section>

      <Section title={t("settings.language")}>
        <CmpSegmented<LanguagePref>
          value={language}
          onChange={setLanguage}
          options={(["en", "hi", "system"] as const).map((value) => ({
            value,
            label: t(`settings.languages.${value}`),
          }))}
        />
      </Section>
    </CmpKeyboardAwareScrollView>
  );
}
