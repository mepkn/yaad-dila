import { useAuthActions } from "@convex-dev/auth/react";
import { Link } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CmpButton } from "@/components/cmp/cmp-button";
import { CmpInput } from "@/components/cmp/cmp-field";
import { CmpKeyboardAwareScrollView } from "@/components/cmp/cmp-keyboard-aware-scroll-view";
import { CmpText } from "@/components/cmp/cmp-text";
import { type AuthStep, authErrorMessage } from "@/lib/errors";

type Flow = "signIn" | "signUp";

// Each step sends one Convex Auth Password flow.
const FLOWS: Record<AuthStep, string> = {
  signIn: "signIn",
  signUp: "signUp",
  verify: "email-verification",
  forgot: "reset",
  reset: "reset-verification",
};

const COPY: Record<AuthStep, { title: string; subtitle: string; submit: string }> = {
  signIn: { title: "auth.signInTitle", subtitle: "auth.signInSubtitle", submit: "auth.logIn" },
  signUp: { title: "auth.signUpTitle", subtitle: "auth.signUpSubtitle", submit: "auth.signUp" },
  verify: { title: "auth.verifyTitle", subtitle: "auth.verifySubtitle", submit: "auth.verify" },
  forgot: { title: "auth.forgotTitle", subtitle: "auth.forgotSubtitle", submit: "auth.sendCode" },
  reset: { title: "auth.resetTitle", subtitle: "auth.resetSubtitle", submit: "auth.resetPassword" },
};

/**
 * Email + password, with a 6-digit code by email to verify the address at
 * sign-up (and on sign-in if it never was) and to reset a forgotten password.
 */
export function AuthForm({ flow }: { flow: Flow }) {
  const { t } = useTranslation();
  const { signIn } = useAuthActions();
  const [step, setStep] = useState<AuthStep>(flow);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const codeStep = step === "verify" || step === "reset";
  const needsPassword = step === "signIn" || step === "signUp" || step === "reset";
  const newPassword = step === "signUp" || step === "reset";

  function go(next: AuthStep) {
    setStep(next);
    setError(undefined);
    setCode("");
    setPassword("");
  }

  async function submit() {
    setError(undefined);
    if (newPassword && password.length < 8) {
      setError(t("auth.errors.passwordTooShort"));
      return;
    }
    const params: Record<string, string> = { email: email.trim().toLowerCase(), flow: FLOWS[step] };
    if (codeStep) params.code = code.trim();
    if (step === "reset") params.newPassword = password;
    else if (needsPassword) params.password = password;
    setSubmitting(true);
    try {
      const { signingIn } = await signIn("password", params);
      // Not signed in yet means a code was emailed: sign-up, an unverified
      // sign-in, or a reset request.
      if (!signingIn) go(step === "forgot" ? "reset" : "verify");
    } catch (e) {
      setError(authErrorMessage(t, e, step));
    } finally {
      setSubmitting(false);
    }
  }

  const copy = COPY[step];
  const ready = codeStep
    ? code.trim().length === 6 && (step !== "reset" || password.length > 0)
    : email.trim().length > 0 && (!needsPassword || password.length > 0);

  return (
    <SafeAreaView className="bg-background flex-1">
      <CmpKeyboardAwareScrollView contentContainerClassName="flex-grow justify-center gap-6 p-6">
        <View className="gap-2">
          <CmpText className="text-brand text-lg font-semibold">{t("common.appName")}</CmpText>
          <CmpText variant="h3">{t(copy.title)}</CmpText>
          <CmpText variant="muted">
            {codeStep ? t(copy.subtitle, { email: email.trim().toLowerCase() }) : t(copy.subtitle)}
          </CmpText>
        </View>
        <View className="gap-4">
          {!codeStep && (
            <CmpInput
              label={t("auth.email")}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              onSubmitEditing={step === "forgot" ? submit : undefined}
            />
          )}
          {codeStep && (
            <CmpInput
              label={t("auth.code")}
              value={code}
              onChangeText={(text) => setCode(text.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
              autoFocus
              onSubmitEditing={step === "verify" ? submit : undefined}
            />
          )}
          {needsPassword && (
            <CmpInput
              label={t(step === "reset" ? "auth.newPassword" : "auth.password")}
              hint={newPassword ? t("auth.passwordHint") : undefined}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={newPassword ? "new-password" : "current-password"}
              textContentType={newPassword ? "newPassword" : "password"}
              onSubmitEditing={submit}
            />
          )}
          {error && <CmpText className="text-destructive text-sm">{error}</CmpText>}
          <CmpButton label={t(copy.submit)} loading={submitting} disabled={!ready} onPress={submit} />
        </View>
        <View className="items-center gap-1">
          {step === "signIn" && (
            <CmpButton variant="link" label={t("auth.forgotPassword")} onPress={() => go("forgot")} />
          )}
          {step === flow ? (
            <Link href={flow === "signUp" ? "/sign-in" : "/sign-up"} replace asChild>
              <CmpButton
                variant="link"
                label={t(flow === "signUp" ? "auth.haveAccount" : "auth.noAccount")}
              />
            </Link>
          ) : (
            <CmpButton variant="link" label={t("auth.back")} onPress={() => go(flow)} />
          )}
        </View>
      </CmpKeyboardAwareScrollView>
    </SafeAreaView>
  );
}
