import { useCallback, useEffect, useState } from "react";
import { usePreventRemove } from "@react-navigation/native";
import { useNavigation } from "expo-router";
import { useAlert } from "@/components/AlertContext";

/**
 * Asks "Keep editing or discard?" when the user leaves a screen with unsaved
 * changes (header back button, Android back button, or iOS swipe back).
 *
 * - `snapshot`: a string of everything the user can edit (e.g. JSON of the
 *   save payload). The form counts as changed when it differs from the
 *   snapshot taken once `ready` is true, or at the last `markSaved()`.
 * - `ready`: true once the form has finished loading its data.
 * - `disabled`: true when the form can't be edited (e.g. already submitted).
 *
 * Returns:
 * - `markSaved()`: call after a successful save, in the same tick as the
 *   state updates from the save, so the saved values become the new baseline.
 * - `leave(fn)`: run a navigation (e.g. router.back) without the prompt,
 *   for use right after a save.
 */
export function useUnsavedChangesGuard(
  snapshot: string,
  { ready, disabled = false }: { ready: boolean; disabled?: boolean },
) {
  const navigation = useNavigation();
  const { confirm } = useAlert();
  const [baseline, setBaseline] = useState<string | null>(null);
  const [saveCount, setSaveCount] = useState(0);
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);

  // Take the baseline once loading is done, and again after each save
  useEffect(() => {
    if (ready) setBaseline(snapshot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, saveCount]);

  const isDirty =
    ready && !disabled && baseline !== null && snapshot !== baseline;

  usePreventRemove(isDirty && !pendingLeave, ({ data }) => {
    confirm(
      "Discard changes?",
      "You have unsaved changes. Leave now and they will be lost.",
      () => navigation.dispatch(data.action),
      { type: "warning", confirmText: "Discard", cancelText: "Keep Editing" },
    );
  });

  // Navigate only after the render that turned the prompt off
  useEffect(() => {
    if (pendingLeave) pendingLeave();
  }, [pendingLeave]);

  const markSaved = useCallback(() => setSaveCount((n) => n + 1), []);
  const leave = useCallback((fn: () => void) => setPendingLeave(() => fn), []);

  return { isDirty, markSaved, leave };
}
