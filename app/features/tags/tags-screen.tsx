import { CmpButton } from '@/components/cmp/cmp-button';
import { CmpFlatList } from '@/components/cmp/cmp-flat-list';
import { CmpIcon } from '@/components/cmp/cmp-icon';
import { CmpText } from '@/components/cmp/cmp-text';
// Shared with Home on purpose: both FABs must sit at the identical offset so
// the button does not jump as the user switches tabs.
import { useFabBottom, useFabContentPadding } from '@/features/reminders/fab-layout';
import { TagEditDialog } from '@/features/tags/tag-edit-dialog';
import { TagRow } from '@/features/tags/tag-row';
import { useTagList } from '@/features/tags/use-tag-list';
import { type TagWithCount } from '@/lib/tags';
import { PlusIcon } from 'lucide-react-native';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function TagsScreen() {
  const insets = useSafeAreaInsets();
  const fabBottom = useFabBottom();
  const fabContentPadding = useFabContentPadding();
  const { t } = useTranslation();
  const list = useTagList();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  // null means the dialog is in create mode; a tag means rename.
  const [editing, setEditing] = React.useState<TagWithCount | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openRename(tag: TagWithCount) {
    setEditing(tag);
    setDialogOpen(true);
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {list.error ? <CmpText className="p-4 text-sm text-destructive">{list.error}</CmpText> : null}
      <CmpFlatList
        data={list.items}
        keyExtractor={(tag) => tag.id}
        contentContainerClassName="gap-3 p-4"
        contentContainerStyle={{ paddingBottom: fabContentPadding }}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} />}
        ListEmptyComponent={list.loading ? null : <EmptyState />}
        renderItem={({ item }) => <TagRow tag={item} onEdit={openRename} onDelete={list.remove} />}
      />
      <View className="absolute right-6" style={{ bottom: fabBottom }}>
        <CmpButton
          size="icon"
          className="h-14 w-14 rounded-full"
          accessibilityLabel={t('tags.newTag')}
          onPress={openCreate}>
          <CmpIcon as={PlusIcon} className="size-6 text-primary-foreground" />
        </CmpButton>
      </View>
      <TagEditDialog
        tag={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={list.reload}
      />
    </View>
  );
}

function EmptyState() {
  const { t } = useTranslation();

  return (
    <View className="items-center gap-4 pt-24">
      <CmpText className="text-lg font-semibold">{t('tags.emptyTitle')}</CmpText>
      <CmpText className="text-center text-sm text-muted-foreground">{t('tags.emptyBody')}</CmpText>
    </View>
  );
}
