/** HTTP 冒烟：等待健康检查就绪，验证首页与 SPA 回退，失败以非 0 退出 */
const base = (process.env.APP_URL || 'http://app:8080').replace(/\/$/, '');
const deadline = Date.now() + Number(process.env.SMOKE_TIMEOUT_MS || 90_000);

const get = async (path) => {
  const res = await fetch(base + path);
  return { status: res.status, text: await res.text() };
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let healthy = false;
while (Date.now() < deadline) {
  try {
    const r = await get('/healthz');
    if (r.status === 200 && r.text.includes('"ok"')) {
      healthy = true;
      break;
    }
  } catch {
    // 服务尚未就绪，继续等待
  }
  await sleep(1000);
}
if (!healthy) {
  console.error(`SMOKE FAIL: ${base}/healthz 在超时前未就绪`);
  process.exit(1);
}
console.log(`GET ${base}/healthz -> 200 ok`);

const index = await get('/');
if (index.status !== 200 || !index.text.includes('<div id="root">')) {
  console.error('SMOKE FAIL: / 未返回应用首页');
  process.exit(1);
}
console.log(`GET ${base}/ -> 200 (index.html)`);

const fallback = await get('/some/deep/route');
if (fallback.status !== 200 || !fallback.text.includes('<div id="root">')) {
  console.error('SMOKE FAIL: SPA 回退未返回 index.html');
  process.exit(1);
}
console.log(`GET ${base}/some/deep/route -> 200 (SPA fallback)`);

console.log('SMOKE PASSED');
