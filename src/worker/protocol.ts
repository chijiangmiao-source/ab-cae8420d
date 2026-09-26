/** 主线程与 Sturm Worker 之间的消息协议（全部可结构化克隆，BigInt 以字符串传递） */
import { AnalysisErrorCode } from '../core/analyze';

export interface IsolateRequest {
  type: 'isolate';
  /** 请求序号：主线程据此丢弃过期 Worker 的消息 */
  id: number;
  /** 降幂排列的整数系数（十进制字符串） */
  coeffsDesc: string[];
  /** 开区间整数端点（十进制字符串） */
  a: string;
  b: string;
}

export interface IntervalDTO {
  /** 精确有理端点文本，如 "-3/2" */
  left: string;
  right: string;
  /** 小数近似（精确截断，仅供肉眼参考） */
  leftApprox: string;
  rightApprox: string;
  /** 两端点处 Sturm 链符号序列（1/-1/0）与变号数 */
  leftSigns: number[];
  rightSigns: number[];
  leftVariations: number;
  rightVariations: number;
}

export interface IsolateResult {
  type: 'result';
  id: number;
  degree: number;
  polynomialText: string;
  sturmChainText: string[];
  aText: string;
  bText: string;
  signsAtA: number[];
  signsAtB: number[];
  variationsAtA: number;
  variationsAtB: number;
  totalRoots: number;
  intervals: IntervalDTO[];
}

export interface IsolateError {
  type: 'error';
  id: number;
  code: AnalysisErrorCode | 'INTERNAL';
  message: string;
}

export type WorkerResponse = IsolateResult | IsolateError;
