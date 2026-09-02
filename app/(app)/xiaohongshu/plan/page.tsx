import { PageHeader } from "@/components/shared/page-header";
import { XiaohongshuPlanStep } from "@/components/xiaohongshu/xiaohongshu-flow";

export default function XiaohongshuPlanPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="小红书图文"
        title="规划"
        description="第一步只做文本规划：输入选题，由文本模型拆解标题、人群洞察、分页脚本和初始图像提示词。"
      />
      <XiaohongshuPlanStep />
    </div>
  );
}
