# AI Image Studio

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
  <img alt="Cloudflare" src="https://img.shields.io/badge/Cloudflare%20Workers-Backend-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" />
  <img alt="Apache-2.0" src="https://img.shields.io/badge/License-Apache%202.0-D22128?style=for-the-badge" />
</p>

**AI Image Studio** 是一个自托管的 AI 图像生成工具，采用前端 SPA + Cloudflare Workers 后端架构，支持接入速创AI、WaveSpeed 等多服务商生图能力：输入一句话，生成一张图。

本项目是上游开源项目 [monkeyWie/typix](https://github.com/monkeyWie/typix) 的 fork/rewrite，深度改造了后端 provider 层，接入速创AI 与 WaveSpeed 生图能力，并适配 Cloudflare Pages + Workers 自托管部署。

**Live**：[ai-image-studio-frontend.pages.dev/chat](https://ai-image-studio-frontend.pages.dev/chat)

## ✨ 特性

- 🖼️ **AI 生图**：基于速创AI、WaveSpeed，输入描述即出图，日常自用
- ☁️ **Cloudflare 自托管**：前端 Pages + 后端 Workers（D1 + R2），完全掌控数据
- 🤖 **可插拔 provider**：后端 provider 接口统一，可继续接入更多生图服务
- 🔄 **云同步**：登录后多设备同步创作记录
- 🌐 **国际化**：中文 / 英文

## 架构

```
[浏览器前端 React SPA]  ──HTTP──>  [Cloudflare Workers 后端]
                                        │
                                  ┌─────┴──────┐
                                  │ D1 数据库   │ 创作记录 / 用户
                                  │ R2 存储     │ 生成的图片
                                  │ 速创AI      │ 生图推理
                                  │ WaveSpeed   │ 生图推理
                                  └─────────────┘
```

## 界面预览

**创作对话** — 输入一句描述，按 Enter 即生成图片；支持速创AI、WaveSpeed 等提供商切换与创作历史管理。

<p align="center">
  <img src="docs/screenshots/chat.png" alt="创作对话" width="760"/>
</p>

**AI 提供商设置** — 可插拔的 provider 配置页，管理速创AI、WaveSpeed 等服务接入。

<p align="center">
  <img src="docs/screenshots/provider.png" alt="AI提供商设置" width="760"/>
</p>

## 二次开发说明

- **接入 provider**：后端新增 `suchuang` 等 provider，实现统一生图接口（见 `worker/src/providers/`）
- **前端适配**：新增 provider 配置（`src/app/ai/provider/index.ts`）
- **部署改造**：后端重构为 Cloudflare Workers（`worker/`），支持 D1 + R2 + Pages 全栈部署
- **快捷部署脚本**：`pnpm deploy:worker` / `pnpm deploy:frontend`

## 🚀 部署（Cloudflare）

### 前置要求

- Cloudflare 账号（已启用 R2 存储）
- Node.js 20+ / pnpm

### 步骤

```bash
# 1. 克隆并安装
git clone https://github.com/zack744/ai-image-studio.git
cd ai-image-studio
pnpm install

# 2. 登录 Wrangler
npx wrangler login

# 3. 创建 D1 数据库和 R2 存储桶
# 资源名称已在 worker/wrangler.toml 中配置（D1 的 database_name、R2 的 bucket_name）

# 4. 将 D1 database_id 填入 worker/wrangler.toml（顶层和 [env.production] 两处）

# 5. 设置后端密钥
npx wrangler secret put JWT_SECRET --config worker/wrangler.toml --env production
npx wrangler secret put INVITE_CODE --config worker/wrangler.toml --env production

# 6. 数据库迁移
pnpm db:migrate

# 7. 部署后端
pnpm deploy:worker

# 8. 配置前端生产环境变量并部署
cp .env.production.example .env.production   # 将 VITE_WORKER_URL 改成你的 Worker 地址
pnpm deploy:frontend
```

### 安全与防盗刷

- **邀请码注册**：设置 `INVITE_CODE` 环境变量后，注册必须填写正确的邀请码，未配置则放开注册。
- **用户自带 API Key**：AI 提供商 API Key 由用户在前端「设置 → AI 提供商」中填写，保存在浏览器本地，随生成请求透传给后端。服务端不保存任何 provider 密钥，避免被人盗刷额度。

## 开发

```bash
pnpm dev          # 本地前端开发
pnpm lint         # biome lint
```

## License

Apache 2.0，见 [LICENSE](LICENSE)。
