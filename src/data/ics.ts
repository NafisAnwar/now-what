export interface IcsEvent {
  uid?: string;
  title: string;
  startAt: string;
  endAt: string;
  location?: string;
  recurrenceRule?: string;
}

export interface IcsParseResult {
  events: IcsEvent[];
  unsupportedRecurrenceCount: number;
}

interface IcsProperty {
  name: string;
  params: Record<string, string>;
  value: string;
}

function unescapeIcsText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function parseContentLine(line: string): IcsProperty | null {
  const colonIdx = line.indexOf(':');
  if (colonIdx < 0) return null;

  const keyPart = line.slice(0, colonIdx);
  const value = line.slice(colonIdx + 1);
  const [rawName, ...rawParams] = keyPart.split(';');
  const name = rawName.toUpperCase();
  const params: Record<string, string> = {};

  for (const rawParam of rawParams) {
    const eqIdx = rawParam.indexOf('=');
    if (eqIdx < 0) continue;
    const key = rawParam.slice(0, eqIdx).toUpperCase();
    const paramValue = rawParam.slice(eqIdx + 1).replace(/^"|"$/g, '');
    params[key] = paramValue;
  }

  return { name, params, value };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatLocalDateTime(date: Date): string {
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
    ':',
    pad(date.getSeconds()),
  ].join('');
}

function parseIcsDate(prop: IcsProperty | undefined): string | null {
  if (!prop) return null;

  const value = prop.value.trim();
  const isDateOnly = prop.params.VALUE === 'DATE' || /^\d{8}$/.test(value);

  if (isDateOnly) {
    if (!/^\d{8}$/.test(value)) return null;
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(4, 6));
    const day = Number(value.slice(6, 8));
    const parsed = new Date(year, month - 1, day);
    if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00`;
  }

  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!match) return null;

  const [, year, month, day, hour, minute, second = '00', utc] = match;
  if (utc) {
    const parsed = new Date(Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    ));
    if (
      parsed.getUTCFullYear() !== Number(year) ||
      parsed.getUTCMonth() !== Number(month) - 1 ||
      parsed.getUTCDate() !== Number(day) ||
      parsed.getUTCHours() !== Number(hour) ||
      parsed.getUTCMinutes() !== Number(minute) ||
      parsed.getUTCSeconds() !== Number(second)
    ) return null;
    return formatLocalDateTime(parsed);
  }

  // Floating times and DTSTART;TZID=... are treated as local wall time.
  // This intentionally does not attempt VTIMEZONE conversion.
  const parsed = new Date(
    Number(year), Number(month) - 1, Number(day),
    Number(hour), Number(minute), Number(second)
  );
  if (
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day) ||
    parsed.getHours() !== Number(hour) ||
    parsed.getMinutes() !== Number(minute) ||
    parsed.getSeconds() !== Number(second)
  ) return null;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

function isDateOnlyProperty(prop: IcsProperty | undefined): boolean {
  if (!prop) return false;
  const value = prop.value.trim();
  return prop.params.VALUE === 'DATE' || /^\d{8}$/.test(value);
}

function endOfLocalDay(value: string): string {
  return `${value.slice(0, 10)}T23:59:59`;
}

export function parseIcsVevents(text: string): IcsParseResult {
  const events: IcsEvent[] = [];
  let unsupportedRecurrenceCount = 0;

  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);
  let inEvent = false;
  let current: Record<string, IcsProperty> = {};

  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true;
      current = {};
      continue;
    }

    if (trimmed === 'END:VEVENT') {
      inEvent = false;

      const startAt = parseIcsDate(current.DTSTART);
      if (!startAt) continue;

      let endAt = parseIcsDate(current.DTEND) ?? startAt;
      if (isDateOnlyProperty(current.DTSTART)) {
        if (isDateOnlyProperty(current.DTEND) && endAt > startAt) {
          endAt = formatLocalDateTime(new Date(new Date(endAt).getTime() - 1000));
        } else if (!current.DTEND) {
          endAt = endOfLocalDay(startAt);
        }
      }
      if (new Date(endAt).getTime() < new Date(startAt).getTime()) continue;
      const recurrenceRule = current.RRULE?.value;
      if (recurrenceRule) unsupportedRecurrenceCount++;

      events.push({
        uid: current.UID?.value || undefined,
        title: current.SUMMARY ? unescapeIcsText(current.SUMMARY.value) : 'Untitled',
        startAt,
        endAt,
        location: current.LOCATION ? unescapeIcsText(current.LOCATION.value) : undefined,
        recurrenceRule,
      });
      continue;
    }

    if (!inEvent) continue;

    const prop = parseContentLine(trimmed);
    if (!prop) continue;
    current[prop.name] = prop;
  }

  return { events, unsupportedRecurrenceCount };
}
