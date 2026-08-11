import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  createUserNotification: vi.fn(),
  sendEntryStatusTelegram: vi.fn(),
  sendReviewStatusTelegram: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: mocks.getDb }));
vi.mock("@/lib/services/notifications", () => ({
  createUserNotification: mocks.createUserNotification,
  sendEntryStatusTelegram: mocks.sendEntryStatusTelegram,
  sendReviewStatusTelegram: mocks.sendReviewStatusTelegram,
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: mocks.loggerInfo, warn: mocks.loggerWarn, error: mocks.loggerError },
}));
vi.mock("@/lib/services/storage", () => ({
  prepareEntryImagePromotion: vi.fn(),
  finalizeEntryImagePromotion: vi.fn(),
  rollbackEntryImagePromotion: vi.fn(),
}));

import type { CurrentUser } from "@/lib/auth/current-user";
import { moderateEntry } from "@/lib/services/entries";
import { moderateReview } from "@/lib/services/reviews";

const actor: CurrentUser = {
  id: "11111111-1111-4111-8111-111111111111",
  telegramId: 6_675_436_692,
  username: "owner",
  displayName: "Owner",
  publicSlug: "owner",
  profilePhotoUrl: null,
  role: "OWNER",
};

type FakeDbOptions = {
  selectRows: unknown[][];
  updateReturningRows?: unknown[][];
};

