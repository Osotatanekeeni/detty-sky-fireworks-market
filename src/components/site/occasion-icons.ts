import { Cake, Church, Gem, PartyPopper, TreePine, type LucideIcon } from "lucide-react";
import type { OccasionSlug } from "@/lib/types";

export const OCCASION_ICONS: Record<OccasionSlug, LucideIcon> = {
  christmas: TreePine,
  "new-year": PartyPopper,
  "wedding-entrance": Gem,
  birthday: Cake,
  "church-crossover": Church,
};
