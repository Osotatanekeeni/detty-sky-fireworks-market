import { describe, expect, it } from "vitest";
import { checkUpload, objectKey, presignPut } from "@/lib/r2.server";

describe("checkUpload", () => {
  it("allows the right types and sizes", () => {
    expect(() => checkUpload("product-image", "image/webp", 2_000_000)).not.toThrow();
    expect(() => checkUpload("product-video", "video/mp4", 7_900_000)).not.toThrow();
  });
  it("rejects wrong types, empty and oversized files", () => {
    expect(() => checkUpload("product-image", "image/svg+xml", 1000)).toThrow(/isn't allowed/);
    expect(() => checkUpload("product-video", "video/mp4", 8_000_001)).toThrow(/under 8 MB/);
    expect(() => checkUpload("review-photo", "image/jpeg", 0)).toThrow(/empty/);
    expect(() => checkUpload("review-photo", "text/html", 10)).toThrow();
  });
});

describe("presignPut", () => {
  it("signs a 10-minute PUT that pins content type and length", async () => {
    const cfg = {
      accountId: "acc123",
      accessKeyId: "AKIDEXAMPLE",
      secretAccessKey: "secret",
      bucket: "detty-media",
      publicUrl: "https://media.example.test",
    };
    const key = objectKey("reviews/u1", "image/jpeg");
    expect(key).toMatch(/^reviews\/u1\/[0-9a-f-]{36}\.jpg$/);
    const { uploadUrl, publicUrl } = await presignPut(cfg, key, "image/jpeg", 1234);
    const u = new URL(uploadUrl);
    expect(u.host).toBe("acc123.r2.cloudflarestorage.com");
    expect(u.pathname).toBe(`/detty-media/${key}`);
    expect(u.searchParams.get("X-Amz-Expires")).toBe("600");
    expect(u.searchParams.get("X-Amz-SignedHeaders")).toBe("content-length;content-type;host");
    expect(u.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(publicUrl).toBe(`https://media.example.test/${key}`);
  });
});
