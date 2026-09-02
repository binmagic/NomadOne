# NomadOne

NomadOne is an AI-native workspace for e-commerce product detail pages, Xiaohongshu image posts, batch product creation, image editing, and private OpenAI-compatible deployments.

NomadOne is published and maintained by Lingju Huijing.

## Features

- Product image upload and structured product analysis.
- E-commerce hero and detail-section planning.
- Visual Prompt Agent refinement before every e-commerce and Xiaohongshu image generation.
- GPT-series text model defaults and `gpt-image-2` image model defaults.
- OpenAI-compatible Provider support.
- Browser-local API Key storage; keys are not written to the server database.
- Optional `LOCK_BASE_URL` server-side enforcement for private deployments.
- Background tasks for batch creation, Xiaohongshu generation, and full-page language conversion.
- Generated detail-page image translation through image editing.
- API monitor with folded retry details and final endpoint display.

## Quick Start

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Open the local URL printed by Next.js.

## Environment

```env
DATABASE_URL="file:./dev.db"
APP_SECRET="replace-with-your-own-long-secret"
STORAGE_ROOT="./storage"
APP_RUNTIME="web"
NEXT_PUBLIC_APP_NAME="NomadOne"

# Optional: force every server-side Provider request through one gateway.
LOCK_BASE_URL="https://your-private-openai-compatible-gateway/v1"

# Legacy aliases are also supported.
# FORCED_API_BASE="https://your-private-openai-compatible-gateway/v1"
# FORCED_API_BASE_URL="https://your-private-openai-compatible-gateway/v1"
```

## Brand

Product: NomadOne

Publisher and maintainer: Lingju Huijing