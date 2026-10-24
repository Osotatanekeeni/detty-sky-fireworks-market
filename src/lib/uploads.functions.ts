// Presigned R2 uploads. Product media: admins only. Review media: signed-in customers, filed
// under reviews/<their user id>/ so submitReview can check the files are theirs.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  UPLOAD_RULES,
  checkUpload,
  objectKey,
  presignPut,
  r2Config,
  type UploadKind,
} from "./r2.server";
import { supabaseForRequest } from "./supabase.server";

export const createUpload = createServerFn({ method: "POST" })
  .validator((d: { kind: UploadKind; contentType: string; size: number }) =>
    z
      .object({
        kind: z.enum(Object.keys(UPLOAD_RULES) as [UploadKind, ...UploadKind[]]),
        contentType: z.string().max(100),
        size: z.number().int(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const cfg = r2Config();
    if (!cfg) throw new Error("Uploads aren't set up yet (R2 settings are missing).");
    checkUpload(data.kind, data.contentType, data.size);

    const db = supabaseForRequest();
    const { data: auth } = await db.auth.getUser();
    if (!auth.user) throw new Error("Sign in to upload.");
    let prefix: string;
    if (data.kind.startsWith("product-")) {
      const { data: p } = await db.from("profiles").select("role").eq("id", auth.user.id).single();
      if (p?.role !== "admin") throw new Error("Admins only.");
      prefix = "products";
    } else {
      prefix = `reviews/${auth.user.id}`;
    }
    return presignPut(cfg, objectKey(prefix, data.contentType), data.contentType, data.size);
  });
