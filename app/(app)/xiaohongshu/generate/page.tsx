import { PageHeader } from "@/components/shared/page-header";
import { XiaohongshuGenerateStep } from "@/components/xiaohongshu/xiaohongshu-flow";

export default function XiaohongshuGeneratePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="小红书图文"
        title="生成"
        description="第三步只调用图像生成模型，按确认后的提示词生成整组 3:4 小红书图文。"
      />
      <XiaohongshuGenerateStep />
    </div>
  );
}
