/**
 * [INPUT]: 无运行时依赖，只处理 Project.modelSnapshot 的浅合并与已知嵌套袋
 * [OUTPUT]: 对外提供 isSnapshotRecord、mergeProjectSnapshot
 * [POS]: lib/utils 的项目快照合并契约；分析/PATCH 写回必须走这里，禁止整袋替换
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const NESTED_SNAPSHOT_KEYS = ["previewConfig", "generationSettings", "listingSet"] as const;

export function isSnapshotRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function mergeProjectSnapshot(
  current: unknown,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base = isSnapshotRecord(current) ? { ...current } : {};
  const next: Record<string, unknown> = { ...base, ...patch };

  for (const key of NESTED_SNAPSHOT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) {
      continue;
    }

    const patchValue = patch[key];
    if (!isSnapshotRecord(patchValue)) {
      next[key] = patchValue;
      continue;
    }

    const baseValue = base[key];
    next[key] = {
      ...(isSnapshotRecord(baseValue) ? baseValue : {}),
      ...patchValue,
    };
  }

  return next;
}
