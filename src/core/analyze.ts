/**
 * 顶层分析入口：校验输入、构造 Sturm 链、隔离全部不同实根。
 * 所有失败都以带业务错误码的 AnalysisError 抛出，供 Worker 转成消息。
 */
import { Poly, degreePoly, evalPoly, polyFromBigIntsDesc } from './polynomial';
import { Rat, Sign, ratFromInt, signRat } from './rational';
import {
  IsolatingInterval,
  buildSturmChain,
  countVariations,
  isolateRoots,
  signsAt,
} from './sturm';

export const MIN_DEGREE = 1;
export const MAX_DEGREE = 12;

export type AnalysisErrorCode =
  | 'DEGREE_RANGE' // 次数不在 1..12
  | 'LEADING_ZERO' // 首项系数为零（或多项式恒为零）
  | 'ENDPOINT_ORDER' // 区间端点不满足 a < b
  | 'ENDPOINT_ROOT'; // 区间端点恰为根

export class AnalysisError extends Error {
  readonly code: AnalysisErrorCode;
  constructor(code: AnalysisErrorCode, message: string) {
    super(message);
    this.name = 'AnalysisError';
    this.code = code;
  }
}

export interface AnalysisInput {
  /** 降幂排列的整数系数，coeffsDesc[0] 为首项 */
  coeffsDesc: bigint[];
  a: bigint;
  b: bigint;
}

export interface AnalysisResult {
  degree: number;
  polynomial: Poly;
  sturmChain: Poly[];
  a: Rat;
  b: Rat;
  signsAtA: Sign[];
  signsAtB: Sign[];
  variationsAtA: number;
  variationsAtB: number;
  /** 开区间 (a, b) 内不同实根数 = V(a) - V(b) */
  totalRoots: number;
  /** 升序、互不相交的隔离区间，每段恰含一个根 */
  intervals: IsolatingInterval[];
}

export function analyzePolynomial(input: AnalysisInput): AnalysisResult {
  const { coeffsDesc, a, b } = input;
  const degree = coeffsDesc.length - 1;
  if (degree < MIN_DEGREE || degree > MAX_DEGREE) {
    throw new AnalysisError(
      'DEGREE_RANGE',
      `次数须为 ${MIN_DEGREE} 至 ${MAX_DEGREE} 的整数（当前为 ${degree}）`,
    );
  }
  const polynomial = polyFromBigIntsDesc(coeffsDesc);
  if (polynomial.length === 0 || degreePoly(polynomial) !== degree) {
    throw new AnalysisError(
      'LEADING_ZERO',
      '首项系数为零：请降低多项式次数，或为当前次数填写非零首项系数',
    );
  }
  if (a >= b) {
    throw new AnalysisError('ENDPOINT_ORDER', `区间端点须满足 a < b（当前 a=${a}, b=${b}）`);
  }

  const sturmChain = buildSturmChain(polynomial);
  const ra = ratFromInt(a);
  const rb = ratFromInt(b);
  if (signRat(evalPoly(polynomial, ra)) === 0) {
    throw new AnalysisError(
      'ENDPOINT_ROOT',
      `左端点 x = ${a} 恰为多项式的根，Sturm 定理要求端点非根，请调整区间`,
    );
  }
  if (signRat(evalPoly(polynomial, rb)) === 0) {
    throw new AnalysisError(
      'ENDPOINT_ROOT',
      `右端点 x = ${b} 恰为多项式的根，Sturm 定理要求端点非根，请调整区间`,
    );
  }

  const signsAtA = signsAt(sturmChain, ra);
  const signsAtB = signsAt(sturmChain, rb);
  const variationsAtA = countVariations(signsAtA);
  const variationsAtB = countVariations(signsAtB);
  const intervals = isolateRoots(sturmChain, ra, rb);

  return {
    degree,
    polynomial,
    sturmChain,
    a: ra,
    b: rb,
    signsAtA,
    signsAtB,
    variationsAtA,
    variationsAtB,
    totalRoots: variationsAtA - variationsAtB,
    intervals,
  };
}
