import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_DEGREE, MIN_DEGREE } from './core/analyze';
import { signToChar } from './core/format';
import type { IsolateResult, WorkerResponse } from './worker/protocol';

type Status = 'idle' | 'computing';

interface Banner {
  kind: 'error' | 'info';
  title: string;
  detail?: string;
}

const INTEGER_RE = /^[+-]?\d+$/;

function makeCoeffSlots(degree: number, prev: string[]): string[] {
  const next = new Array<string>(degree + 1).fill('');
  for (let i = 0; i < next.length && i < prev.length; i++) next[i] = prev[i];
  return next;
}

export default function App() {
  const [degree, setDegree] = useState(2);
  const [coeffs, setCoeffs] = useState<string[]>(() => makeCoeffSlots(2, ['1', '0', '-2']));
  const [endpointA, setEndpointA] = useState('-2');
  const [endpointB, setEndpointB] = useState('2');
  const [status, setStatus] = useState<Status>('idle');
  const [banner, setBanner] = useState<Banner | null>(null);
  const [result, setResult] = useState<IsolateResult | null>(null);

  const workerRef = useRef<Worker | null>(null);
  /** 单调递增的请求序号：任何编辑/提交/取消都会使它失效旧 Worker */
  const requestIdRef = useRef(0);

  /** 使当前一切进行中的计算与已展示结论过期 */
  const invalidate = useCallback(() => {
    requestIdRef.current += 1;
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setStatus('idle');
    setBanner(null);
    setResult(null);
  }, []);

  useEffect(
    () => () => {
      requestIdRef.current += 1;
      workerRef.current?.terminate();
    },
    [],
  );

  const handleDegreeChange = (next: number) => {
    invalidate();
    setDegree(next);
    setCoeffs((prev) => makeCoeffSlots(next, prev));
  };

  const handleCoeffChange = (index: number, value: string) => {
    invalidate();
    setCoeffs((prev) => prev.map((c, i) => (i === index ? value : c)));
  };

  const handleEndpointChange = (which: 'a' | 'b', value: string) => {
    invalidate();
    if (which === 'a') setEndpointA(value);
    else setEndpointB(value);
  };

  const fail = useCallback((title: string, detail?: string) => {
    setBanner({ kind: 'error', title, detail });
  }, []);

  const handleSubmit = () => {
    // 重新提交：先作废旧 Worker 与旧结论
    invalidate();

    if (degree < MIN_DEGREE || degree > MAX_DEGREE) {
      fail('次数范围错误', `次数须为 ${MIN_DEGREE} 至 ${MAX_DEGREE} 的整数`);
      return;
    }
    const trimmed = coeffs.map((c) => c.trim());
    for (let i = 0; i < trimmed.length; i++) {
      if (!INTEGER_RE.test(trimmed[i])) {
        fail(
          '系数格式错误',
          `系数 a${degree - i}（x^${degree - i} 项）须为整数，当前为 “${coeffs[i]}”`,
        );
        return;
      }
    }
    if (BigInt(trimmed[0]) === 0n) {
      fail('首项为零', `次数 ${degree} 的首项系数 a${degree} 不能为零，请降低次数或改为非零值`);
      return;
    }
    const aText = endpointA.trim();
    const bText = endpointB.trim();
    if (!INTEGER_RE.test(aText) || !INTEGER_RE.test(bText)) {
      fail('系数格式错误', '区间端点 a、b 均须为整数');
      return;
    }
    if (BigInt(aText) >= BigInt(bText)) {
      fail('区间端点错误', `须满足 a < b（当前 a=${aText}, b=${bText}）`);
      return;
    }

    const id = ++requestIdRef.current;
    const worker = new Worker(new URL('./worker/sturm.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const msg = ev.data;
      // 过期守卫：只接受与当前请求序号一致的消息
      if (!msg || msg.id !== id || id !== requestIdRef.current) return;
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
      setStatus('idle');
      if (msg.type === 'error') {
        setResult(null);
        setBanner({ kind: 'error', title: errorTitle(msg.code), detail: msg.message });
      } else {
        setBanner(null);
        setResult(msg);
      }
    };
    worker.onerror = () => {
      if (id !== requestIdRef.current) return;
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
      setStatus('idle');
      setResult(null);
      setBanner({ kind: 'error', title: 'Worker 运行失败', detail: '计算过程发生未知错误' });
    };

    setStatus('computing');
    worker.postMessage({
      type: 'isolate',
      id,
      coeffsDesc: trimmed,
      a: aText,
      b: bText,
    });
  };

  const handleCancel = () => {
    invalidate();
    setBanner({ kind: 'info', title: '计算已取消', detail: '已丢弃全部中间结果，未保留任何旧结论' });
  };

  return (
    <div className="page">
      <header>
        <h1>精确实根隔离</h1>
        <p className="subtitle">
          基于 Sturm 定理的增益曲线零点定位：BigInt 有理数构造 Sturm 链，精确符号判定 + 二分隔离，
          结果不受浮点误差影响。
        </p>
      </header>

      <section className="card">
        <h2>输入</h2>
        <div className="field-row">
          <label htmlFor="degree">多项式次数（{MIN_DEGREE}–{MAX_DEGREE}）</label>
          <select
            id="degree"
            value={degree}
            onChange={(e) => handleDegreeChange(Number(e.target.value))}
          >
            {Array.from({ length: MAX_DEGREE - MIN_DEGREE + 1 }, (_, i) => MIN_DEGREE + i).map(
              (d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ),
            )}
          </select>
        </div>

        <div className="field-row coeff-row">
          <label>整数系数（降幂）</label>
          <div className="coeff-grid">
            {coeffs.map((value, i) => {
              const power = degree - i;
              return (
                <div className="coeff-cell" key={power}>
                  <input
                    aria-label={`系数 a${power}`}
                    value={value}
                    placeholder="0"
                    inputMode="numeric"
                    onChange={(e) => handleCoeffChange(i, e.target.value)}
                  />
                  <span className="coeff-label">
                    a<sub>{power}</sub>
                    {power > 0 ? ` · x^${power}` : '（常数项）'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="field-row">
          <label>开区间端点（整数，a &lt; b，端点不得为根）</label>
          <div className="endpoint-inputs">
            <span>(</span>
            <input
              aria-label="左端点 a"
              value={endpointA}
              placeholder="a"
              inputMode="numeric"
              onChange={(e) => handleEndpointChange('a', e.target.value)}
            />
            <span>,</span>
            <input
              aria-label="右端点 b"
              value={endpointB}
              placeholder="b"
              inputMode="numeric"
              onChange={(e) => handleEndpointChange('b', e.target.value)}
            />
            <span>)</span>
          </div>
        </div>

        <div className="actions">
          <button type="button" className="primary" onClick={handleSubmit}>
            {status === 'computing' ? '重新提交并计算' : '提交并隔离实根'}
          </button>
          <button type="button" onClick={handleCancel} disabled={status !== 'computing'}>
            取消计算
          </button>
          {status === 'computing' && <span className="computing">Worker 计算中…</span>}
        </div>
      </section>

      {banner && (
        <section className={`banner ${banner.kind}`} role="alert">
          <strong>{banner.title}</strong>
          {banner.detail && <span>{banner.detail}</span>}
        </section>
      )}

      {result && <ResultView result={result} />}
    </div>
  );
}

function errorTitle(code: string): string {
  switch (code) {
    case 'ENDPOINT_ROOT':
      return '端点为根';
    case 'LEADING_ZERO':
      return '首项为零';
    case 'DEGREE_RANGE':
      return '次数范围错误';
    case 'ENDPOINT_ORDER':
      return '区间端点错误';
    default:
      return '计算失败';
  }
}

function SignSeq({ signs }: { signs: number[] }) {
  return (
    <code className="sign-seq">[ {signs.map((s) => signToChar(s as -1 | 0 | 1)).join('  ')} ]</code>
  );
}

function ResultView({ result }: { result: IsolateResult }) {
  return (
    <section className="card">
      <h2>结果（与当前输入一一对应）</h2>

      <div className="summary">
        <p>
          多项式 <code>p(x) = {result.polynomialText}</code>
        </p>
        <p>
          开区间 <code>({result.aText}, {result.bText})</code> 内不同实根数：
          <strong className="root-count">{result.totalRoots}</strong>
        </p>
        <p className="evidence">
          整体证据：V({result.aText}) = {result.variationsAtA} <SignSeq signs={result.signsAtA} />
          ，V({result.bText}) = {result.variationsAtB} <SignSeq signs={result.signsAtB} />
          ，差值 {result.variationsAtA} − {result.variationsAtB} = {result.totalRoots}
        </p>
      </div>

      <h3>Sturm 链</h3>
      <ol className="chain" start={0}>
        {result.sturmChainText.map((text, i) => (
          <li key={i} value={i}>
            <code>
              p<sub>{i}</sub>(x) = {text}
            </code>
          </li>
        ))}
      </ol>

      <h3>隔离区间（升序、互不相交，每段恰含一个根）</h3>
      {result.intervals.length === 0 ? (
        <p>开区间内无实根，无需隔离。</p>
      ) : (
        <table className="intervals">
          <thead>
            <tr>
              <th>#</th>
              <th>有理隔离区间（开区间）</th>
              <th>小数近似</th>
              <th>左端 Sturm 证据</th>
              <th>右端 Sturm 证据</th>
              <th>变号差</th>
            </tr>
          </thead>
          <tbody>
            {result.intervals.map((iv, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>
                  <code>
                    ({iv.left}, {iv.right})
                  </code>
                </td>
                <td>
                  <code>
                    (≈{iv.leftApprox}, ≈{iv.rightApprox})
                  </code>
                </td>
                <td>
                  <SignSeq signs={iv.leftSigns} /> V = {iv.leftVariations}
                </td>
                <td>
                  <SignSeq signs={iv.rightSigns} /> V = {iv.rightVariations}
                </td>
                <td>
                  {iv.leftVariations} − {iv.rightVariations} ={' '}
                  <strong>{iv.leftVariations - iv.rightVariations}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
