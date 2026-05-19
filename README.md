# Typix - 输入即图像

<p align="center">
  <a href="https://github.com/monkeyWie/typix/releases"><img src="https://img.shields.io/github/release/monkeyWie/typix.svg" alt="Version"></a>
  <a href="https://www.apache.org/licenses/LICENSE-2.0"><img src="https://img.shields.io/badge/license-Apache%202.0-green.svg" alt="License"></a>
</p>

<p align="center">简体中文 | <a href="README_en-US.md">English</a></p>

Typix 是一款现代化、开源、易用的 AI 图像生成工具，为创作者提供一站式的 AI 生图体验。采用前端 SPA + Cloudflare Workers 架构，支持自托管部署。

![](docs/public/images/demo/preview.png)

## 🎯 快速使用

无需注册登录，即刻体验 AI 生图服务。

- [https://typix.art](https://typix.art)
  生产级稳定版本，支持云同步
- [https://preview.typix.art](https://preview.typix.art)
  抢先体验最新功能和改进

## ✨ 核心特性

专注 AI 图像生成，让创意瞬间成为视觉艺术

- 🏠 **自托管部署** - 完全掌控您的数据和隐私
- 🎁 **免费开源** - Apache 2.0 协议，可自由使用和修改
- ☁️ **Cloudflare 部署** - 一键部署到 Cloudflare Workers
- 🤖 **多模型支持** - 通过提供商配置接入多种 AI 模型
- 🔄 **云同步** - 登录账户后可在多设备间同步内容
- 🌐 **国际化** - 支持中文和英文

## 🚀 部署

### Cloudflare Workers 部署（推荐）

#### 前置要求

- [Cloudflare 账号](https://dash.cloudflare.com)
- Node.js 20+
- pnpm

#### 部署步骤

1. **在 Cloudflare 控制台创建资源**

   - 创建 **D1** 数据库，名称为 `typix-db`
   - 创建 **R2** 存储桶，名称为 `typix-images`
   - 将 D1 database_id 填入 `worker/wrangler.toml`

2. **克隆并安装依赖**

```bash
git clone https://github.com/monkeyWie/typix.git
cd typix
pnpm install
```

3. **配置环境变量**

```bash
cp worker/.dev.vars.example worker/.dev.vars
# 编辑 worker/.dev.vars，填入 JWT_SECRET 和 SUCHUANG_API_KEY
```

4. **执行数据库迁移**

```bash
cd worker
pnpm db:migrate
```

5. **部署 Worker**

```bash
cd worker
pnpm deploy
```

6. **部署前端静态资源**

将 `dist/` 目录部署到 Cloudflare Pages 或任意静态托管服务，并设置环境变量 `VITE_WORKER_URL` 指向 Worker 地址。

### 静态文件托管（仅前端，使用远程 API）

如果你只需要部署前端并通过远程 Worker API 使用，可以构建后部署到任意静态托管：

```bash
pnpm install
pnpm build
# 将 dist/ 部署到 Cloudflare Pages / Vercel / Netlify 等
```

构建时通过环境变量指定 Worker 地址：

```bash
VITE_WORKER_URL=https://your-worker.workers.dev pnpm build
```

## 🛠️ 开发文档

### 技术栈

**前端：**

- **React 19** - 现代化 UI 框架
- **TypeScript** - 类型安全的 JavaScript
- **Tailwind CSS v4** - 原子化 CSS 框架
- **shadcn/ui** - 高质量 UI 组件库
- **TanStack Router** - 类型安全的路由管理
- **Zustand** - 轻量级状态管理
- **SWR** - 数据获取和缓存
- **react-i18next** - 国际化

**后端（Cloudflare Worker）：**

- **Hono** - 轻量级 Web 框架
- **Cloudflare D1** - Serverless SQLite 数据库
- **Cloudflare R2** - 对象存储
- **Drizzle ORM** - 类型安全的 ORM
- **Jose** - JWT 认证

**开发工具：**

- **Vite** - 快速构建工具
- **Biome** - 代码格式化和检查
- **pnpm** - 包管理器（workspace 模式）
- **Wrangler** - Cloudflare Workers CLI

### 本地开发指引

#### 环境准备

1. **安装 Node.js 20+**
2. **安装 pnpm**

```bash
npm install -g pnpm
```

#### 开发流程

1. **克隆项目**

```bash
git clone https://github.com/monkeyWie/typix.git
cd typix
```

2. **安装依赖**

```bash
pnpm install
```

3. **配置 Worker 环境变量**

```bash
cp worker/.dev.vars.example worker/.dev.vars
# 编辑 worker/.dev.vars，填入真实的 SUCHUANG_API_KEY
```

4. **初始化本地数据库**

```bash
cd worker
pnpm db:migrate:local
cd ..
```

5. **启动开发服务器**（需要两个终端）

```bash
# 终端 1：启动 Worker 后端（默认 http://localhost:8787）
cd worker && pnpm dev

# 终端 2：启动前端开发服务器（默认 http://localhost:5173）
pnpm dev
```

前端会自动通过 `VITE_WORKER_URL`（默认 `http://localhost:8787`）连接本地 Worker。

#### 项目结构

```
├── src/app/                # 前端 SPA 应用
│   ├── ai/                 # AI 提供商类型定义
│   ├── components/         # React 组件
│   │   ├── icon/           # 图标组件
│   │   ├── login/          # 登录组件
│   │   ├── navigation/     # 导航组件
│   │   └── ui/             # shadcn/ui 组件
│   ├── hooks/              # 自定义 Hooks
│   ├── i18n/               # 国际化配置和语言文件
│   ├── lib/                # 工具库和 API 客户端
│   ├── routes/             # 路由页面
│   │   ├── chat/           # 聊天页面
│   │   └── settings/       # 设置页面
│   └── stores/             # Zustand 状态管理
├── worker/                 # Cloudflare Worker 后端
│   ├── src/
│   │   ├── index.ts        # Hono 应用入口
│   │   ├── auth/           # JWT 认证
│   │   ├── db/             # 数据库 schema 和实例
│   │   ├── providers/      # 图片生成提供商
│   │   └── routes/         # API 路由
│   ├── drizzle/            # 数据库迁移文件
│   └── wrangler.toml       # Worker 配置
├── docs/                   # 文档站点
└── public/                 # 静态资源
```

## 📄 开源协议

本项目采用 [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) 开源协议。

您可以自由地：

- ✅ 商业使用
- ✅ 修改代码
- ✅ 分发项目
- ✅ 私人使用

但需要：

- 📝 保留版权声明
- 📝 包含许可证文件
- 📝 声明重大更改

---

如果这个项目对您有帮助，请考虑给我们一个 ⭐ Star！
