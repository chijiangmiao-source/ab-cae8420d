# syntax=docker/dockerfile:1

# ---- 依赖层：完整安装（含 devDependencies，供测试与构建） ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- 构建层：类型检查 + 产出静态文件 ----
FROM deps AS build
COPY . .
RUN npm run build

# ---- verify 层：代码测试 + 构建检查 + HTTP 冒烟，以退出码报告 ----
FROM build AS verify
CMD ["sh", "verify/verify.sh"]

# ---- 运行层：零依赖静态服务器 ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080
COPY --from=build /app/dist ./dist
COPY server/server.mjs ./server/server.mjs
USER node
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=5 \
  CMD node -e "const p=process.env.PORT||8080;fetch('http://127.0.0.1:'+p+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/server.mjs"]
