/**
 * `request.security` needs a second evaluation context: Pine runs the
 * expression over the requested series, and the transpiler has no way to do
 * that. Its bundled implementation silently returns the CHART's value instead,
 * which looks like data and is wrong. Until the engine can build a secondary
 * series, every call is rewritten to `na` and reported to the caller.
 */

export interface SecurityCall {
  /** Raw arguments as written in the source. */
  symbol: string;
  timeframe: string;
  expression: string;
}

const CALL = 'request.security(';

/** Index of the `)` matching the `(` at `open`, or -1. */
function matchingParen(source: string, open: number): number {
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') depth += 1;
    else if (char === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/** Split a call's arguments on top-level commas. */
function splitArgs(source: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(' || char === '[') depth += 1;
    else if (char === ')' || char === ']') depth -= 1;
    else if (char === ',' && depth === 0) {
      args.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  args.push(source.slice(start).trim());
  return args;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Find every `request.security(...)` call. Comments and string literals are
 * skipped so a mention in prose is not rewritten.
 */
export function findSecurityCalls(source: string): SecurityCall[] {
  const calls: SecurityCall[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index]!;

    if (char === '/' && source[index + 1] === '/') {
      const end = source.indexOf('\n', index);
      index = end === -1 ? source.length : end;
      continue;
    }

    if (char === '"' || char === "'") {
      let cursor = index + 1;
      while (cursor < source.length && source[cursor] !== char) {
        if (source[cursor] === '\\') cursor += 1;
        cursor += 1;
      }
      index = cursor + 1;
      continue;
    }

    if (source.startsWith(CALL, index)) {
      const open = index + CALL.length - 1;
      const close = matchingParen(source, open);
      if (close === -1) break;
      const [symbol = '', timeframe = '', expression = ''] = splitArgs(
        source.slice(open + 1, close),
      );
      calls.push({ symbol: unquote(symbol), timeframe: unquote(timeframe), expression });
      index = close + 1;
      continue;
    }

    index += 1;
  }
  return calls;
}

export interface NeutralizedSource {
  source: string;
  calls: SecurityCall[];
}

/** Replace every `request.security(...)` call with `na`. */
export function neutralizeSecurity(source: string): NeutralizedSource {
  const calls = findSecurityCalls(source);
  if (calls.length === 0) return { source, calls };

  let output = '';
  let index = 0;
  while (index < source.length) {
    const char = source[index]!;

    if (char === '/' && source[index + 1] === '/') {
      const end = source.indexOf('\n', index);
      const stop = end === -1 ? source.length : end;
      output += source.slice(index, stop);
      index = stop;
      continue;
    }

    if (char === '"' || char === "'") {
      let cursor = index + 1;
      while (cursor < source.length && source[cursor] !== char) {
        if (source[cursor] === '\\') cursor += 1;
        cursor += 1;
      }
      output += source.slice(index, cursor + 1);
      index = cursor + 1;
      continue;
    }

    if (source.startsWith(CALL, index)) {
      const open = index + CALL.length - 1;
      const close = matchingParen(source, open);
      if (close === -1) {
        output += source.slice(index);
        break;
      }
      output += 'na';
      index = close + 1;
      continue;
    }

    output += char;
    index += 1;
  }

  return { source: output, calls };
}
