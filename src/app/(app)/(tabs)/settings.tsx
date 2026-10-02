import { useAction, useQuery } from "convex/react";
import { Bell, LogOut, Send } from "lucide-react-native";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Linking, ScrollView, View } from "react-native";
import { api } from "@convex/_generated/api";
import { CmpButton } from "@/components/cmp/cmp-button";
import { CmpCard, CmpCardContent, CmpCardHeader, CmpCardTitle } from "@/components/cmp/cmp-card";
import { CmpInput } from "@/components/cmp/cmp-field";
import { CmpSegmented } from "@/components/cmp/cmp-segmented";
import { CmpSeparator } from "@/components/cmp/cmp-separator";
import { CmpText } from "@/components/cmp/cmp-text";
import { errorMessage, lastErrorMessage } from "@/lib/errors";
import { getGeminiKey, removeGeminiKey, setGeminiKey } from "@/lib/gemini";
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
  const [hasKey, setHasKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  const [keyMessage, setKeyMessage] = useState<string>();

  useEffect(() => {
    void getGeminiKey().then((key) => setHasKey(!!key));
  }, []);

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

  async function saveKey() {
    await setGeminiKey(keyDraft);
    setKeyDraft("");
    setHasKey(true);
    setKeyMessage(t("settings.voiceKeySaved"));
  }

  async function clearKey() {
    await removeGeminiKey();
    setHasKey(false);
    setKeyMessage(undefined);
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
    <ScrollView
      className="bg-background flex-1"
      contentContainerClassName="gap-4 p-4 pb-12"
      keyboardShouldPersistTaps="handled">
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

      <Section title={t("settings.voiceKey")}>
        <CmpText variant="muted">{t("settings.voiceKeyHint")}</CmpText>
        {hasKey ? (
          <>
            {keyMessage && <CmpText className="text-sm">{keyMessage}</CmpText>}
            <CmpButton variant="outline" label={t("settings.voiceKeyRemove")} onPress={clearKey} />
          </>
        ) : (
          <>
            <CmpInput
              placeholder={t("settings.voiceKeyPlaceholder")}
              value={keyDraft}
              onChangeText={setKeyDraft}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <CmpButton
              label={t("common.save")}
              disabled={keyDraft.trim().length < 10}
              onPress={saveKey}
            />
          </>
        )}
      </Section>
    </ScrollView>
  );
}
