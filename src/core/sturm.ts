/**
 * Sturm 链构造、精确符号判定与实根隔离。
 *
 * 数学依据（广义 Sturm 定理）：设 p 为实系数多项式，p₀ = p，p₁ = p′，
 * p_{k+1} = -rem(p_{k-1}, p_k)，直到余式为零。对任意 a < b 且 p(a)、p(b)
 * 均不为零，开区间 (a, b) 内 p 的**不同**实根个数等于 V(a) - V(b)，
 * 其中 V(x) 为 Sturm 链在 x 处符号序列的变号数（序列中的零跳过不计）。
 */
import { Poly, derivePoly, evalPoly, negPoly, remPoly, trimPoly } from './polynomial';
import {
  Rat,
  Sign,
  addRat,
  cmpRat,
  divRat,
  midRat,
  ratFromInt,
  signRat,
  subRat,
} from './rational';

/** 构造 Sturm 链；要求 deg(p) >= 1 */
export function buildSturmChain(p: Poly): Poly[] {
  if (p.length < 2) throw new Error('Sturm 链要求多项式次数至少为 1');
  const chain: Poly[] = [trimPoly(p)];
  const d1 = derivePoly(p);
  if (d1.length === 0) return chain; // 不会发生（次数 >= 1），防御性返回
  chain.push(d1);
  for (;;) {
    const prev = chain[chain.length - 2];
    const curr = chain[chain.length - 1];
    const next = trimPoly(negPoly(remPoly(prev, curr)));
    if (next.length === 0) break; // 余式为零，链结束（末项即 gcd(p, p′) 的倍式）
    chain.push(next);
    if (next.length === 1) break; // 已到非零常数项
  }
  return chain;
}

/** Sturm 链各有理系数多项式在有理点 x 处的精确符号序列 */
export function signsAt(chain: Poly[], x: Rat): Sign[] {
  return chain.map((q) => signRat(evalPoly(q, x)));
}

/** 变号数：跳过序列中的零 */
export function countVariations(signs: Sign[]): number {
  let variations = 0;
  let prev: Sign = 0;
  for (const s of signs) {
    if (s === 0) continue;
    if (prev !== 0 && s !== prev) variations++;
    prev = s;
  }
  return variations;
}

/** 一个根的隔离区间及其两端的 Sturm 变号数证据 */
export interface IsolatingInterval {
  left: Rat;
  right: Rat;
  leftSigns: Sign[];
  rightSigns: Sign[];
  leftVariations: number;
  rightVariations: number;
}

interface EvalPoint {
  signs: Sign[];
  variations: number;
}

/**
 * 用精确符号判定 + 二分，把开区间 (a, b) 内的每个不同实根隔离到
 * 互不相交的开区间 (l, r) 中（端点均不是根，V(l) - V(r) = 1）。
 * 前置条件：p(a) ≠ 0 且 p(b) ≠ 0。
 */
export function isolateRoots(chain: Poly[], a: Rat, b: Rat): IsolatingInterval[] {
  const p0 = chain[0];
  const cache = new Map<string, EvalPoint>();
  const evalAt = (x: Rat): EvalPoint => {
    const key = `${x.n}/${x.d}`;
    let hit = cache.get(key);
    if (!hit) {
      const signs = signsAt(chain, x);
      hit = { signs, variations: countVariations(signs) };
      cache.set(key, hit);
    }
    return hit;
  };

  const results: IsolatingInterval[] = [];
  const stack: Array<[Rat, Rat]> = [[a, b]];

  const pushResult = (l: Rat, r: Rat) => {
    const el = evalAt(l);
    const er = evalAt(r);
    results.push({
      left: l,
      right: r,
      leftSigns: el.signs,
      rightSigns: er.signs,
      leftVariations: el.variations,
      rightVariations: er.variations,
    });
  };

  /** m 恰为有理根时，收缩出严格位于 (l, r) 内、只含 m 的窗口 */
  const exactRootWindow = (m: Rat, l: Rat, r: Rat): [Rat, Rat] => {
    let delta = divRat(subRat(r, l), ratFromInt(4n));
    for (;;) {
      const ll = subRat(m, delta);
      const rr = addRat(m, delta);
      if (signRat(evalPoly(p0, ll)) !== 0 && signRat(evalPoly(p0, rr)) !== 0) {
        if (evalAt(ll).variations - evalAt(rr).variations === 1) return [ll, rr];
      }
      delta = divRat(delta, ratFromInt(2n));
    }
  };

  /**
   * (l, r) 内恰有一个根时，继续二分直到区间两端都严格落入 (l, r) 内部，
   * 使相邻隔离区间之间留出明确间隙（根与端点距离为正，故必终止）。
   */
  const refineSingle = (l: Rat, r: Rat): [Rat, Rat] => {
    let ll = l;
    let rr = r;
    for (;;) {
      if (cmpRat(ll, l) > 0 && cmpRat(rr, r) < 0) return [ll, rr];
      const m = midRat(ll, rr);
      if (signRat(evalPoly(p0, m)) === 0) return exactRootWindow(m, ll, rr);
      if (evalAt(ll).variations - evalAt(m).variations === 1) rr = m;
      else ll = m;
    }
  };

  while (stack.length > 0) {
    const [l, r] = stack.pop()!;
    const count = evalAt(l).variations - evalAt(r).variations; // (l, r) 内不同实根数
    if (count <= 0) continue;
    if (count === 1) {
      const [ll, rr] = refineSingle(l, r);
      pushResult(ll, rr);
      continue;
    }

    const m = midRat(l, r);
    if (signRat(evalPoly(p0, m)) === 0) {
      // 二分中点恰好是有理根：窗口严格位于 (l, r) 内，两侧继续隔离
      const [ll, rr] = exactRootWindow(m, l, r);
      pushResult(ll, rr);
      stack.push([l, ll], [rr, r]);
    } else {
      stack.push([l, m], [m, r]);
    }
  }

  // 按数值升序排列；由构造可知各开区间互不相交
  results.sort((u, v) => cmpRat(u.left, v.left));
  return results;
}
