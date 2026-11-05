import { describe, expect, it } from 'vitest';
import { primitiveMethods, rewritePrimitiveMethods } from '../src/methods';

describe('rewritePrimitiveMethods', () => {
  it('lowers a no-argument call on a primitive receiver', () => {
    const source = `method is_not_na(float val) => not na(val)
ph = ta.pivothigh(2, 2)
if ph.is_not_na()
    label.new(bar_index, ph, "pivot")`;
    const rewritten = rewritePrimitiveMethods(source);
    expect(rewritten).toContain('if is_not_na(ph)');
    expect(rewritten).not.toContain('ph.is_not_na');
  });

  it('keeps arguments and adds the receiver first', () => {
    const source = `method clamp(float val, float lo, float hi) => math.max(math.min(val, hi), lo)
x = clamp(close, 1, 2)`;
    expect(rewritePrimitiveMethods('method clamp(float val) => val\nplot(close.clamp(1, 2))')).toContain(
      'clamp(close, 1, 2)',
    );
    expect(source).toBeTruthy();
  });

  it('leaves methods on user-defined types and namespaces alone', () => {
    const source = `method is_not_na(float val) => not na(val)
type P
    float x
method get(P self) => self.x
plot(ta.sma(close, 14))`;
    const rewritten = rewritePrimitiveMethods(source);
    expect(rewritten).toBe(source);
  });

  it('ignores method names inside strings and comments', () => {
    const source = `method is_not_na(float val) => not na(val)
// ph.is_not_na() in a comment
label.new(bar_index, close, "ph.is_not_na()")`;
    const rewritten = rewritePrimitiveMethods(source);
    expect(rewritten).toBe(source);
  });

  it('collects only primitive receiver methods', () => {
    const source = `method a(float x) => x
method b(P p) => p
method c(int x) => x`;
    expect([...primitiveMethods(source)].sort()).toEqual(['a', 'c']);
  });
});
