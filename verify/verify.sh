#!/bin/sh
# verify 服务入口：代码测试 + 构建检查 + HTTP 冒烟，全部通过则以 0 退出，否则非 0。
set -eu

echo "=== [1/3] 单元测试（两个实根 / 无实根 / 端点根拒绝 等） ==="
npm test

echo "=== [2/3] 构建检查（tsc 类型检查 + vite build） ==="
npm run build

echo "=== [3/3] HTTP 冒烟（目标：${APP_URL:-http://app:8080}） ==="
node verify/smoke.mjs

echo "VERIFY PASSED"
