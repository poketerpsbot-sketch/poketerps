const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function timezoneOffsetMinutes(date: Date, timeZone: string): number {
  const timeZoneName = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
    hour: "2-digit",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;
  if (!timeZoneName || timeZoneName === "GMT") return 0;
  const match = /^GMT([+-])(\d{2}):?(\d{2})$/.exec(timeZoneName);
  if (!match) throw new RangeError(`Unsupported timezone offset: ${timeZoneName}`);
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "+" ? minutes : -minutes;
}

/** Converts a datetime-local wall-clock value in the app timezone to UTC. */
export function zonedDateTimeToUtc(value: string, timeZone: string): Date {
  const match = LOCAL_DATE_TIME_PATTERN.exec(value);
  if (!match) throw new RangeError("Invalid local datetime value");
  const [, year, month, day, hour, minute] = match;
  const wallClockUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  const firstOffset = timezoneOffsetMinutes(new Date(wallClockUtc), timeZone);
  let timestamp = wallClockUtc - firstOffset * 60_000;
  const correctedOffset = timezoneOffsetMinutes(new Date(timestamp), timeZone);
  if (correctedOffset !== firstOffset) timestamp = wallClockUtc - correctedOffset * 60_000;
  const result = new Date(timestamp);
  if (Number.isNaN(result.valueOf())) throw new RangeError("Invalid local datetime value");
  return result;
}
