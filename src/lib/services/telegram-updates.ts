import "server-only";

import { getSqlClient } from "@/lib/db";

export async function claimTelegramUpdate(updateId: number): Promise<boolean> {
  const rows = await getSqlClient()<Array<{ update_id: string | number }>>`
    insert into telegram_update_receipts (update_id, received_at, status)
    values (${updateId}, now(), 'PROCESSING')
    on conflict (update_id) do update set
      status = 'PROCESSING',
      error = null,
      processed_at = null,
      received_at = now()
    where telegram_update_receipts.status = 'FAILED'
    returning update_id
  `;
  return rows.length === 1;
}

export async function completeTelegramUpdate(updateId: number): Promise<void> {
  await getSqlClient()`
    update telegram_update_receipts
    set status = 'PROCESSED', processed_at = now(), error = null
    where update_id = ${updateId} and status = 'PROCESSING'
  `;
}

export async function failTelegramUpdate(updateId: number, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : "Unknown Telegram update error";
  await getSqlClient()`
    update telegram_update_receipts
    set status = 'FAILED', processed_at = now(), error = ${message.slice(0, 2_000)}
    where update_id = ${updateId} and status = 'PROCESSING'
  `;
}
