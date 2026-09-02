import { BatchCreateWorkspace } from "@/components/projects/batch-create-workspace";
import { PageHeader } from "@/components/shared/page-header";

export default function BatchCreatePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="批量创建"
        title="批量创建详情页"
        description="一次上传多个产品图，系统会为每张图创建独立项目，并自动完成商品分析与详情页规划。"
      />
      <BatchCreateWorkspace />
    </div>
  );
}
