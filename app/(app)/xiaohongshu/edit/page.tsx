import { PageHeader } from "@/components/shared/page-header";
import { XiaohongshuEditStep } from "@/components/xiaohongshu/xiaohongshu-flow";

export default function XiaohongshuEditPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="小红书图文"
        title="修改"
        description="第四步对不满意的单页进行图像编辑，保留已有画面基础，只按用户意见精修。"
      />
      <XiaohongshuEditStep />
    </div>
  );
}
