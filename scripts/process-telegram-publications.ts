import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

import { processScheduledPublications } from "../src/lib/services/publications";
import { processQueuedTelegramBroadcasts } from "../src/lib/services/telegram-entry-broadcasts";

async function main() {
  const scheduled = await processScheduledPublications();
  const broadcasts = await processQueuedTelegramBroadcasts();
  console.log(JSON.stringify({ scheduled, broadcasts }));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
