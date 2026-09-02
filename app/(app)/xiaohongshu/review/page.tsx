import { PageHeader } from "@/components/shared/page-header";
import { XiaohongshuReviewStep } from "@/components/xiaohongshu/xiaohongshu-flow";

export default function XiaohongshuReviewPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="小红书图文"
        title="用户调整"
        description="第二步由用户校稿和编辑每一页的图像提示词，确认后再进入图像生成。"
      />
      <XiaohongshuReviewStep />
    </div>
  );
}
