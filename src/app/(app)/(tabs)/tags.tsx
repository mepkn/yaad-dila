import { useMutation, useQuery } from "convex/react";
import { Pencil, Plus, Tag, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, View } from "react-native";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { CmpButton } from "@/components/cmp/cmp-button";
import { CmpCard, CmpCardContent } from "@/components/cmp/cmp-card";
import { CmpConfirmDialog } from "@/components/cmp/cmp-confirm-dialog";
import { CmpIcon } from "@/components/cmp/cmp-icon";
import { CmpPromptDialog } from "@/components/cmp/cmp-prompt-dialog";
import { CmpText } from "@/components/cmp/cmp-text";
import { errorMessage } from "@/lib/errors";

type TagRow = { _id: Id<"tags">; name: string; reminderCount: number };

export default function TagsScreen() {
  const { t } = useTranslation();
  const tags = useQuery(api.tags.list);
  const create = useMutation(api.tags.create);
  const rename = useMutation(api.tags.rename);
  const remove = useMutation(api.tags.remove);

  // "new" while creating, a tag while renaming.
  const [editing, setEditing] = useState<TagRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<TagRow | null>(null);
  const [dialogError, setDialogError] = useState<string>();
  const [listError, setListError] = useState<string>();

  function openEditor(target: TagRow | "new") {
    setDialogError(undefined);
    setEditing(target);
  }

  async function save(name: string) {
    setDialogError(undefined);
    try {
      if (editing === "new") await create({ name });
      else if (editing) await rename({ id: editing._id, name });
      setEditing(null);
    } catch (e) {
      setDialogError(errorMessage(t, e));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setListError(undefined);
    try {
      await remove({ id: deleting._id });
    } catch (e) {
      setListError(errorMessage(t, e));
    }
  }

  const countLabel = (n: number) => t(n === 1 ? "tags.count_one" : "tags.count_other", { n });

  return (
    <View className="bg-background flex-1">
      {tags === undefined ? (
        <ActivityIndicator className="mt-10" />
      ) : (
        <FlatList
          data={tags}
          keyExtractor={(tag) => tag._id}
          contentContainerClassName="gap-3 p-4 pb-32"
          ListHeaderComponent={
            listError ? <CmpText className="text-destructive">{listError}</CmpText> : null
          }
          ListEmptyComponent={
            <CmpText variant="muted" className="mt-10 text-center">
              {t("tags.empty")}
            </CmpText>
          }
          renderItem={({ item }) => (
            <CmpCard className="py-3">
              <CmpCardContent className="flex-row items-center gap-3">
                <CmpIcon as={Tag} className="text-muted-foreground" />
                <View className="flex-1">
                  <CmpText className="font-medium">{item.name}</CmpText>
                  <CmpText variant="muted">{countLabel(item.reminderCount)}</CmpText>
                </View>
                <CmpButton
                  size="icon"
                  variant="ghost"
                  icon={Pencil}
                  label={t("common.rename")}
                  onPress={() => openEditor(item)}
                />
                <CmpButton
                  size="icon"
                  variant="ghost"
                  icon={Trash2}
                  label={t("common.delete")}
                  onPress={() => setDeleting(item)}
                />
              </CmpCardContent>
            </CmpCard>
          )}
        />
      )}

      <View className="absolute bottom-6 right-5">
        <CmpButton
          size="icon"
          className="h-16 w-16 rounded-full shadow-lg"
          icon={Plus}
          label={t("form.newTag")}
          onPress={() => openEditor("new")}
        />
      </View>

      <CmpPromptDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing === "new" ? t("form.newTagTitle") : t("tags.renameTitle")}
        initialValue={editing && editing !== "new" ? editing.name : ""}
        placeholder={t("form.tagName")}
        error={dialogError}
        submitLabel={editing === "new" ? t("common.create") : t("common.save")}
        cancelLabel={t("common.cancel")}
        onSubmit={save}
      />
      <CmpConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("tags.deleteTitle", { name: deleting?.name ?? "" })}
        description={t("tags.deleteDescription", { n: deleting?.reminderCount ?? 0 })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={confirmDelete}
      />
    </View>
  );
}
