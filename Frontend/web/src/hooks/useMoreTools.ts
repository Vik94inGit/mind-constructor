import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useAuthUser } from "../context/AuthContext";
import { useUserState } from "../context/UserStateContext";
import { loadLocalMoreTools, moreToolsOn, saveLocalMoreTools, subscribeLocalMoreTools } from "../utils/moreTools";
import { feature } from "../utils/usage";

/** Whether every tool shows (utils/moreTools.ts), and the switch. Outside the providers (a test): on. */
export function useMoreTools(): { moreTools: boolean; setMoreTools: (on: boolean) => void } {
  const user = useAuthUser();
  const { preferences, savePreferences } = useUserState();
  const local = useSyncExternalStore(subscribeLocalMoreTools, loadLocalMoreTools, () => null);
  const saved = preferences?.moreTools;
  useEffect(() => {
    if (saved !== undefined) saveLocalMoreTools(saved);
  }, [saved]);
  const setMoreTools = useCallback(
    (on: boolean) => {
      saveLocalMoreTools(on);
      savePreferences({ moreTools: on });
      feature("more_tools");
    },
    [savePreferences],
  );
  return { moreTools: moreToolsOn(saved, local, !!user?.isDemo), setMoreTools };
}
