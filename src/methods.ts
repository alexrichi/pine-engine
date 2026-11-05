/**
 * Pine `method` declarations on a primitive receiver (`float`, `int`, `bool`,
 * `string`, `color`) become JavaScript member calls, but primitives carry no
 * prototype to attach to, so `x.is_not_na()` throws at runtime.
 *
 * The transpiler registers such methods in a dispatch table and only attaches
 * them to class prototypes. Rewriting the call sites to plain function calls
 * (`is_not_na(x)`) is the smallest fix that keeps the script running, and it
 * leaves methods on user-defined types untouched.
 */

const RECEIVER_TYPES = new Set(['float', 'int', 'bool', 'string', 'color']);

/** Namespaces that own a member of the same name; never rewritten as a method. */
const NAMESPACES = new Set([
  'array',
  'box',
  'chart',
  'color',
  'input',
  'label',
  'line',
  'linefill',
  'map',
  'math',
  'matrix',
  'plot',
  'polyline',
  'request',
  'runtime',
  'str',
  'strategy',
  'syminfo',
  'table',
  'ta',
  'timeframe',
  'ticker',
]);

const DECLARATION = /^\s*method\s+([A-Za-z_]\w*)\s*\(\s*([A-Za-z_]\w*)/gm;

/** Primitive-receiver method names declared in this source. */
export function primitiveMethods(source: string): Set<string> {
  const names = new Set<string>();
  for (const match of source.matchAll(DECLARATION)) {
    if (RECEIVER_TYPES.has(match[2]!)) names.add(match[1]!);
  }
  return names;
}

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

/**
 * Rewrite `value.method(args)` into `method(value, args)` for every method the
 * source declares on a primitive receiver. Line comments are left alone.
 */
export function rewritePrimitiveMethods(source: string): string {
  const methods = primitiveMethods(source);
  if (methods.size === 0) return source;

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
      const quote = char;
      let cursor = index + 1;
      while (cursor < source.length && source[cursor] !== quote) {
        if (source[cursor] === '\\') cursor += 1;
        cursor += 1;
      }
      output += source.slice(index, cursor + 1);
      index = cursor + 1;
      continue;
    }

    const call = /^([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*\(/.exec(source.slice(index));
    if (call) {
      const [, receiver, method] = call;
      if (
        methods.has(method!) &&
        !NAMESPACES.has(receiver!) &&
        !/^\s*(?:method|type)\b/.test(output.slice(output.lastIndexOf('\n') + 1))
      ) {
        const open = index + call[0].length - 1;
        const close = matchingParen(source, open);
        if (close !== -1) {
          const args = source.slice(open + 1, close).trim();
          output += args ? `${method}(${receiver}, ${args})` : `${method}(${receiver})`;
          index = close + 1;
          continue;
        }
      }
    }

    output += char;
    index += 1;
  }

  return output;
}
