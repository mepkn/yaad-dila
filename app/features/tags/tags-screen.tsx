import { CmpButton } from '@/components/cmp/cmp-button';
import { CmpFlatList } from '@/components/cmp/cmp-flat-list';
import { CmpIcon } from '@/components/cmp/cmp-icon';
import { CmpText } from '@/components/cmp/cmp-text';
// Shared with Home on purpose: both FABs must sit at the identical offset so
// the button does not jump as the user switches tabs.
import { useFabBottom, useFabContentPadding } from '@/features/reminders/fab-layout';
import { TagEditDialog } from '@/features/tags/tag-edit-dialog';
import { TagRow } from '@/features/tags/tag-row';
import { describeError } from '@/lib/errors';
import { deleteTag, listTagsWithCounts, type TagWithCount } from '@/lib/tags';
import { useFocusEffect } from 'expo-router';
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
  const [tags, setTags] = React.useState<TagWithCount[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  // null means the dialog is in create mode; a tag means rename.
  const [editing, setEditing] = React.useState<TagWithCount | null>(null);

  const load = React.useCallback(async () => {
    try {
      setTags(await listTagsWithCounts());
      setError(null);
    } catch (err) {
      if ((err as { isAbort?: boolean })?.isAbort) return;
      setError(describeError(err));
    }
  }, []);

  // Reload on focus, not just on mount: the reminder form creates tags too, so
  // returning from it must show them.
  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      setLoading(true);
      load().finally(() => {
        if (active) setLoading(false);
      });
      return () => {
        active = false;
      };
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function onDelete(tag: TagWithCount) {
    // Drop the row first — a failed delete puts it back via the reload below.
    setTags((prev) => prev.filter((candidate) => candidate.id !== tag.id));
    try {
      await deleteTag(tag.id);
    } catch (err) {
      setError(describeError(err));
      await load();
    }
  }

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
      {error ? <CmpText className="p-4 text-sm text-destructive">{error}</CmpText> : null}
      <CmpFlatList
        data={tags}
        keyExtractor={(tag) => tag.id}
        contentContainerClassName="gap-3 p-4"
        contentContainerStyle={{ paddingBottom: fabContentPadding }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={loading ? null : <EmptyState />}
        renderItem={({ item }) => <TagRow tag={item} onEdit={openRename} onDelete={onDelete} />}
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
      <TagEditDialog tag={editing} open={dialogOpen} onOpenChange={setDialogOpen} onSaved={load} />
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
