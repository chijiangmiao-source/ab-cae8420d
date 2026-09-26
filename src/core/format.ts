/** 多项式与符号序列的展示格式化（仅用于呈现，不参与计算） */
import { Poly } from './polynomial';
import { Sign, ratToString } from './rational';

/** 例如 "x^3 − 4·x^2 + 5·x − 2"（使用真正的减号 −） */
export function polyToString(p: Poly): string {
  if (p.length === 0) return '0';
  let out = '';
  for (let i = p.length - 1; i >= 0; i--) {
    const c = p[i];
    if (c.n === 0n) continue;
    const neg = c.n < 0n;
    const absStr = ratToString({ n: neg ? -c.n : c.n, d: c.d });
    const isOne = absStr === '1';
    let term: string;
    if (i === 0) term = absStr;
    else if (i === 1) term = isOne ? 'x' : `${absStr}·x`;
    else term = isOne ? `x^${i}` : `${absStr}·x^${i}`;
    if (out === '') out = (neg ? '−' : '') + term;
    else out += neg ? ` − ${term}` : ` + ${term}`;
  }
  return out === '' ? '0' : out;
}

export function signToChar(s: Sign): string {
  return s > 0 ? '+' : s < 0 ? '−' : '0';
}

/** 例如 "[+ − 0 +]" */
export function signsToString(signs: Sign[]): string {
  return `[${signs.map(signToChar).join(' ')}]`;
}
