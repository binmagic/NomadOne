"use client";

import { useEffect } from "react";

const printedFlag = "__nomadOneBrandConsolePrinted";

export function BrandConsole() {
  useEffect(() => {
    const scopedWindow = window as unknown as Window & Record<string, unknown>;
    if (scopedWindow[printedFlag]) return;
    scopedWindow[printedFlag] = true;

    console.log(
      "%cNomadOne",
      "font-size:22px;font-weight:800;color:#111827;line-height:1.8;",
    );
    console.log(
      "%c灵矩绘境出品。把商品图变成详情页、小红书图文和可编辑商业视觉。",
      "font-size:13px;color:#334155;line-height:1.8;",
    );
    console.log(
      "%c支持 OpenAI 兼容协议、GPT 系列模型、gpt-image-2、生图编辑、批量创建和本地化部署。",
      "font-size:12px;color:#64748b;line-height:1.8;",
    );
    console.log(
      "%c项目地址：https://github.com/binmagic/NomadOne",
      "font-size:12px;color:#e11d48;line-height:1.8;",
    );
  }, []);

  return null;
}