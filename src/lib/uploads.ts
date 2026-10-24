// Browser side of R2 uploads: ask the server for a signed URL, then PUT the file to R2.
import { createUpload } from "./uploads.functions";

export type UploadKind = "product-image" | "product-video" | "review-photo" | "review-video";

/** Uploads `file` and returns its public URL. Throws with a user-facing message. */
export async function uploadFile(kind: UploadKind, file: File): Promise<string> {
  const { uploadUrl, publicUrl } = await createUpload({
    data: { kind, contentType: file.type, size: file.size },
  });
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status}). Try again.`);
  return publicUrl;
}
