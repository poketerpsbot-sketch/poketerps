import "server-only";

import { getSqlClient } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export type SessionPlatform = "MINI_APP" | "WEB" | "TELEGRAM_BOT" | "ADMIN_WEB" | "UNKNOWN";

export type UserActivityEventType =
  | "APP_OPEN"
  | "ENTRY_VIEW"
  | "SEARCH"
  | "LIKE"
  | "UNLIKE"
  | "FAVORITE"
  | "REVIEW_SUBMIT"
  | "ENTRY_SUBMIT"
  | "PARTNER_VIEW"
  | "MESSAGE_SENT"
  | "CONTEST_JOIN";

export async function recordUserSession(input: {
  userId: string;
  clientSessionId: string;
  platform: SessionPlatform;
  appVersion?: string | null;
}) {
  const env = getEnv();
  const [session] = await getSqlClient()<Array<{ id: string; client_session_id: string }>>`
    with user_lock as (
      select pg_advisory_xact_lock(hashtextextended(${input.userId},0))
    ), closed_stale as (
      update user_sessions set
        ended_at=greatest(started_at,last_activity_at),
        duration_seconds=least(${env.SESSION_MAX_DURATION_SECONDS}::int,
          greatest(0,extract(epoch from (last_activity_at-started_at))::int))
      from user_lock
      where user_id=${input.userId}::uuid and ended_at is null
        and last_activity_at < now()-make_interval(secs=>${env.SESSION_INACTIVITY_SECONDS}::int)
      returning id
    ), existing as (
      select s.id,s.client_session_id
      from user_sessions s,user_lock
      where s.user_id=${input.userId}::uuid
        and s.platform=${input.platform}::user_session_platform
        and s.ended_at is null and s.client_session_id is not null
        and s.last_activity_at>=now()-make_interval(secs=>${env.SESSION_DEDUP_WINDOW_SECONDS}::int)
      order by s.last_activity_at desc limit 1
    ), inserted as (
      insert into user_sessions (
        user_id,started_at,last_activity_at,duration_seconds,
        platform,app_version,client_session_id
      )
      select ${input.userId}::uuid,now(),now(),0,
        ${input.platform}::user_session_platform,${input.appVersion ?? null},${input.clientSessionId}
      from user_lock where not exists(select 1 from existing)
      returning id,client_session_id
    ), selected as (
      select id,client_session_id from existing
      union all select id,client_session_id from inserted
      limit 1
    ), touched as (
      update user_sessions s set
        last_activity_at=now(),app_version=coalesce(${input.appVersion ?? null},s.app_version),
        duration_seconds=least(${env.SESSION_MAX_DURATION_SECONDS}::int,
          greatest(0,extract(epoch from (now()-s.started_at))::int))
      where s.id=(select id from selected)
      returning s.id,s.client_session_id
    )
    select id,client_session_id from touched
  `;
  if (!session) return null;
  await getSqlClient()`
    insert into user_activity_events (user_id,session_id,event_type,metadata)
    select ${input.userId}::uuid,${session.id}::uuid,'APP_OPEN'::user_activity_event_type,
      jsonb_build_object('platform',${input.platform}::text)
    where not exists(
      select 1 from user_activity_events
      where session_id=${session.id}::uuid and event_type='APP_OPEN'
    )
  `;
  if (input.platform === "TELEGRAM_BOT") {
    await getSqlClient()`
      update user_sessions set ended_at=coalesce(ended_at,now()),
        duration_seconds=least(${env.SESSION_MAX_DURATION_SECONDS}::int,
          greatest(0,extract(epoch from (last_activity_at-started_at))::int))
      where user_id=${input.userId}::uuid and platform='TELEGRAM_BOT'
        and ended_at is null and id<>${session.id}::uuid
    `;
  }
  return { id: session.id, clientSessionId: session.client_session_id };
}

