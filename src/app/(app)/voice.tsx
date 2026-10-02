import { router, useFocusEffect } from "expo-router";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { Mic, Sparkles, Square } from "lucide-react-native";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { CmpButton } from "@/components/cmp/cmp-button";
import { CmpTextarea } from "@/components/cmp/cmp-field";
import { CmpText } from "@/components/cmp/cmp-text";
import { encodeDraft } from "@/lib/draft";
import { GeminiError, getGeminiKey, parseReminder } from "@/lib/gemini";

// Speech is recognised on the device; the resulting text (spoken or typed)
// is sent to Gemini with the user's own key to prefill the reminder form.
export default function VoiceScreen() {
  const { t, i18n } = useTranslation();
  const [apiKey, setApiKey] = useState<string | null | undefined>(undefined);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string>();

  useFocusEffect(
    useCallback(() => {
      void getGeminiKey().then(setApiKey);
    }, []),
  );

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
    if (!apiKey) return;
    if (listening) ExpoSpeechRecognitionModule.stop();
    setParsing(true);
    setError(undefined);
    try {
      const draft = await parseReminder(text.trim(), apiKey);
      router.replace({ pathname: "/reminder/new", params: { draft: encodeDraft(draft) } });
    } catch (e) {
      const kind = e instanceof GeminiError ? e.kind : "unparseable";
      setError(t(`voice.errors.${kind}`));
    } finally {
      setParsing(false);
    }
  }

  if (apiKey === undefined) return null;

  if (apiKey === null) {
    return (
      <View className="bg-background flex-1 justify-center gap-4 p-6">
        <CmpText className="text-center">{t("voice.needKey")}</CmpText>
        <CmpButton
          label={t("voice.goToSettings")}
          onPress={() => {
            router.back();
            router.navigate("/settings");
          }}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="bg-background flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerClassName="gap-5 p-5" keyboardShouldPersistTaps="handled">
        <CmpText variant="muted">{t("voice.intro")}</CmpText>
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
