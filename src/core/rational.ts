/**
 * 基于 BigInt 的精确有理数（既约分数，分母恒正）。
 * 所有运算结果都约分到最简，保证符号判定是精确的。
 */
export interface Rat {
  readonly n: bigint; // 分子
  readonly d: bigint; // 分母（> 0）
}

export type Sign = -1 | 0 | 1;

export function gcdBigInt(a: bigint, b: bigint): bigint {
  if (a < 0n) a = -a;
  if (b < 0n) b = -b;
  while (b !== 0n) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

export function makeRat(n: bigint, d: bigint = 1n): Rat {
  if (d === 0n) throw new Error('有理数分母为零');
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  if (n === 0n) return { n: 0n, d: 1n };
  const g = gcdBigInt(n, d);
  return { n: n / g, d: d / g };
}

export const RAT_ZERO: Rat = { n: 0n, d: 1n };
export const RAT_ONE: Rat = { n: 1n, d: 1n };

export const ratFromInt = (n: bigint): Rat => ({ n, d: 1n });

export const addRat = (a: Rat, b: Rat): Rat =>
  makeRat(a.n * b.d + b.n * a.d, a.d * b.d);

export const subRat = (a: Rat, b: Rat): Rat =>
  makeRat(a.n * b.d - b.n * a.d, a.d * b.d);

export const mulRat = (a: Rat, b: Rat): Rat => makeRat(a.n * b.n, a.d * b.d);

export const divRat = (a: Rat, b: Rat): Rat => {
  if (b.n === 0n) throw new Error('除以零有理数');
  return makeRat(a.n * b.d, a.d * b.n);
};

export const negRat = (a: Rat): Rat => ({ n: -a.n, d: a.d });

export const isZeroRat = (a: Rat): boolean => a.n === 0n;

export const signRat = (a: Rat): Sign => (a.n > 0n ? 1 : a.n < 0n ? -1 : 0);

export const cmpRat = (a: Rat, b: Rat): number => {
  const lhs = a.n * b.d;
  const rhs = b.n * a.d;
  return lhs < rhs ? -1 : lhs > rhs ? 1 : 0;
};

/** (a + b) / 2，二分法用 */
export const midRat = (a: Rat, b: Rat): Rat =>
  makeRat(a.n * b.d + b.n * a.d, 2n * a.d * b.d);

/** 精确分数文本，如 "-3/2" 或 "4" */
export const ratToString = (a: Rat): string =>
  a.d === 1n ? a.n.toString() : `${a.n}/${a.d}`;

/** 用长除法做精确截断的小数近似（仅用于展示，不参与判定） */
export function ratApprox(a: Rat, digits = 10): string {
  const neg = a.n < 0n;
  const n = neg ? -a.n : a.n;
  const intPart = n / a.d;
  let rem = n % a.d;
  let frac = '';
  for (let i = 0; i < digits && rem !== 0n; i++) {
    rem *= 10n;
    frac += (rem / a.d).toString();
    rem %= a.d;
  }
  frac = frac.replace(/0+$/, '');
  return (neg ? '-' : '') + intPart.toString() + (frac ? '.' + frac : '');
}
