# pine-engine

Pine Script v6 execution engine: transpile a script and run it bar by bar over
OHLCV data.

- Transpiler: [`@opus-aether-ai/pine-transpiler`](https://www.npmjs.com/package/@opus-aether-ai/pine-transpiler) (MIT)
- Technical functions: [`oakscriptjs`](https://www.npmjs.com/package/oakscriptjs) (MIT)

No AGPL code, no chart library, no editor, no DOM.

## Usage

```ts
import { runPineScript } from '@screener/pine-engine';

const result = runPineScript({
  source: pineSource,
  bars,               // { time, open, high, low, close, volume }[]
  timeframe: '60',
  inputs: { length: 21 },
});

result.plots;     // [{ id, title, type, values }]
result.visuals;   // [{ call: 'line.new', args, barIndex }]
result.inputs;    // declared inputs with their defaults
result.missingStd // standard-library names that had to be stubbed
```

`runPineScript` never throws: a transpile or runtime failure comes back as
`{ ok: false, error }`.

## Tests

```bash
npm install
npm run typecheck
npm test
```

The suite compares every bar against an independently written OakScriptJS
script, so a regression in the standard-library shim fails the run.

## License

MIT. See `LICENSE`.
