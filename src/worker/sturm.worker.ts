/**
 * Sturm 实根隔离 Worker：以 BigInt 有理数构造 Sturm 链，
 * 通过精确符号判定与二分把每个根隔离，再把可序列化的结果回传主线程。
 */
import { AnalysisError, analyzePolynomial } from '../core/analyze';
import { polyToString } from '../core/format';
import { ratApprox, ratToString } from '../core/rational';
import type { IsolateRequest, IsolateResult, WorkerResponse } from './protocol';

// 模块内遮蔽全局 self，避免与 DOM lib 的 Window 类型冲突
declare const self: {
  onmessage: ((ev: MessageEvent<IsolateRequest>) => void) | null;
  postMessage(message: WorkerResponse): void;
};

self.onmessage = (ev: MessageEvent<IsolateRequest>) => {
  const msg = ev.data;
  if (!msg || msg.type !== 'isolate') return;
  try {
    const res = analyzePolynomial({
      coeffsDesc: msg.coeffsDesc.map((s) => BigInt(s)),
      a: BigInt(msg.a),
      b: BigInt(msg.b),
    });
    const out: IsolateResult = {
      type: 'result',
      id: msg.id,
      degree: res.degree,
      polynomialText: polyToString(res.polynomial),
      sturmChainText: res.sturmChain.map(polyToString),
      aText: ratToString(res.a),
      bText: ratToString(res.b),
      signsAtA: res.signsAtA,
      signsAtB: res.signsAtB,
      variationsAtA: res.variationsAtA,
      variationsAtB: res.variationsAtB,
      totalRoots: res.totalRoots,
      intervals: res.intervals.map((iv) => ({
        left: ratToString(iv.left),
        right: ratToString(iv.right),
        leftApprox: ratApprox(iv.left, 10),
        rightApprox: ratApprox(iv.right, 10),
        leftSigns: iv.leftSigns,
        rightSigns: iv.rightSigns,
        leftVariations: iv.leftVariations,
        rightVariations: iv.rightVariations,
      })),
    };
    self.postMessage(out);
  } catch (err) {
    self.postMessage({
      type: 'error',
      id: msg.id,
      code: err instanceof AnalysisError ? err.code : 'INTERNAL',
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
