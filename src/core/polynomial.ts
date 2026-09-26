/**
 * 有理系数多项式：coeffs[i] 为 x^i 的系数（升幂存储）。
 * 约定：零多项式为空数组；非零多项式不含高位零系数。
 */
import {
  Rat,
  RAT_ZERO,
  addRat,
  divRat,
  mulRat,
  negRat,
  ratFromInt,
  subRat,
} from './rational';

export type Poly = Rat[];

/** 去掉高位零系数 */
export function trimPoly(p: Poly): Poly {
  let deg = p.length - 1;
  while (deg >= 0 && p[deg].n === 0n) deg--;
  return p.slice(0, deg + 1);
}

/** 次数；零多项式返回 -1 */
export const degreePoly = (p: Poly): number => p.length - 1;

export const isZeroPoly = (p: Poly): boolean => p.length === 0;

/** 由降幂排列的整数系数构造（coeffsDesc[0] 为首项系数） */
export function polyFromBigIntsDesc(coeffsDesc: bigint[]): Poly {
  const asc = [...coeffsDesc].reverse().map(ratFromInt);
  return trimPoly(asc);
}

export function derivePoly(p: Poly): Poly {
  const out: Rat[] = [];
  for (let i = 1; i < p.length; i++) {
    out.push(mulRat(p[i], ratFromInt(BigInt(i))));
  }
  return trimPoly(out);
}

/** Horner 法精确求值 */
export function evalPoly(p: Poly, x: Rat): Rat {
  let acc: Rat = RAT_ZERO;
  for (let i = p.length - 1; i >= 0; i--) {
    acc = addRat(mulRat(acc, x), p[i]);
  }
  return acc;
}

export const negPoly = (p: Poly): Poly => p.map(negRat);

/** 有理数域上的多项式带余除法：返回 a mod b（b ≠ 0） */
export function remPoly(a: Poly, b: Poly): Poly {
  if (b.length === 0) throw new Error('除以零多项式');
  let r = trimPoly(a.slice());
  const db = b.length - 1;
  const leadB = b[db];
  while (r.length > 0 && r.length - 1 >= db) {
    const dr = r.length - 1;
    const factor = divRat(r[dr], leadB);
    const shift = dr - db;
    const next = new Array<Rat>(dr + 1);
    for (let i = 0; i <= dr; i++) next[i] = r[i];
    for (let i = 0; i <= db; i++) {
      next[shift + i] = subRat(next[shift + i], mulRat(factor, b[i]));
    }
    r = trimPoly(next);
  }
  return r;
}
