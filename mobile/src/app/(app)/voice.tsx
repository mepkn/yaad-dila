import { useAction } from "convex/react";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { Mic, Sparkles, Square } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { api } from "@convex/_generated/api";
import { CmpButton } from "@/components/cmp/cmp-button";
import { CmpTextarea } from "@/components/cmp/cmp-field";
import { CmpKeyboardAwareScrollView } from "@/components/cmp/cmp-keyboard-aware-scroll-view";
import { CmpText } from "@/components/cmp/cmp-text";
import { encodeDraft } from "@/lib/draft";
import { errorCode } from "@/lib/errors";

// Speech is recognised on the device; the resulting text (spoken or typed) goes
// to the backend, which asks the user's own AI key through kunji for the
// reminder fields and prefills the form with them.
const KNOWN = new Set(["noAiKey", "aiKeyRefused", "aiRateLimited", "notConnected", "aiUnavailable", "unparseable"]);

export default function VoiceScreen() {
  const { t, i18n } = useTranslation();
  const parseReminder = useAction(api.voice.parse);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string>();

  // Voice used to call Gemini with a key kept on the device; kunji holds AI
  // keys now, so drop any old one.
  useEffect(() => {
    void SecureStore.deleteItemAsync("gemini.apiKey").catch(() => {});
  }, []);

  useSpeechRecognitionEvent("start", () => setListening(true));
  useSpeechRecognitionEvent("end", () => setListening(false));
  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) setText(transcript);
  });
  useSpeechRecognitionEvent("error", (event) => {
    setListening(false);
    if (event.error === "not-allowed") setError(t("voice.micDenied"));
    else if (event.error !== "aborted" && event.error !== "no-speech") {
      setError(t("voice.speechUnavailable"));
    }
  });

  async function listen() {
    setError(undefined);
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      setError(t("voice.speechUnavailable"));
      return;
    }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setError(t("voice.micDenied"));
      return;
    }
    ExpoSpeechRecognitionModule.start({
      lang: i18n.language === "hi" ? "hi-IN" : "en-IN",
      interimResults: true,
      continuous: false,
    });
  }

  async function parse() {
    if (listening) ExpoSpeechRecognitionModule.stop();
    setParsing(true);
    setError(undefined);
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const draft = await parseReminder({ text: text.trim(), timeZone });
      router.replace({ pathname: "/reminder/new", params: { draft: encodeDraft(draft) } });
    } catch (e) {
      const code = errorCode(e);
      setError(t(`voice.errors.${code && KNOWN.has(code) ? code : "aiUnavailable"}`));
    } finally {
      setParsing(false);
    }
  }

  return (
    <CmpKeyboardAwareScrollView
      className="bg-background flex-1"
      contentContainerClassName="gap-5 p-5">
      <CmpText variant="muted">{t("voice.intro")}</CmpText>
      <CmpText variant="muted" className="text-sm">{t("voice.aiHint")}</CmpText>
      <CmpTextarea
        value={text}
        onChangeText={setText}
        placeholder={t("voice.placeholder")}
        className="min-h-32 text-base"
      />
      <View className="items-center gap-2">
        <CmpButton
          size="icon"
          variant={listening ? "destructive" : "secondary"}
          className="h-20 w-20 rounded-full"
          icon={listening ? Square : Mic}
          label={t(listening ? "voice.stop" : "voice.listen")}
          onPress={() => (listening ? ExpoSpeechRecognitionModule.stop() : void listen())}
        />
        <CmpText variant="muted">
          {listening ? t("voice.listening") : t("voice.listen")}
        </CmpText>
      </View>
      {error && <CmpText className="text-destructive">{error}</CmpText>}
      <CmpButton
        size="lg"
        icon={Sparkles}
        label={t(parsing ? "voice.parsing" : "voice.parse")}
        loading={parsing}
        disabled={text.trim().length < 3}
        onPress={parse}
      />
    </CmpKeyboardAwareScrollView>
  );
}
