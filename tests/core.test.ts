/**
 * 核心数学模块测试（node:test）：
 * 覆盖 verify 服务要求的三个场景 —— 两个实根、无实根、端点根拒绝，
 * 以及精确中点根、重根去重、升序互不相交等关键性质。
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AnalysisError, analyzePolynomial } from '../src/core/analyze';
import { evalPoly } from '../src/core/polynomial';
import { cmpRat, makeRat, ratToString } from '../src/core/rational';

test('两个实根：x^2 − 2 在 (−2, 2) 内隔离出 ±√2', () => {
  const res = analyzePolynomial({ coeffsDesc: [1n, 0n, -2n], a: -2n, b: 2n });

  assert.equal(res.totalRoots, 2);
  assert.equal(res.intervals.length, 2);
  assert.equal(res.variationsAtA - res.variationsAtB, 2);

  // 升序且互不相交（开区间之间有空隙）
  assert.ok(cmpRat(res.intervals[0].right, res.intervals[1].left) < 0);

  // −√2 ≈ −1.41421356… 落在第一段
  assert.ok(cmpRat(res.intervals[0].left, makeRat(-1414214n, 1000000n)) < 0);
  assert.ok(cmpRat(res.intervals[0].right, makeRat(-1414213n, 1000000n)) > 0);
  // √2 落在第二段
  assert.ok(cmpRat(res.intervals[1].left, makeRat(1414213n, 1000000n)) < 0);
  assert.ok(cmpRat(res.intervals[1].right, makeRat(1414214n, 1000000n)) > 0);

  // 每段恰含一个根的 Sturm 变号数证据：V(l) − V(r) = 1
  for (const iv of res.intervals) {
    assert.equal(iv.leftVariations - iv.rightVariations, 1);
    assert.equal(iv.leftSigns.length, res.sturmChain.length);
    assert.equal(iv.rightSigns.length, res.sturmChain.length);
  }
});

test('无实根：x^2 + 1 在 (−1, 1) 内根数为 0', () => {
  const res = analyzePolynomial({ coeffsDesc: [1n, 0n, 1n], a: -1n, b: 1n });
  assert.equal(res.totalRoots, 0);
  assert.deepEqual(res.intervals, []);
});

test('无实根：x^2 + x + 1 在 (−5, 5) 内根数为 0', () => {
  const res = analyzePolynomial({ coeffsDesc: [1n, 1n, 1n], a: -5n, b: 5n });
  assert.equal(res.totalRoots, 0);
  assert.deepEqual(res.intervals, []);
});

test('端点根拒绝：x − 1 的左端点 1 是根', () => {
  assert.throws(
    () => analyzePolynomial({ coeffsDesc: [1n, -1n], a: 1n, b: 3n }),
    (err: unknown) =>
      err instanceof AnalysisError && err.code === 'ENDPOINT_ROOT' && /左端点/.test(err.message),
  );
});

test('端点根拒绝：x^2 − 1 的右端点 −1 场景（端点 −1 为根）', () => {
  assert.throws(
    () => analyzePolynomial({ coeffsDesc: [1n, 0n, -1n], a: -3n, b: -1n }),
    (err: unknown) =>
      err instanceof AnalysisError && err.code === 'ENDPOINT_ROOT' && /右端点/.test(err.message),
  );
});

test('首项为零拒绝', () => {
  assert.throws(
    () => analyzePolynomial({ coeffsDesc: [0n, 1n, -1n], a: 0n, b: 3n }),
    (err: unknown) => err instanceof AnalysisError && err.code === 'LEADING_ZERO',
  );
  assert.throws(
    () => analyzePolynomial({ coeffsDesc: [0n, 0n], a: 0n, b: 3n }),
    (err: unknown) => err instanceof AnalysisError && err.code === 'LEADING_ZERO',
  );
});

test('区间端点顺序拒绝：a ≥ b', () => {
  assert.throws(
    () => analyzePolynomial({ coeffsDesc: [1n, 0n, -2n], a: 2n, b: -2n }),
    (err: unknown) => err instanceof AnalysisError && err.code === 'ENDPOINT_ORDER',
  );
});

test('次数范围拒绝：0 次与 13 次', () => {
  assert.throws(
    () => analyzePolynomial({ coeffsDesc: [5n], a: 0n, b: 1n }),
    (err: unknown) => err instanceof AnalysisError && err.code === 'DEGREE_RANGE',
  );
  assert.throws(
    () =>
      analyzePolynomial({
        coeffsDesc: [1n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, -1n],
        a: 0n,
        b: 3n,
      }),
    (err: unknown) => err instanceof AnalysisError && err.code === 'DEGREE_RANGE',
  );
});

test('精确中点根：x^2 − 1 在 (0, 2) 的二分中点 1 恰为根', () => {
  const res = analyzePolynomial({ coeffsDesc: [1n, 0n, -1n], a: 0n, b: 2n });
  assert.equal(res.totalRoots, 1);
  assert.equal(res.intervals.length, 1);
  const iv = res.intervals[0];
  // 根 1 严格落在开区间内部，且端点不是根
  assert.ok(cmpRat(iv.left, makeRat(1n)) < 0);
  assert.ok(cmpRat(iv.right, makeRat(1n)) > 0);
  assert.notEqual(evalPoly(res.polynomial, iv.left).n, 0n);
  assert.notEqual(evalPoly(res.polynomial, iv.right).n, 0n);
  assert.equal(iv.leftVariations - iv.rightVariations, 1);
});

test('重根按不同根计数：(x−1)^2·(x−2) = x^3 − 4x^2 + 5x − 2 在 (0, 3)', () => {
  const res = analyzePolynomial({ coeffsDesc: [1n, -4n, 5n, -2n], a: 0n, b: 3n });
  assert.equal(res.totalRoots, 2);
  assert.equal(res.intervals.length, 2);
  for (const iv of res.intervals) {
    assert.equal(iv.leftVariations - iv.rightVariations, 1);
  }
});

test('三个根（含中点精确根 0）：x^3 − x 在 (−2, 2)', () => {
  const res = analyzePolynomial({ coeffsDesc: [1n, 0n, -1n, 0n], a: -2n, b: 2n });
  assert.equal(res.totalRoots, 3);
  assert.equal(res.intervals.length, 3);
  // Sturm 链次数结构 [3, 2, 1, 0]
  assert.deepEqual(
    res.sturmChain.map((p) => p.length - 1),
    [3, 2, 1, 0],
  );
  // 升序且互不相交
  for (let i = 1; i < res.intervals.length; i++) {
    assert.ok(cmpRat(res.intervals[i - 1].right, res.intervals[i].left) < 0);
  }
  // 根 0 落在中间段内部
  const mid = res.intervals[1];
  assert.ok(cmpRat(mid.left, makeRat(0n)) < 0 && cmpRat(mid.right, makeRat(0n)) > 0);
});

test('12 次上限：x^12 − 1 在 (−2, 2) 内有 ±1 两个根', () => {
  const res = analyzePolynomial({
    coeffsDesc: [1n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, -1n],
    a: -2n,
    b: 2n,
  });
  assert.equal(res.degree, 12);
  assert.equal(res.totalRoots, 2);
  assert.equal(res.intervals.length, 2);
});

test('有理数工具：约分、比较与文本', () => {
  assert.equal(ratToString(makeRat(6n, -8n)), '-3/4');
  assert.equal(ratToString(makeRat(0n, 5n)), '0');
  assert.ok(cmpRat(makeRat(1n, 3n), makeRat(2n, 5n)) < 0);
});
