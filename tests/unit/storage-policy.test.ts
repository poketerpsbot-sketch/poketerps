import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  from: vi.fn(),
  draftDownload: vi.fn(),
  draftRemove: vi.fn(),
  publicDownload: vi.fn(),
  publicUpload: vi.fn(),
  publicRemove: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ storage: { from: storage.from } })),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import {
  finalizeEntryImagePromotion,
  isPublicStorageBucket,
  prepareEntryImagePromotion,
  rollbackEntryImagePromotion,
  storageDestinationForUpload,
} from "@/lib/services/storage";

beforeEach(() => {
  for (const mock of Object.values(storage)) mock.mockReset();
  storage.from.mockImplementation((bucket: string) => {
    if (bucket === "entry-drafts") {
      return { download: storage.draftDownload, remove: storage.draftRemove };
    }
    if (bucket === "entry-images") {
      return {
        download: storage.publicDownload,
        upload: storage.publicUpload,
        remove: storage.publicRemove,
      };
    }
    throw new Error(`Unexpected test bucket: ${bucket}`);
  });
  storage.draftRemove.mockResolvedValue({ error: null });
  storage.publicRemove.mockResolvedValue({ error: null });
});

describe("storage publication policy", () => {
  it("keeps contributor entry uploads private until moderation publishes them", () => {
    const destination = storageDestinationForUpload("entry-images");

    expect(destination).toBe("entry-drafts");
    expect(isPublicStorageBucket(destination)).toBe(false);
  });

  it("keeps private message attachments private", () => {
    expect(storageDestinationForUpload("message-attachments")).toBe("message-attachments");
    expect(isPublicStorageBucket("message-attachments")).toBe(false);
  });

  it("recognizes only deliberately public media buckets", () => {
    expect(isPublicStorageBucket("entry-images")).toBe(true);
    expect(isPublicStorageBucket("partner-images")).toBe(true);
    expect(isPublicStorageBucket("app-assets")).toBe(true);
  });
});

describe("entry image promotion", () => {
  const firstPath = "user/2026-08-09/550e8400-e29b-41d4-a716-446655440000.webp";
  const secondPath = "user/2026-08-09/550e8400-e29b-41d4-a716-446655440001.webp";
  const payload = new Uint8Array([82, 73, 70, 70, 1, 2, 3]);

  it("copies private objects without overwrite and tracks their rollback", async () => {
    storage.draftDownload.mockResolvedValue({ data: new Blob([payload]), error: null });
    storage.publicUpload.mockResolvedValue({ error: null });

    const promotion = await prepareEntryImagePromotion([
      { objectPath: firstPath, mimeType: "image/webp" },
    ]);

    expect(promotion).toEqual({ paths: [firstPath], rollbackPaths: [firstPath] });
    expect(storage.from).toHaveBeenCalledWith("entry-drafts");
    expect(storage.from).toHaveBeenCalledWith("entry-images");
    expect(storage.publicUpload).toHaveBeenCalledWith(
      firstPath,
      expect.any(Buffer),
      expect.objectContaining({ contentType: "image/webp", upsert: false }),
    );

    await rollbackEntryImagePromotion(promotion);
    expect(storage.publicRemove).toHaveBeenCalledWith([firstPath]);
  });

  it("reuses a byte-identical orphan but removes it when publication rolls back", async () => {
    storage.draftDownload.mockResolvedValue({ data: new Blob([payload]), error: null });
    storage.publicUpload.mockResolvedValue({ error: { message: "already exists" } });
    storage.publicDownload.mockResolvedValue({ data: new Blob([payload]), error: null });

    const promotion = await prepareEntryImagePromotion([{ objectPath: firstPath }]);

    expect(promotion).toEqual({ paths: [firstPath], rollbackPaths: [firstPath] });
    await rollbackEntryImagePromotion(promotion);
    expect(storage.publicRemove).toHaveBeenCalledWith([firstPath]);

    storage.publicRemove.mockClear();
    await finalizeEntryImagePromotion(promotion);
    expect(storage.draftRemove).toHaveBeenCalledWith([firstPath]);
    expect(storage.publicRemove).not.toHaveBeenCalled();
  });

  it("removes only objects created by the failed multi-image attempt", async () => {
    storage.draftDownload.mockResolvedValue({ data: new Blob([payload]), error: null });
    storage.publicUpload
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "upload failed" } });
    storage.publicDownload.mockResolvedValue({ data: null, error: { message: "not found" } });

    await expect(
      prepareEntryImagePromotion([{ objectPath: firstPath }, { objectPath: secondPath }]),
    ).rejects.toMatchObject({ code: "STORAGE_PROMOTION_FAILED" });

    expect(storage.publicRemove).toHaveBeenCalledTimes(1);
    expect(storage.publicRemove).toHaveBeenCalledWith([firstPath]);
  });

  it("refuses to overwrite a different public object at the same path", async () => {
    storage.draftDownload.mockResolvedValue({ data: new Blob([payload]), error: null });
    storage.publicUpload.mockResolvedValue({ error: { message: "already exists" } });
    storage.publicDownload.mockResolvedValue({
      data: new Blob([new Uint8Array([9, 9, 9])]),
      error: null,
    });

    await expect(prepareEntryImagePromotion([{ objectPath: firstPath }])).rejects.toMatchObject({
      code: "STORAGE_PROMOTION_FAILED",
    });
    expect(storage.publicRemove).not.toHaveBeenCalled();
  });

  it("never rolls back a committed public object when draft cleanup throws", async () => {
    storage.draftRemove.mockRejectedValue(new Error("storage unavailable"));
    const promotion = { paths: [firstPath], rollbackPaths: [firstPath] };

    await expect(finalizeEntryImagePromotion(promotion)).resolves.toBeUndefined();

    expect(storage.draftRemove).toHaveBeenCalledWith([firstPath]);
    expect(storage.publicRemove).not.toHaveBeenCalled();
  });
});
