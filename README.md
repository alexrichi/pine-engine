# pine-engine

Pine Script v6 compiler and execution engine for screener-v2. It compiles a
script once and runs it bar by bar over OHLCV data.

- Compiler and runtime: local MIT code derived from `pinescript-js-compiler`
- Differential tests: [`oakscriptjs`](https://www.npmjs.com/package/oakscriptjs) (MIT, dev-only)

No AGPL code, no chart library, no editor, no DOM. A compiled script is a
JavaScript function; `run` rebuilds only the runtime context, so a full-market
scan does not recompile the script for every symbol.

## Usage

```ts
import { compilePine, runPineScript } from '@screener/pine-engine';

const result = runPineScript({
  source: pineSource,
  bars,               // { time, open, high, low, close, volume }[] in ms
  timeframe: '60',
  symbol: 'BINANCE:BTCUSDT',
  inputs: { Length: 21 },
});

result.plots;      // [{ id, title, type, color, values }]
result.drawings;   // { lines, boxes, labels, backgrounds }
result.inputs;     // declared inputs with their defaults
result.missingStd; // builtin names the runtime had to stub
result.warnings;   // compile and runtime warnings
```

`compilePine` compiles once and returns a program whose `run` can be called for
every instrument. Inputs passed to `run` win over compile-time values.
`runPineScript` and `program.run` never throw: a compile or runtime failure
comes back as `{ ok: false, error }`.

## Behaviour

- `request.security` works for the chart's own symbol on its own timeframe and,
  for builtin source expressions (`close`, `[open, close, time]`, ...), on a
  higher timeframe by resampling the chart's bars. Other expressions, lower
  timeframes or foreign symbols return `na` and add a warning; the engine has no
  second data feed. The other `request.*` data functions are callable but also
  return `na` with a warning, so scripts that use them still run.
- `ticker.heikinashi/renko/kagi/linebreak/pointfigure` append a chart-type
  suffix to the symbol; `ticker.standard` strips it.
- `plot` values are aligned to the input bars, including conditional plots and
  warm-up `na`.
- Chained TA works (`ta.ema(ta.ema(close, 9), 9)`) because each TA call keeps a
  source series for its own call site.
- `var` initializes on the first bar from that bar's data.
- `line`, `box`, `label`, `bgcolor` and `table` calls run; the engine returns the
  final drawing objects, not the construction events.
- `alert()` is a no-op. `plotshape`/`plotchar` values are collected but not
  rendered by the app.

## Tests

```bash
npm install
npm run typecheck
npm test
```

The suite includes the ported compiler/runtime tests plus adapter tests for the
RSI preset, EMA independence, chained TA, per-run isolation, inputs, drawings,
`request.security` and unsupported builtins.

## License

MIT. See `LICENSE` and `NOTICE`.
