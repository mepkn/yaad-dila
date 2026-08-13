import {
  CmpAlertDialog,
  CmpAlertDialogAction,
  CmpAlertDialogCancel,
  CmpAlertDialogContent,
  CmpAlertDialogDescription,
  CmpAlertDialogFooter,
  CmpAlertDialogHeader,
  CmpAlertDialogTitle,
  CmpAlertDialogTrigger,
} from '@/components/cmp/cmp-alert-dialog';
import { CmpButton } from '@/components/cmp/cmp-button';
import { CmpCard, CmpCardContent, CmpCardHeader, CmpCardTitle } from '@/components/cmp/cmp-card';
import {
  CmpCollapsible,
  CmpCollapsibleContent,
  CmpCollapsibleTrigger,
} from '@/components/cmp/cmp-collapsible';
import { CmpIcon } from '@/components/cmp/cmp-icon';
import { CmpInput } from '@/components/cmp/cmp-input';
import { CmpLabel } from '@/components/cmp/cmp-label';
import { CmpText } from '@/components/cmp/cmp-text';
import { changePassword, currentUserEmail, logout, MIN_PASSWORD_LENGTH } from '@/lib/auth';
import { useAction } from '@/lib/use-action';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react-native';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

export function AccountSection() {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [passwordOpen, setPasswordOpen] = React.useState(false);

  const changeUserPassword = useAction(
    async () => {
      // Cheap checks first — no point spending a round-trip on a typo. Thrown
      // rather than returned early: describeError passes a plain Error's
      // message straight through, so these read like any other failure.
      if (newPassword !== confirmPassword) {
        throw new Error(t('settings.passwordMismatch'));
      }
      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        throw new Error(t('settings.passwordTooShort', { min: MIN_PASSWORD_LENGTH }));
      }
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    { success: t('settings.passwordChanged') }
  );

  return (
    <CmpCard className="w-full max-w-sm">
      <CmpCardHeader>
        <CmpCardTitle>{t('settings.sectionAccount')}</CmpCardTitle>
      </CmpCardHeader>
      <CmpCardContent className="gap-4">
        <View className="gap-1.5">
          <CmpLabel>{t('settings.signedInAs')}</CmpLabel>
          <CmpText className="text-sm text-muted-foreground">{currentUserEmail() ?? '—'}</CmpText>
        </View>
        <CmpCollapsible open={passwordOpen} onOpenChange={setPasswordOpen}>
          <CmpCollapsibleTrigger className="flex-row items-center gap-2">
            {/* CmpText, not CmpLabel: Label renders its own Pressable, which
                swallows the press before the trigger ever sees it. flex-1 on the
                text and shrink-0 on the icon so a longer translation is not
                squeezed down to its first word. */}
            <CmpText className="flex-1 text-sm font-medium">{t('settings.changePassword')}</CmpText>
            <CmpIcon
              as={passwordOpen ? ChevronUpIcon : ChevronDownIcon}
              className="size-5 shrink-0 text-muted-foreground"
            />
          </CmpCollapsibleTrigger>
          <CmpCollapsibleContent>
            <View className="gap-4 pt-4">
              <View className="gap-1.5">
                <CmpLabel nativeID="current_password">{t('settings.currentPassword')}</CmpLabel>
                <CmpInput
                  aria-labelledby="current_password"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  autoCapitalize="none"
                  secureTextEntry
                  placeholder="••••••••"
                />
              </View>
              <View className="gap-1.5">
                <CmpLabel nativeID="new_password">{t('settings.newPassword')}</CmpLabel>
                <CmpInput
                  aria-labelledby="new_password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  autoCapitalize="none"
                  secureTextEntry
                  placeholder="••••••••"
                />
              </View>
              <View className="gap-1.5">
                <CmpLabel nativeID="confirm_password">{t('settings.confirmPassword')}</CmpLabel>
                <CmpInput
                  aria-labelledby="confirm_password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  autoCapitalize="none"
                  secureTextEntry
                  placeholder="••••••••"
                />
              </View>
              {changeUserPassword.status ? (
                <CmpText
                  className={
                    changeUserPassword.status.kind === 'ok'
                      ? 'text-sm text-green-600'
                      : 'text-sm text-destructive'
                  }>
                  {changeUserPassword.status.text}
                </CmpText>
              ) : null}
              <CmpButton
                variant="secondary"
                onPress={changeUserPassword.run}
                disabled={
                  changeUserPassword.busy || !currentPassword || !newPassword || !confirmPassword
                }>
                <CmpText>
                  {changeUserPassword.busy ? t('common.working') : t('settings.changePassword')}
                </CmpText>
              </CmpButton>
            </View>
          </CmpCollapsibleContent>
        </CmpCollapsible>

        {/* Behind a confirm: logging out is one tap from the controls above. */}
        <CmpAlertDialog>
          <CmpAlertDialogTrigger asChild>
            <CmpButton variant="destructive">
              <CmpText>{t('settings.logout')}</CmpText>
            </CmpButton>
          </CmpAlertDialogTrigger>
          <CmpAlertDialogContent>
            <CmpAlertDialogHeader>
              <CmpAlertDialogTitle>{t('settings.logoutConfirmTitle')}</CmpAlertDialogTitle>
              <CmpAlertDialogDescription>
                {t('settings.logoutConfirmBody')}
              </CmpAlertDialogDescription>
            </CmpAlertDialogHeader>
            <CmpAlertDialogFooter>
              <CmpAlertDialogCancel>
                <CmpText>{t('common.cancel')}</CmpText>
              </CmpAlertDialogCancel>
              <CmpAlertDialogAction onPress={logout}>
                <CmpText>{t('settings.logout')}</CmpText>
              </CmpAlertDialogAction>
            </CmpAlertDialogFooter>
          </CmpAlertDialogContent>
        </CmpAlertDialog>
      </CmpCardContent>
    </CmpCard>
  );
}
