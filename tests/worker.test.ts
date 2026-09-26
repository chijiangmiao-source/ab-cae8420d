/**
 * Worker 消息协议端到端测试：用 self 垫片加载真实 Worker 模块，
 * 验证请求/响应（含错误码）在消息边界上的序列化行为。
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { IsolateRequest, WorkerResponse } from '../src/worker/protocol';

interface SelfShim {
  onmessage: ((ev: MessageEvent<IsolateRequest>) => void) | null;
  postMessage(message: WorkerResponse): void;
}

// Worker 模块只加载一次，全体用例共享同一个 self 垫片
const inbox: WorkerResponse[] = [];
const shim: SelfShim = {
  onmessage: null,
  postMessage: (m) => inbox.push(m),
};
(globalThis as Record<string, unknown>).self = shim;
await import('../src/worker/sturm.worker');

function run(req: IsolateRequest): WorkerResponse {
  const before = inbox.length;
  shim.onmessage?.({ data: req } as MessageEvent<IsolateRequest>);
  assert.equal(inbox.length, before + 1, 'Worker 应恰好回一条消息');
  return inbox[inbox.length - 1];
}

test('Worker：x^2 − 2 在 (−2, 2) 返回两个隔离区间及变号证据', () => {
  const msg = run({ type: 'isolate', id: 7, coeffsDesc: ['1', '0', '-2'], a: '-2', b: '2' });

  assert.equal(msg.type, 'result');
  if (msg.type !== 'result') return;
  assert.equal(msg.id, 7);
  assert.equal(msg.totalRoots, 2);
  assert.equal(msg.intervals.length, 2);
  assert.equal(msg.sturmChainText.length, 3);
  // 区间升序且互不相交（字符串分数转回数值比较）
  const num = (s: string) => {
    const [n, d] = s.split('/');
    return Number(n) / Number(d ?? '1');
  };
  assert.ok(num(msg.intervals[0].right) < num(msg.intervals[1].left));
  assert.ok(num(msg.intervals[1].left) < 1.4142136);
  assert.ok(num(msg.intervals[1].right) > 1.4142136);
  for (const iv of msg.intervals) {
    assert.equal(iv.leftVariations - iv.rightVariations, 1);
  }
});

test('Worker：端点为根返回 ENDPOINT_ROOT 错误且不产出结果', () => {
  const msg = run({ type: 'isolate', id: 8, coeffsDesc: ['1', '-1'], a: '1', b: '3' });

  assert.equal(msg.type, 'error');
  if (msg.type !== 'error') return;
  assert.equal(msg.id, 8);
  assert.equal(msg.code, 'ENDPOINT_ROOT');
});

test('Worker：首项为零返回 LEADING_ZERO 错误', () => {
  const msg = run({ type: 'isolate', id: 9, coeffsDesc: ['0', '1', '-1'], a: '0', b: '3' });

  assert.equal(msg.type, 'error');
  if (msg.type !== 'error') return;
  assert.equal(msg.code, 'LEADING_ZERO');
});
