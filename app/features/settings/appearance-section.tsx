import { CmpCard, CmpCardContent, CmpCardHeader, CmpCardTitle } from '@/components/cmp/cmp-card';
import { CmpLabel } from '@/components/cmp/cmp-label';
import {
  CmpSelect,
  CmpSelectContent,
  CmpSelectItem,
  CmpSelectTrigger,
  CmpSelectValue,
} from '@/components/cmp/cmp-select';
import { LANGUAGE_OPTIONS, setAppLanguage } from '@/lib/i18n';
import { type AppLanguage } from '@/lib/locale-preference';
import {
  getStoredTheme,
  setStoredTheme,
  THEME_OPTIONS,
  type AppTheme,
} from '@/lib/theme-preference';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

const THEME_LABEL_KEYS: Record<AppTheme, string> = {
  system: 'settings.themeSystem',
  light: 'settings.themeLight',
  dark: 'settings.themeDark',
};

export function AppearanceSection() {
  const { t, i18n } = useTranslation();
  const { setColorScheme } = useColorScheme();
  const themeOptions = THEME_OPTIONS.map((value) => ({ value, label: t(THEME_LABEL_KEYS[value]) }));
  // Bound to the STORED preference, not to useColorScheme().colorScheme —
  // NativeWind only ever reports the resolved scheme, so a select bound to it
  // would show "Light" the moment you picked "System".
  const [theme, setTheme] = React.useState<AppTheme>('system');

  React.useEffect(() => {
    let mounted = true;
    getStoredTheme().then((stored) => {
      if (mounted && stored) setTheme(stored);
    });
    return () => {
      mounted = false;
    };
  }, []);

  function onChangeTheme(next: AppTheme) {
    setTheme(next);
    setColorScheme(next);
    setStoredTheme(next);
  }

  return (
    <CmpCard className="w-full max-w-sm">
      <CmpCardHeader>
        <CmpCardTitle>{t('settings.sectionAppearance')}</CmpCardTitle>
      </CmpCardHeader>
      <CmpCardContent className="gap-4">
        <View className="gap-1.5">
          <CmpLabel nativeID="theme">{t('settings.theme')}</CmpLabel>
          <CmpSelect
            value={themeOptions.find((o) => o.value === theme)}
            onValueChange={(option) => {
              if (option) onChangeTheme(option.value as AppTheme);
            }}>
            <CmpSelectTrigger aria-labelledby="theme">
              <CmpSelectValue placeholder={t('settings.theme')} />
            </CmpSelectTrigger>
            <CmpSelectContent>
              {themeOptions.map((o) => (
                <CmpSelectItem key={o.value} value={o.value} label={o.label} />
              ))}
            </CmpSelectContent>
          </CmpSelect>
        </View>
        <View className="gap-1.5">
          <CmpLabel nativeID="language">{t('settings.language')}</CmpLabel>
          <CmpSelect
            value={LANGUAGE_OPTIONS.find((o) => o.value === i18n.language)}
            onValueChange={(option) => {
              if (option) setAppLanguage(option.value as AppLanguage);
            }}>
            <CmpSelectTrigger aria-labelledby="language">
              <CmpSelectValue placeholder={t('settings.languagePlaceholder')} />
            </CmpSelectTrigger>
            <CmpSelectContent>
              {LANGUAGE_OPTIONS.map((o) => (
                <CmpSelectItem key={o.value} value={o.value} label={o.label} />
              ))}
            </CmpSelectContent>
          </CmpSelect>
        </View>
      </CmpCardContent>
    </CmpCard>
  );
}
