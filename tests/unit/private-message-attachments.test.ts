import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createSignedUrls: vi.fn(),
  from: vi.fn(),
  getDb: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/db", () => ({ getDb: mocks.getDb }));

import { listAdminMessages } from "@/lib/services/messages";
import {
  PRIVATE_STORAGE_SIGNED_URL_TTL_SECONDS,
  signedStorageUrls,
} from "@/lib/services/storage-url";

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.from.mockReturnValue({ createSignedUrls: mocks.createSignedUrls });
  mocks.createClient.mockReturnValue({ storage: { from: mocks.from } });
});

describe("private message attachment URLs", () => {
  it("signs de-duplicated paths in one short-lived Supabase request", async () => {
    mocks.createSignedUrls.mockResolvedValue({
      data: [
        { path: "user/one.webp", signedUrl: "https://storage.test/one?token=secret" },
        { path: "user/two.webp", signedUrl: null, error: "Object not found" },
      ],
      error: null,
    });

    const urls = await signedStorageUrls("message-attachments", [
      "user/one.webp",
      "user/one.webp",
      "user/two.webp",
    ]);

    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledWith("message-attachments");
    expect(mocks.createSignedUrls).toHaveBeenCalledTimes(1);
    expect(mocks.createSignedUrls).toHaveBeenCalledWith(
      ["user/one.webp", "user/two.webp"],
      PRIVATE_STORAGE_SIGNED_URL_TTL_SECONDS,
    );
    expect(urls).toEqual(new Map([["user/one.webp", "https://storage.test/one?token=secret"]]));
  });

  it("returns signed attachments on their messages without exposing object paths", async () => {
    const firstMessage = {
      id: "00000000-0000-4000-8000-000000000001",
      subject: "Capture illisible",
    };
    const secondMessage = {
      id: "00000000-0000-4000-8000-000000000002",
      subject: "Sans pièce jointe",
    };
    const attachment = {
      id: "00000000-0000-4000-8000-000000000003",
      adminMessageId: firstMessage.id,
      objectPath: "user/one.webp",
      mimeType: "image/webp",
      byteSize: 321,
      createdAt: new Date("2026-08-09T10:00:00.000Z"),
    };

    const messageBuilder = chainBuilder({ offset: [firstMessage, secondMessage] });
    const totalBuilder = chainBuilder({ where: [{ total: 2 }] });
    const attachmentBuilder = chainBuilder({ orderBy: [attachment] });
    mocks.getDb.mockReturnValue({
      select: vi
        .fn()
        .mockReturnValueOnce(messageBuilder)
        .mockReturnValueOnce(totalBuilder)
        .mockReturnValueOnce(attachmentBuilder),
    });
    mocks.createSignedUrls.mockResolvedValue({
      data: [{ path: attachment.objectPath, signedUrl: "https://storage.test/one?token=secret" }],
      error: null,
    });

    const result = await listAdminMessages({ limit: 50, offset: 0 });

    expect(mocks.createSignedUrls).toHaveBeenCalledOnce();
    expect(result.total).toBe(2);
    expect(result.messages[0]?.attachments).toEqual([
      {
        id: attachment.id,
        mimeType: "image/webp",
        byteSize: 321,
        createdAt: attachment.createdAt,
        signedUrl: "https://storage.test/one?token=secret",
        signedUrlExpiresInSeconds: 300,
      },
    ]);
    expect(result.messages[0]?.attachments[0]).not.toHaveProperty("objectPath");
    expect(result.messages[1]?.attachments).toEqual([]);
  });
});

function chainBuilder(terminal: Record<string, unknown>) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["from", "where", "orderBy", "limit", "offset"]) {
    builder[method] = vi.fn(() => terminal[method] ?? builder);
  }
  return builder;
}