function fakeDb(options: FakeDbOptions) {
  const selectRows = [...options.selectRows];
  const updateReturningRows = [...(options.updateReturningRows ?? [])];
  const locks: Array<{ strength: string; config: unknown }> = [];
  const inserts: Array<{ values: unknown }> = [];
  const updates: Array<{ values: unknown }> = [];

  function select() {
    const rows = selectRows.shift() ?? [];
    const chain = {
      from: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: () => chain,
      limit: () => chain,
      for: (strength: string, config?: unknown) => {
        locks.push({ strength, config });
        return Promise.resolve(rows);
      },
      then: (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(rows).then(resolve, reject),
    };
    return chain;
  }

  function update() {
    const returningRows = updateReturningRows.shift() ?? [{ id: "updated" }];
    const chain = {
      set: (values: unknown) => {
        updates.push({ values });
        return chain;
      },
      where: () => chain,
      returning: () => Promise.resolve(returningRows),
      then: (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve([]).then(resolve, reject),
    };
    return chain;
  }

  function insert() {
    const chain = {
      values: (values: unknown) => {
        inserts.push({ values });
        return chain;
      },
      returning: () => Promise.resolve([{ id: "notification-id" }]),
      then: (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve([]).then(resolve, reject),
    };
    return chain;
  }

  const tx = { select, update, insert, execute: vi.fn().mockResolvedValue([]) };
  const db = {
    ...tx,
    transaction: (callback: (executor: typeof tx) => unknown) => callback(tx),
  };
  return { db, locks, inserts, updates, execute: tx.execute };
}

const pendingReview = {
  id: "22222222-2222-4222-8222-222222222222",
  entryId: "33333333-3333-4333-8333-333333333333",
  userId: "44444444-4444-4444-8444-444444444444",
  status: "PENDING_REVIEW",
  approvedAt: null,
  publishedAt: null,
  entryName: "Fiche test",
  telegramId: 123456,
  notifyReviewStatus: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createUserNotification.mockResolvedValue({ id: "internal-notification" });
  mocks.sendEntryStatusTelegram.mockResolvedValue(true);
  mocks.sendReviewStatusTelegram.mockResolvedValue(true);
});

describe("review moderation transaction", () => {
  it.each([
    ["APPROVED", "PUBLISHED"],
    ["REJECTED", "REJECTED"],
    ["CHANGES_REQUESTED", "CHANGES_REQUESTED"],
  ] as const)("persists %s atomically as %s", async (requestedStatus, persistedStatus) => {
    const fake = fakeDb({ selectRows: [[pendingReview]] });
    mocks.getDb.mockReturnValue(fake.db);

    const result = await moderateReview(
      pendingReview.id,
      {
        status: requestedStatus,
        ...(requestedStatus === "APPROVED" ? {} : { reason: "Motif de test valide" }),
      },
      actor,
      "request-test",
    );

    expect(result).toMatchObject({ status: persistedStatus, notificationWarning: false });
    expect(fake.locks).toHaveLength(1);
    expect(fake.locks[0]).toMatchObject({ strength: "update" });
    expect(fake.locks[0]?.config).toMatchObject({ of: expect.anything() });
    expect(fake.execute).toHaveBeenCalledTimes(1);
    expect(fake.inserts.length).toBeGreaterThanOrEqual(2); // notification + audit
  });

  it("keeps a committed approval when Telegram delivery fails", async () => {
    const fake = fakeDb({ selectRows: [[pendingReview]] });
    mocks.getDb.mockReturnValue(fake.db);
    mocks.sendReviewStatusTelegram.mockResolvedValue(false);

    const result = await moderateReview(pendingReview.id, { status: "APPROVED" }, actor);

    expect(result).toMatchObject({ status: "PUBLISHED", notificationWarning: true });
    expect(fake.updates[0]?.values).toMatchObject({ status: "PUBLISHED" });
    expect(mocks.sendReviewStatusTelegram).toHaveBeenCalledTimes(1);
  });

  it("returns 409 when another team member already handled the review", async () => {
    const fake = fakeDb({
      selectRows: [[{ ...pendingReview, status: "PUBLISHED" }]],
    });
    mocks.getDb.mockReturnValue(fake.db);

    await expect(
      moderateReview(pendingReview.id, { status: "REJECTED", reason: "Trop tard" }, actor),
    ).rejects.toMatchObject({ code: "ALREADY_MODERATED", status: 409 });
  });
});

describe("entry moderation transaction", () => {
  it.each(["APPROVED", "REJECTED", "CHANGES_REQUESTED"] as const)(
    "persists %s and creates audit/notification work",
    async (status) => {
      const entry = {
        id: "55555555-5555-4555-8555-555555555555",
        status: "PENDING_REVIEW",
        publicNumber: 25,
        name: "Fiche de modération",
        approvedAt: null,
        publishedAt: null,
      };
      const recipient = {
        userId: "66666666-6666-4666-8666-666666666666",
        telegramId: 789,
        entryName: entry.name,
      };
      const fake = fakeDb({ selectRows: [[entry], [recipient]] });
      mocks.getDb.mockReturnValue(fake.db);

      const result = await moderateEntry(
        entry.id,
        { status, ...(status === "APPROVED" ? {} : { reason: "Motif de test valide" }) },
        actor,
      );

      expect(result).toMatchObject({ status, notificationWarning: false });
      expect(fake.updates[0]?.values).toMatchObject({ status });
      expect(fake.inserts.length).toBeGreaterThanOrEqual(1); // audit
      expect(mocks.createUserNotification).toHaveBeenCalledTimes(1);
    },
  );

  it("does not roll back entry moderation when Telegram delivery fails", async () => {
    const entry = {
      id: "77777777-7777-4777-8777-777777777777",
      status: "PENDING_REVIEW",
      publicNumber: 26,
      name: "Fiche Telegram indisponible",
      approvedAt: null,
      publishedAt: null,
    };
    const fake = fakeDb({
      selectRows: [[entry], [{ userId: actor.id, telegramId: 789, entryName: entry.name }]],
    });
    mocks.getDb.mockReturnValue(fake.db);
    mocks.sendEntryStatusTelegram.mockResolvedValue(false);

    const result = await moderateEntry(entry.id, { status: "APPROVED" }, actor);

    expect(result).toMatchObject({ status: "APPROVED", notificationWarning: true });
    expect(fake.updates[0]?.values).toMatchObject({ status: "APPROVED" });
  });
});
