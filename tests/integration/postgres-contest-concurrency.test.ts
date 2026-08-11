import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { expect, it } from "vitest";

const concurrencyDatabaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL?.trim();
const postgresIt = concurrencyDatabaseUrl ? it : it.skip;

postgresIt(
  "serializes two real PostgreSQL transactions competing for the last contest place",
  async () => {
    const databaseUrl = concurrencyDatabaseUrl!;
    const admin = postgres(databaseUrl, { max: 1, prepare: false });
    const first = postgres(databaseUrl, { max: 1, prepare: false });
    const second = postgres(databaseUrl, { max: 1, prepare: false });
    const suffix = randomUUID();
    const ownerId = randomUUID();
    const firstUserId = randomUUID();
    const secondUserId = randomUUID();
    const contestId = randomUUID();
    try {
      await admin`
        insert into public.users(id,telegram_id,display_name,public_slug)
        values
          (${ownerId},${`7${Date.now().toString().slice(-11)}`},'Concurrency owner',${`concurrency-owner-${suffix}`}),
          (${firstUserId},${`8${Date.now().toString().slice(-11)}`},'Concurrency first',${`concurrency-first-${suffix}`}),
          (${secondUserId},${`9${Date.now().toString().slice(-11)}`},'Concurrency second',${`concurrency-second-${suffix}`})
      `;
      await admin`
        insert into public.contests(
          id,slug,title,summary,description,rules,status,starts_at,ends_at,
          max_participants,require_entry,created_by_id,registrations_open
        ) values (
          ${contestId},${`last-place-${suffix}`},'Dernière place','Test de concurrence',
          'Deux transactions PostgreSQL réelles se disputent une seule place.',
          'Une seule transaction doit réussir.','OPEN',now()-interval '1 hour',
          now()+interval '1 hour',1,false,${ownerId},true
        )
      `;

      const attempts = await Promise.allSettled([
        first.begin(
          (sql) => sql`
          insert into public.contest_participations(contest_id,user_id,status)
          values (${contestId},${firstUserId},'PENDING_REVIEW')
        `,
        ),
        second.begin(
          (sql) => sql`
          insert into public.contest_participations(contest_id,user_id,status)
          values (${contestId},${secondUserId},'PENDING_REVIEW')
        `,
        ),
      ]);

      expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
      expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);
      const [count] = await admin<{ occupied: number }[]>`
        select count(*)::integer occupied
        from public.contest_participations
        where contest_id=${contestId} and status in ('PENDING_REVIEW','APPROVED')
      `;
      expect(count?.occupied).toBe(1);
    } finally {
      await admin`delete from public.contests where id=${contestId}`.catch(() => undefined);
      await admin`
        delete from public.users where id in (${ownerId},${firstUserId},${secondUserId})
      `.catch(() => undefined);
      await Promise.all([admin.end(), first.end(), second.end()]);
    }
  },
  30_000,
);
