# 精确实根隔离（Sturm 定理）

面向同步辐射站增益曲线校准的零点定位工具：输入次数 1–12 的整数系数多项式与两个整数区间端点，
页面在**开区间**内给出

- 不同实根数 `N = V(a) − V(b)`；
- 按数值升序排列、互不相交的有理隔离开区间；
- 每段区间两端 Sturm 链符号序列与变号数证据（`V(l) − V(r) = 1`，恰含一个根）。

全部计算在浏览器 Web Worker 中以 **BigInt 有理数**完成：构造 Sturm 链、精确符号判定、
二分隔离（二分中点恰为有理根时自动收缩窗口），不使用任何浮点近似。

## 输入校验与反馈

| 情况 | 反馈 |
| --- | --- |
| 系数非整数 / 端点非整数 | 「系数格式错误」 |
| 首项系数为零（或恒为零） | 「首项为零」 |
| 次数不在 1–12 | 「次数范围错误」 |
| 端点不满足 a < b | 「区间端点错误」 |
| 端点恰为根 | 「端点为根」（Worker 精确判定后拒绝） |
| 计算中取消 | 「计算已取消」 |

任何错误、取消或编辑都会清空旧结论；每次提交分配单调递增的请求序号并 `terminate()` 旧
Worker，过期消息到达时被丢弃，页面只呈现与当前输入对应的结果。

## 本地开发

```sh
npm ci
npm run dev      # 开发服务器
npm test         # 单元测试（node:test + tsx）
npm run build    # tsc 类型检查 + vite 构建
npm start        # 以 dist/ 启动静态服务器（PORT 环境变量，默认 8080）
```

## Docker / Compose 运行

```sh
# 启动页面（默认 8080 端口，可用 APP_PORT 覆盖）
APP_PORT=9090 docker compose up app

# 运行 verify 服务：单元测试（两个实根 / 无实根 / 端点根拒绝 等）
# + 构建检查 + 对 app 服务的 HTTP 冒烟，随后以退出码报告结果
docker compose up --exit-code-from verify verify
```

- 健康检查：`GET /healthz`（Dockerfile `HEALTHCHECK`，Compose `depends_on: service_healthy` 使用）。
- 端口配置：`APP_PORT` 同时控制宿主机映射端口与容器内 `PORT`。
- 静态服务器：`server/server.mjs`（零依赖 `node:http`，含 SPA 回退与路径穿越防护）。

## 目录结构

```
src/core/       BigInt 有理数、有理系数多项式、Sturm 链与隔离算法（纯 TS，无 DOM 依赖）
src/worker/     Web Worker 与消息协议
src/App.tsx     页面：输入、校验、过期守卫、结果与变号证据展示
server/         零依赖静态服务器（/healthz，PORT 可配）
tests/          node:test 单元测试（核心数学 + Worker 协议）
verify/         verify 服务脚本：测试 + 构建 + HTTP 冒烟
```
