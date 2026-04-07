# ============================================================
# ClawFlow — Multi-stage Docker Build
# ============================================================

# ---- Stage 1: 建置階段 ----
FROM node:22-alpine AS builder

# better-sqlite3 需要原生編譯工具
RUN apk add --no-cache python3 make g++ build-base

WORKDIR /app

# 先複製 lock 檔，利用 Docker 快取層
COPY package.json package-lock.yaml* pnpm-lock.yaml* ./

# 安裝所有依賴（含 devDependencies，建置需要）
RUN npm ci

# 複製原始碼與設定檔
COPY tsconfig.json tsup.config.ts vite.config.ts index.html ./
COPY src/ src/

# 執行完整建置（tsc + tsup + vite build）
RUN npm run build

# ---- Stage 2: 執行階段 ----
FROM node:22-alpine AS runner

# better-sqlite3 執行時需要的原生函式庫
RUN apk add --no-cache wget

WORKDIR /app

# 複製 package.json 並只安裝 production 依賴
COPY package.json package-lock.yaml* pnpm-lock.yaml* ./
RUN apk add --no-cache python3 make g++ build-base \
    && npm ci --omit=dev \
    && apk del python3 make g++ build-base

# 從建置階段複製產出
COPY --from=builder /app/dist ./dist

# 使用非 root 使用者（node 是 alpine node image 內建的）
RUN mkdir -p /home/node/.clawflow && chown -R node:node /home/node/.clawflow
USER node

# 暴露服務埠
EXPOSE 3700

# 健康檢查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3700/api/v1/health || exit 1

# 啟動服務
CMD ["node", "dist/index.js"]
