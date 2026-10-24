// Cloudflare R2 (S3-compatible) presigned uploads — server only.
//
// The browser PUTs the file straight to R2 with a short-lived signed URL; our Worker never
// streams the bytes. Content-Type and Content-Length are part of the signature, so the upload
// must match the type and size we approved. Files are served from R2_PUBLIC_URL (an R2 custom
// domain or r2.dev URL) — zero egress fees.
import { AwsClient } from "aws4fetch";

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
}

export function r2Config(): R2Config | null {
  const e = process.env;
  const cfg = {
    accountId: e["R2_ACCOUNT_ID"] ?? "",
    accessKeyId: e["R2_ACCESS_KEY_ID"] ?? "",
    secretAccessKey: e["R2_SECRET_ACCESS_KEY"] ?? "",
    bucket: e["R2_BUCKET"] ?? "",
    publicUrl: (e["R2_PUBLIC_URL"] ?? "").replace(/\/$/, ""),
  };
  return Object.values(cfg).every(Boolean) ? cfg : null;
}

/** What each kind of upload may be. Sizes in bytes. */
export const UPLOAD_RULES = {
  "product-image": { types: ["image/jpeg", "image/png", "image/webp"], max: 5_000_000 },
  "product-video": { types: ["video/mp4", "video/webm"], max: 8_000_000 },
  "review-photo": { types: ["image/jpeg", "image/png", "image/webp"], max: 5_000_000 },
  "review-video": { types: ["video/mp4", "video/webm", "video/quicktime"], max: 20_000_000 },
} as const;
export type UploadKind = keyof typeof UPLOAD_RULES;

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

/** Throws a user-facing message when the file isn't allowed for this kind of upload. */
export function checkUpload(kind: UploadKind, contentType: string, size: number) {
  const rule = UPLOAD_RULES[kind];
  if (!(rule.types as readonly string[]).includes(contentType))
    throw new Error(
      `That file type isn't allowed here (${rule.types.map((t) => EXT[t]).join(", ")} only).`,
    );
  if (!Number.isInteger(size) || size <= 0) throw new Error("That file is empty.");
  if (size > rule.max)
    throw new Error(`Files here must be under ${Math.round(rule.max / 1_000_000)} MB.`);
}

/** `prefix` like "products" or "reviews/<userId>". */
export function objectKey(prefix: string, contentType: string) {
  return `${prefix}/${crypto.randomUUID()}.${EXT[contentType] ?? "bin"}`;
}

export async function presignPut(cfg: R2Config, key: string, contentType: string, size: number) {
  const client = new AwsClient({
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  const url = new URL(`https://${cfg.accountId}.r2.cloudflarestorage.com/${cfg.bucket}/${key}`);
  url.searchParams.set("X-Amz-Expires", "600"); // 10 minutes
  const signed = await client.sign(url.toString(), {
    method: "PUT",
    headers: { "Content-Type": contentType, "Content-Length": String(size) },
    aws: { signQuery: true, allHeaders: true },
  });
  return { uploadUrl: signed.url, publicUrl: `${cfg.publicUrl}/${key}` };
}
