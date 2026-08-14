import { securePreference } from '@/lib/secure-preference';

// The user's own Google Gemini API key, used for voice reminder parsing. Free
// form, so no list of accepted values; setting it to '' removes it.
const store = securePreference('gemini_api_key');

export const getStoredGeminiKey = store.get;
export const setStoredGeminiKey = store.set;
