import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  unsafe: vi.fn(),
  signedStorageUrls: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getSqlClient: () => ({ unsafe: mocks.unsafe }),
  getDb: vi.fn(),
}));
vi.mock("@/lib/services/storage-url", () => ({
  publicStorageUrl: vi.fn(() => null),
  signedStorageUrls: mocks.signedStorageUrls,
}));
vi.mock("@/lib/services/user-activity", () => ({ tryRecordUserActivityEvent: vi.fn() }));

import { listContestHallOfFame } from "@/lib/services/contests";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signedStorageUrls.mockResolvedValue(
    new Map([["results/final.jpg", "https://example.supabase.co/signed/final.jpg"]]),
  );
});

describe("public contest Hall of Fame query", () => {
  it("filters private, unfinished, hidden/deleted and banned results in SQL", async () => {
    mocks.unsafe.mockResolvedValue([{ items: [], total: 0 }]);

    await listContestHallOfFame({ limit: 3, offset: 0 });

    const [query, parameters] = mocks.unsafe.mock.calls[0] as [string, unknown[]];
    expect(query).toContain("c.deleted_at is null");
    expect(query).toContain("c.status::text='ENDED'");
    expect(query).toContain("c.ends_at<=now()");
    expect(query).toContain("c.result_published_at is not null");
    expect(query).toContain("cp.status='APPROVED'");
    expect(query).toContain("u.profile_visibility='PUBLIC'");
    expect(query).toContain("not u.is_banned");
    expect(query).toContain("u.role<>'BANNED'");
    expect(query).toContain("order by result_published_at desc,id desc");
    expect(parameters).toEqual([3, 0]);
  });

  it("returns all podium members, guesses and a signed private result image", async () => {
    mocks.unsafe.mockResolvedValue([
      {
        total: 1,
        items: [
          {
            id: "contest-1",
            slug: "devine-le-poids",
            title: "Devine le poids",
            contest_type: "WEIGHT_GUESS",
            ends_at: "2026-08-11T10:00:00.000Z",
            result_published_at: "2026-08-12T10:00:00.000Z",
            result_text: "Bravo !",
            result_image_url: null,
            result_image_path: "results/final.jpg",
            secret_weight: "12.470000",
            weight_unit: "g",
            custom_weight_unit: null,
            winners: [
              {
                id: "winner-1",
                rank: 1,
                label: "Champion",
                prize: {},
                awarded_at: "2026-08-12T10:00:00.000Z",
                participant: {
                  id: "user-1",
                  public_slug: "coshan",
                  display_name: "Coshan",
                  telegram_username: "coshan",
                  profile_photo_url: null,
                },
                guess: { numeric_value: 12.46, unit: "g" },
              },
              {
                id: "winner-2",
                rank: 2,
                label: null,
                prize: {},
                awarded_at: "2026-08-12T10:00:00.000Z",
                participant: {
                  id: "user-2",
                  public_slug: "terphunter",
                  display_name: "Terp Hunter",
                  telegram_username: "terphunter",
                  profile_photo_url: null,
                },
                guess: { numeric_value: 12.5, unit: "g" },
              },
            ],
          },
        ],
      },
    ]);

    const result = await listContestHallOfFame({ limit: 20, offset: 0 });

    expect(result.total).toBe(1);
    expect(result.results[0]).toMatchObject({
      title: "Devine le poids",
      resultImageUrl: "https://example.supabase.co/signed/final.jpg",
      resultWeight: 12.47,
      weightUnit: "g",
      winners: [
        { rank: 1, participant: { username: "coshan" }, guess: { numericValue: 12.46 } },
        { rank: 2, participant: { username: "terphunter" }, guess: { numericValue: 12.5 } },
      ],
    });
  });
});
