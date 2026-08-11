import "server-only";

import { getSqlClient } from "@/lib/db";
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
  const [session] = await getSqlClient()<Array<{ id: string }>>`
    insert into user_sessions (
      user_id, started_at, last_activity_at, duration_seconds,
      platform, app_version, client_session_id
    ) values (
      ${input.userId}::uuid, now(), now(), 0,
      ${input.platform}::user_session_platform,
      ${input.appVersion ?? null}, ${input.clientSessionId}
    )
    on conflict (client_session_id) do update set
      last_activity_at=greatest(user_sessions.last_activity_at, now()),
      duration_seconds=greatest(coalesce(user_sessions.duration_seconds,0),
        extract(epoch from (now()-user_sessions.started_at))::int)
    returning id
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
        duration_seconds=greatest(coalesce(duration_seconds,0),
          extract(epoch from (last_activity_at-started_at))::int)
      where user_id=${input.userId}::uuid and platform='TELEGRAM_BOT'
        and ended_at is null and id<>${session.id}::uuid
    `;
  }
  return session.id;
}

export async function touchUserSession(clientSessionId: string): Promise<void> {
  await getSqlClient()`
    update user_sessions
    set last_activity_at=now(),
      duration_seconds=greatest(coalesce(duration_seconds,0),
        extract(epoch from (now()-started_at))::int)
    where client_session_id=${clientSessionId} and ended_at is null
  `;
}

export async function endUserSession(clientSessionId: string): Promise<void> {
  await getSqlClient()`
    update user_sessions
    set ended_at=coalesce(ended_at,now()), last_activity_at=now(),
      duration_seconds=greatest(coalesce(duration_seconds,0),
        extract(epoch from (now()-started_at))::int)
    where client_session_id=${clientSessionId}
  `;
}

export async function recordUserActivityEvent(input: {
  userId: string;
  eventType: UserActivityEventType;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  clientSessionId?: string | null;
}) {
  const metadata = JSON.stringify(input.metadata ?? {});
  if (new TextEncoder().encode(metadata).byteLength > 16_000) {
    throw new Error("User activity metadata is too large");
  }
  const [event] = await getSqlClient()<Array<{ id: string }>>`
    with selected_session as (
      select id from user_sessions
      where user_id=${input.userId}::uuid and ended_at is null
        and (${input.clientSessionId ?? null}::text is null
          or client_session_id=${input.clientSessionId ?? null})
      order by
        case when client_session_id=${input.clientSessionId ?? null} then 0 else 1 end,
        last_activity_at desc
      limit 1
    ), touched_session as (
      update user_sessions set
        last_activity_at=now(),
        duration_seconds=greatest(coalesce(duration_seconds,0),
          extract(epoch from (now()-started_at))::int)
      where id=(select id from selected_session)
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
