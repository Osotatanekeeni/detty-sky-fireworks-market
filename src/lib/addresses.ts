// The signed-in customer's saved delivery addresses (`addresses` table, RLS: own rows only).
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "./supabase.browser";
import type { Address, StateName } from "./types";

interface AddressRow {
  id: string;
  label: string;
  state: StateName;
  city: string;
  street: string;
  phone: string;
}
const fromRow = (r: AddressRow): Address => ({ ...r });

/** Addresses for `userId` (pass null when signed out → always empty). */
export function useAddresses(userId: string | null) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!userId) {
      setAddresses([]);
      return;
    }
    setLoading(true);
    const { data } = await supabaseBrowser()
      .from("addresses")
      .select("id, label, state, city, street, phone")
      .order("created_at");
    setAddresses(((data ?? []) as AddressRow[]).map(fromRow));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Insert or update. Returns an error message, or null on success. */
  const save = useCallback(
    async (a: Omit<Address, "id"> & { id?: string | undefined }) => {
      if (!userId) return "Sign in to save addresses.";
      const row = {
        label: a.label,
        state: a.state,
        city: a.city,
        street: a.street,
        phone: a.phone,
        user_id: userId,
      };
      const { error } = a.id
        ? await supabaseBrowser().from("addresses").update(row).eq("id", a.id)
        : await supabaseBrowser().from("addresses").insert(row);
      if (error) return error.message;
      await reload();
      return null;
    },
    [userId, reload],
  );

  const remove = useCallback(async (id: string) => {
    const { error } = await supabaseBrowser().from("addresses").delete().eq("id", id);
    if (error) return error.message;
    setAddresses((as) => as.filter((x) => x.id !== id));
    return null;
  }, []);

  return { addresses, loading, save, remove };
}
