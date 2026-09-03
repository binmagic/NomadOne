/**
 * [INPUT]: 无运行时依赖，只导出领域常量和公开类型
 * [OUTPUT]: 对外提供平台/风格/能力/角色标签，以及 Studio 对话生图、商品套图的视图类型
 * [POS]: types/ 的唯一公开契约，被页面、校验和服务同时消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export const platformOptions = [
  "general_ecommerce",
  "taobao_tmall",
  "pinduoduo",
  "xiaohongshu",
  "douyin_ecommerce",
] as const;

export const styleOptions = [
  "generic_clean",
  "premium",
  "soft_lifestyle",
  "conversion_focused",
  "tech",
] as const;

export const platformLabels: Record<(typeof platformOptions)[number], string> = {
  general_ecommerce: "通用电商",
  taobao_tmall: "淘宝 / 天猫",
  pinduoduo: "拼多多",
  xiaohongshu: "小红书",
  douyin_ecommerce: "抖音电商",
};

export const styleLabels: Record<(typeof styleOptions)[number], string> = {
  generic_clean: "通用简洁",
  premium: "高级质感",
  soft_lifestyle: "柔和生活方式",
  conversion_focused: "转化导向",
  tech: "科技感",
};

export const assetTypeLabels = {
  MAIN: "主商品图",
  ANGLE: "多角度图",
  DETAIL: "细节图",
  REFERENCE: "参考图",
  GENERATED: "生成图",
  EXPORTED: "导出文件",
} as const;

export const sectionTypes = [
  "hero",
  "selling_points",
  "scenario",
  "detail_closeup",
  "specs",
  "material",
  "comparison",
  "gift_scene",
  "brand_trust",
  "summary",
  "custom",
] as const;

export const sectionTypeLabels: Record<(typeof sectionTypes)[number], string> = {
  hero: "头图主视觉",
  selling_points: "卖点模块",
  scenario: "场景展示",
  detail_closeup: "细节特写",
  specs: "规格参数",
  material: "材质工艺",
  comparison: "对比说明",
  gift_scene: "送礼场景",
  brand_trust: "品牌信任",
  summary: "总结收口",
  custom: "自定义模块",
};

export const capabilityKeys = [
  "text",
  "vision",
  "image_gen",
  "image_edit",
  "structured_output",
  "fast",
  "cheap",
  "high_quality",
] as const;

export const capabilityLabels: Record<(typeof capabilityKeys)[number], string> = {
  text: "文本",
  vision: "视觉理解",
  image_gen: "图像生成",
  image_edit: "图像编辑",
  structured_output: "结构化输出",
  fast: "速度快",
  cheap: "成本低",
  high_quality: "高质量",
};

export const roleKeys = [
  "analysis",
  "planning",
  "hero_image",
  "detail_image",
  "image_edit",
] as const;

export const roleLabels: Record<(typeof roleKeys)[number], string> = {
  analysis: "商品分析",
  planning: "文案规划",
  hero_image: "头图生成",
  detail_image: "详情图生成",
  image_edit: "图像编辑",
};

export const statusLabels: Record<string, string> = {
  IDLE: "未开始",
  QUEUED: "排队中",
  GENERATING: "生成中",
  SUCCESS: "已完成",
  FAILED: "失败",
  DRAFT: "草稿",
  ANALYZED: "已分析",
  PLANNED: "已规划",
  EDITING: "编辑中",
  COMPLETED: "已完成",
};

export const userRoles = ["OWNER", "MEMBER"] as const;

export type UserRole = (typeof userRoles)[number];

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
}

export const studioAspectRatios = ["1:1", "3:4", "9:16"] as const;

export type StudioAspectRatio = (typeof studioAspectRatios)[number];

export type StudioMessageRole = "USER" | "ASSISTANT";

export type StudioMessageStatus = "PENDING" | "SUCCESS" | "FAILED";

export interface StudioMessageView {
  id: string;
  role: StudioMessageRole;
  content: string;
  status: StudioMessageStatus;
  imageUrl: string | null;
  referenceUrls: string[];
  aspectRatio: StudioAspectRatio | null;
  modelId: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface StudioConversationSummary {
  id: string;
  title: string;
  previewUrl: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface StudioConversationView extends StudioConversationSummary {
  messages: StudioMessageView[];
}

export const listingSetMarkets = ["cn", "sea", "west"] as const;

export type ListingSetMarket = (typeof listingSetMarkets)[number];

export const listingSetMarketLabels: Record<ListingSetMarket, string> = {
  cn: "中国",
  sea: "东南亚",
  west: "欧美",
};

export const listingSetSlotKeys = [
  "hero_white",
  "scene",
  "model",
  "detail",
  "selling",
  "specs",
  "usage",
  "comparison",
  "material",
] as const;

export type ListingSetSlotKey = (typeof listingSetSlotKeys)[number];

export const listingSetSlotCatalog: Record<
  ListingSetSlotKey,
  {
    label: string;
    hint: string;
    sectionType: SectionTypeKey;
    defaultCount: number;
    noTextInImage: boolean;
  }
> = {
  hero_white: {
    label: "主图（白底/合规）",
    hint: "纯白底、无字无标，符合平台主图规范。",
    sectionType: "hero",
    defaultCount: 1,
    noTextInImage: true,
  },
  scene: {
    label: "场景展示",
    hint: "生活场景里把商品用起来，先建立氛围。",
    sectionType: "scenario",
    defaultCount: 1,
    noTextInImage: true,
  },
  model: {
    label: "模特场景图",
    hint: "真人出镜，交代尺度、佩戴或使用方式。",
    sectionType: "scenario",
    defaultCount: 1,
    noTextInImage: true,
  },
  detail: {
    label: "细节说明",
    hint: "特写结构，图内标注 2-3 个真实部件。",
    sectionType: "detail_closeup",
    defaultCount: 1,
    noTextInImage: false,
  },
  selling: {
    label: "卖点详解",
    hint: "把核心卖点做成可阅读的商业信息图。",
    sectionType: "selling_points",
    defaultCount: 1,
    noTextInImage: false,
  },
  specs: {
    label: "规格参数",
    hint: "尺寸、材质、参数一张讲清楚。",
    sectionType: "specs",
    defaultCount: 1,
    noTextInImage: false,
  },
  usage: {
    label: "使用场景",
    hint: "典型使用瞬间，降低想象成本。",
    sectionType: "scenario",
    defaultCount: 1,
    noTextInImage: true,
  },
  comparison: {
    label: "对比说明",
    hint: "和常见替代方案比出差异。",
    sectionType: "comparison",
    defaultCount: 0,
    noTextInImage: false,
  },
  material: {
    label: "材质工艺",
    hint: "材质纹理和做工特写。",
    sectionType: "material",
    defaultCount: 0,
    noTextInImage: false,
  },
};

export const defaultListingSetSlotKeys: ListingSetSlotKey[] = [
  "hero_white",
  "scene",
  "model",
  "detail",
  "selling",
  "specs",
  "usage",
];

export const listingSetGroupKeys = ["white", "scene", "selling", "other"] as const;

export type ListingSetGroupKey = (typeof listingSetGroupKeys)[number];

export const listingSetGroupCatalog: Record<
  ListingSetGroupKey,
  {
    label: string;
    hint: string;
    keys: ListingSetSlotKey[];
    defaultCount: number;
    minCount: number;
    aiMatch: boolean;
  }
> = {
  white: {
    label: "白底图",
    hint: "白底主图，多角度呈现商品细节",
    keys: ["hero_white"],
    defaultCount: 1,
    minCount: 1,
    aiMatch: false,
  },
  scene: {
    label: "场景图",
    hint: "展示商品的生活使用场景和人物搭配",
    keys: ["scene", "model", "usage"],
    defaultCount: 2,
    minCount: 0,
    aiMatch: false,
  },
  selling: {
    label: "卖点图",
    hint: "展示商品的核心卖点及细节特写",
    keys: ["selling", "detail"],
    defaultCount: 2,
    minCount: 0,
    aiMatch: false,
  },
  other: {
    label: "其他",
    hint: "对比图、尺寸图等，根据商品智能匹配",
    keys: ["specs", "comparison", "material"],
    defaultCount: 2,
    minCount: 0,
    aiMatch: true,
  },
};

export const defaultListingSetGroupCounts = Object.fromEntries(
  listingSetGroupKeys.map((key) => [key, listingSetGroupCatalog[key].defaultCount]),
) as Record<ListingSetGroupKey, number>;

export function expandListingSetGroupCounts(counts: Partial<Record<ListingSetGroupKey, number>>): ListingSetSlotKey[] {
  const keys: ListingSetSlotKey[] = [];
  for (const group of listingSetGroupKeys) {
    const pool = listingSetGroupCatalog[group].keys;
    const count = Math.max(0, Math.round(Number(counts[group] ?? 0)));
    for (let index = 0; index < count; index += 1) {
      keys.push(pool[index % pool.length]);
    }
  }
  return keys;
}

export const listingSetMinSlotCount = 7;
export const listingSetMaxSlotCount = 10;
export const listingSetMaxSourceImages = 6;

export interface ListingSetCopy {
  productName: string;
  listingTitle: string;
  sellingPoints: string[];
  description: string;
  keywords: string[];
}

export interface ListingSetViralStyle {
  summary: string;
  visualTropes: string[];
  colorMood: string;
  avoid: string[];
}

export interface ListingSetSlotView {
  key: string;
  slotKey: ListingSetSlotKey;
  sectionId: string | null;
  order: number;
  label: string;
  title: string;
  goal: string;
  status: "idle" | "queued" | "generating" | "success" | "failed";
  imageUrl: string | null;
  errorMessage: string | null;
}

export interface ListingSetProjectSummary {
  id: string;
  name: string;
  platform: string;
  updatedAt: string;
  coverImageUrl: string | null;
  slotCount: number;
  status: string;
  latestTaskId: string | null;
  latestTaskStatus: string | null;
}

export interface ListingSetView {
  id: string;
  name: string;
  platform: string;
  status: string;
  aspectRatio: "1:1" | "3:4" | "9:16";
  contentLanguage: string;
  market: ListingSetMarket;
  sellingPoints: string;
  listingCopy: ListingSetCopy | null;
  viralStyle: ListingSetViralStyle | null;
  sourceImages: Array<{ id: string; url: string; fileName: string }>;
  slots: ListingSetSlotView[];
  latestTaskId: string | null;
  latestTaskStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PlatformOption = (typeof platformOptions)[number];
export type StyleOption = (typeof styleOptions)[number];
export type SectionTypeKey = (typeof sectionTypes)[number];
export type CapabilityKey = (typeof capabilityKeys)[number];
export type ModelRoleKey = (typeof roleKeys)[number];
export type EndpointProbeState = "available" | "unavailable" | "rate_limited" | "unknown" | "not_applicable";

export type CapabilityMap = Record<CapabilityKey, boolean> & {
  real_image_gen?: boolean;
  real_image_edit?: boolean;
};

export type ModelRoleMap = Record<ModelRoleKey, boolean>;

export interface ProviderConnectionInput {
  name: string;
  baseUrl: string;
  apiKey: string;
}

export interface ModelEndpointSupport {
  imageGeneration: EndpointProbeState;
  imageEdit: EndpointProbeState;
  note?: string | null;
}

export interface ModelDetectionResult {
  modelId: string;
  label: string;
  capabilities: CapabilityMap;
  roles: ModelRoleMap;
  quality?: string | null;
  latency?: string | null;
  cost?: string | null;
  isAvailable: boolean;
  endpointSupport?: ModelEndpointSupport;
}

export interface ProductAnalysisResult {
  productName: string;
  category: string;
  subcategory: string;
  material: string;
  color: string;
  styleTags: string[];
  targetAudience: string[];
  usageScenarios: string[];
  coreSellingPoints: string[];
  differentiationPoints: string[];
  userConcerns: string[];
  recommendedFocusPoints: string[];
  suggestedSectionPlan: Array<{
    type: SectionTypeKey;
    title: string;
    goal: string;
  }>;
}

export interface PlannedSectionInput {
  id: string;
  type: SectionTypeKey;
  title: string;
  goal: string;
  copy: string;
  visualPrompt: string;
  imageStatus: "idle" | "queued" | "generating" | "success" | "failed";
  imageUrl?: string | null;
  editableFields: Record<string, unknown>;
}
