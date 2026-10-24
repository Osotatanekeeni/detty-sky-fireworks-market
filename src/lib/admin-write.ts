// Runs an admin server function, toasts the outcome and refreshes the catalogue so every page
// (storefront included) shows the change.
import { useCallback } from "react";
import { toast } from "sonner";
import { useRefreshCatalogue } from "./catalogue";

export function useAdminWrite() {
  const refresh = useRefreshCatalogue();
  return useCallback(
    async (work: Promise<unknown>, success?: string): Promise<boolean> => {
      try {
        await work;
        await refresh();
        if (success) toast.success(success);
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message.replace(/^FORBIDDEN: /, "") : "Save failed");
        return false;
      }
    },
    [refresh],
  );
}
