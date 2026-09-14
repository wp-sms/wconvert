import { useEffect } from "react";
import type { EditingState } from "../hooks/useAdminNavigation";

export type SettingsEditing = (state: EditingState) => void;

/** Protect both in-app navigation and reloads while a shared setting is a draft. */
export function useSettingsEditing(
  dirty: boolean,
  busy: boolean,
  report?: SettingsEditing,
) {
  useEffect(() => {
    report?.({ dirty, busy });
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty && !busy) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      report?.({ dirty: false, busy: false });
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [dirty, busy, report]);
}
