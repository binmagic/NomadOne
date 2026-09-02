# NomadOne

NomadOne 是由灵矩绘境出品并维护的 AI 商品图文工作台，支持电商详情页生成、小红书图文规划与生成、批量创建、图像编辑和私有化部署。

## 核心能力

- 上传商品图并进行结构化商品分析。
- 自动规划电商头图与详情页模块。
- 每张电商图和小红书图都会先经过视觉 Prompt Agent 细化提示词。
- 默认优先支持 GPT 系列文本模型和 `gpt-image-2` 图像模型。
- 支持 OpenAI 兼容 Provider。
- API Key 仅保存在当前浏览器 localStorage，不写入服务器数据库。
- 支持 `LOCK_BASE_URL` 锁定后端统一 API 通道，适合私有化部署。
- 批量创建、小红书生成、整页语言转换使用后台任务，避免长请求 504。
- 支持把已生成详情页图片一键转换为其他语言。
- API 监控会折叠内部重试，只把最终结果作为主记录展示。

## 快速开始

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

启动后打开 Next.js 输出的本地地址。

## 环境变量

```env
DATABASE_URL="file:./dev.db"
APP_SECRET="replace-with-your-own-long-secret"
STORAGE_ROOT="./storage"
APP_RUNTIME="web"
NEXT_PUBLIC_APP_NAME="NomadOne"

# 可选：私有化部署时锁定统一 OpenAI 兼容网关。
LOCK_BASE_URL="https://your-private-openai-compatible-gateway/v1"

# 兼容旧命名。
# FORCED_API_BASE="https://your-private-openai-compatible-gateway/v1"
# FORCED_API_BASE_URL="https://your-private-openai-compatible-gateway/v1"
```

## 模型配置

普通部署下，用户在前端设置页填写自己的 API Key 和 baseURL。API Key 只保存在当前浏览器，请求时临时传给后端。

如果服务端设置了 `LOCK_BASE_URL`，后端会强制使用该地址，前端 baseURL 输入会隐藏或禁用，并提示“当前平台已锁定专属 API 服务通道”。

## 品牌

产品名：NomadOne

出品与维护：灵矩绘境