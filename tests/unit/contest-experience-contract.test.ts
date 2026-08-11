import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  contestParticipationError,
  getContestEffectiveStatus,
} from "@/lib/contests/effective-status";
import { contestGuessInputSchema, createContestSchema } from "@/lib/validation/contests";

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/20260811231831_contest_experience_weight_stats_winner.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

describe("contest experience contract", () => {
  it("derives one effective registration status from server dates", () => {
    const schedule = {
      status: "OPEN",
      startsAt: "2026-08-12T22:04:00.000Z",
      endsAt: "2026-08-20T22:04:00.000Z",
      registrationStartsAt: "2026-08-11T22:07:00.000Z",
      registrationEndsAt: "2026-08-19T22:03:00.000Z",
      registrationsOpen: true,
      participantCount: 0,
      maxParticipants: 2,
    };
    expect(getContestEffectiveStatus(schedule, new Date("2026-08-11T23:00:00.000Z"))).toBe("OPEN");
    expect(contestParticipationError("OPEN")).toBeNull();
    expect(getContestEffectiveStatus(schedule, new Date("2026-08-19T22:03:00.000Z"))).toBe(
      "ENDED_PENDING_RESULT",
    );
  });

  it("requires the hidden answer for a weight contest and validates guesses", () => {
    const base = {
      title: "Devine le poids",
      startsAt: "2026-08-12T10:00:00.000Z",
      endsAt: "2026-08-13T10:00:00.000Z",
      contestType: "WEIGHT_GUESS" as const,
    };
    expect(createContestSchema.safeParse(base).success).toBe(false);
    expect(
      createContestSchema.safeParse({ ...base, secretWeight: 73.5, weightUnit: "g" }).success,
    ).toBe(true);
    expect(contestGuessInputSchema.safeParse({ numericValue: 72.9 }).success).toBe(true);
    expect(contestGuessInputSchema.safeParse({ numericValue: -1 }).success).toBe(false);
  });

  it("keeps private results and durable Telegram delivery data behind RLS", () => {
    for (const table of [
      "contest_guesses",
      "contest_winner_history",
      "contest_view_events",
      "telegram_broadcasts",
      "telegram_broadcast_deliveries",
    ]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
    expect(migration).toContain("('contest-results','contest-results',false");
    expect(migration).toMatch(
      /revoke all privileges on public\.contest_links,public\.contest_guesses,[\s\S]*from anon,authenticated/,
    );
    expect(migration).toContain(
      "revoke execute on function public.enforce_contest_participation_quota()",
    );
  });
});
