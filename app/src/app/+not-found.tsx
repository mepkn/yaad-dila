import { Link, Stack } from 'expo-router';
import { View } from 'react-native';
import { CmpText } from '@/components/cmp/cmp-text';
import { useTranslation } from 'react-i18next';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('notFound.title') }} />
      <View>
        <CmpText>{t('notFound.body')}</CmpText>

        <Link href="/">
          <CmpText>{t('notFound.goHome')}</CmpText>
        </Link>
      </View>
    </>
  );
}
