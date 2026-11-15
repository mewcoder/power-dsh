export const MEMORY_TYPES = ['user', 'feedback', 'project', 'reference'] as const;
export type { MemoryType, MemoryEntry, MemoryDetail, MemoryFileDetail, MemoryScope, MemoryCatalog, MemoryWriteResult,
  MemoryModel, MemoryModels, MemoryCleanupChange, MemoryCleanupPreview, MemoryCleanupResult } from '../../shared/types/wire.ts';
export const MEMORY_ERRORS = [
  'memoryDisabled', 'memoryUnavailable', 'memoryLoadFailed', 'memoryWriteFailed', 'memoryInvalid',
  'memoryConflict', 'memoryBusy', 'memoryNotFound', 'memoryWorkspaceUnavailable', 'memoryLimit', 'memoryClearPartial',
  'memoryFolderUnavailable', 'memoryOpenFolderFailed',
  'memoryModelUnavailable', 'memoryCleanupFailed', 'memoryCleanupLimit', 'memoryPreviewExpired', 'memoryRecoveryRequired',
  'memoryIncomplete',
] as const;
export function memoryError(error: unknown, fallback = 'memoryWriteFailed'): string {
  const message = error instanceof Error ? error.message : '';
  return MEMORY_ERRORS.find(key => message === key) ?? fallback;
}