export async function touchUserSession(input: {
  userId: string;
  clientSessionId: string;
  platform?: SessionPlatform;
}): Promise<void> {
  const env = getEnv();
  const [session] = await getSqlClient()<Array<{ id: string }>>`
    with user_lock as (
      select pg_advisory_xact_lock(hashtextextended(${input.userId},0))
    ), closed_stale as (
      update user_sessions set
        ended_at=greatest(started_at,last_activity_at),
        duration_seconds=least(${env.SESSION_MAX_DURATION_SECONDS}::int,
          greatest(0,extract(epoch from (last_activity_at-started_at))::int))
      from user_lock
      where user_id=${input.userId}::uuid and ended_at is null
        and last_activity_at < now()-make_interval(secs=>${env.SESSION_INACTIVITY_SECONDS}::int)
      returning id
    ), active as (
      select s.id from user_sessions s,user_lock
      where s.user_id=${input.userId}::uuid
        and s.client_session_id=${input.clientSessionId} and s.ended_at is null
      order by s.started_at desc limit 1
    ), inserted as (
      insert into user_sessions(
        user_id,started_at,last_activity_at,duration_seconds,platform,client_session_id
      )
      select ${input.userId}::uuid,now(),now(),0,
        ${input.platform ?? "UNKNOWN"}::user_session_platform,${input.clientSessionId}
      from user_lock where not exists(select 1 from active)
      returning id
    ), selected as (
      select id from active union all select id from inserted limit 1
    )
    update user_sessions s set
      last_activity_at=now(),
      duration_seconds=least(${env.SESSION_MAX_DURATION_SECONDS}::int,
        greatest(0,extract(epoch from (now()-s.started_at))::int))
    where s.id=(select id from selected)
    returning s.id
  `;
  if (!session) return;
  await getSqlClient()`
    insert into user_activity_events(user_id,session_id,event_type,metadata)
    select ${input.userId}::uuid,${session.id}::uuid,'APP_OPEN'::user_activity_event_type,
      jsonb_build_object('platform',${input.platform ?? "UNKNOWN"}::text)
    where not exists(
      select 1 from user_activity_events
      where session_id=${session.id}::uuid and event_type='APP_OPEN'
    )
  `;
}

export async function endUserSession(clientSessionId: string): Promise<void> {
  const env = getEnv();
  await getSqlClient()`
    update user_sessions
    set ended_at=coalesce(ended_at,now()), last_activity_at=now(),
      duration_seconds=least(${env.SESSION_MAX_DURATION_SECONDS}::int,
        greatest(0,extract(epoch from (now()-started_at))::int))
    where client_session_id=${clientSessionId} and ended_at is null
  `;
}

export async function recordUserActivityEvent(input: {
  userId: string;
  eventType: UserActivityEventType;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  clientSessionId?: string | null;
  platform?: SessionPlatform;
}) {
  const env = getEnv();
  const metadata = JSON.stringify(input.metadata ?? {});
  if (new TextEncoder().encode(metadata).byteLength > 16_000) {
    throw new Error("User activity metadata is too large");
  }
  const [event] = await getSqlClient()<Array<{ id: string }>>`
    with closed_stale as (
      update user_sessions set
        ended_at=greatest(started_at,last_activity_at),
        duration_seconds=least(${env.SESSION_MAX_DURATION_SECONDS}::int,
          greatest(0,extract(epoch from (last_activity_at-started_at))::int))
      where user_id=${input.userId}::uuid and ended_at is null
        and last_activity_at < now()-make_interval(secs=>${env.SESSION_INACTIVITY_SECONDS}::int)
      returning id
    ), selected_session as (
      select id from user_sessions
      where user_id=${input.userId}::uuid and ended_at is null
        and (${input.clientSessionId ?? null}::text is null
          or client_session_id=${input.clientSessionId ?? null})
      order by
        case when client_session_id=${input.clientSessionId ?? null} then 0 else 1 end,
        last_activity_at desc
      limit 1
    ), created_session as (
      insert into user_sessions(
        user_id,started_at,last_activity_at,duration_seconds,platform,client_session_id
      )
      select ${input.userId}::uuid,now(),now(),0,
        ${input.platform ?? "UNKNOWN"}::user_session_platform,${input.clientSessionId ?? null}
      where ${input.clientSessionId ?? null}::text is not null
        and not exists(select 1 from selected_session)
      returning id
    ), effective_session as (
      select id from selected_session union all select id from created_session limit 1
    ), touched_session as (
      update user_sessions set
        last_activity_at=now(),
        duration_seconds=least(${env.SESSION_MAX_DURATION_SECONDS}::int,
          greatest(0,extract(epoch from (now()-started_at))::int))
      where id=(select id from effective_session)
      returning id
    )
    insert into user_activity_events(
      user_id,session_id,event_type,entity_type,entity_id,metadata
    ) values (
      ${input.userId}::uuid,(select id from touched_session),
      ${input.eventType}::user_activity_event_type,${input.entityType ?? null},
      ${input.entityId ?? null},${metadata}::jsonb
    )
    returning id
  `;
  return event?.id ?? null;
}

export async function tryRecordUserActivityEvent(
  input: Parameters<typeof recordUserActivityEvent>[0],
): Promise<void> {
  try {
    await recordUserActivityEvent(input);
  } catch (error) {
    logger.warn("user_activity_event_failed", {
      userId: input.userId,
      eventType: input.eventType,
      error,
    });
  }
}
