export type KbStudioMode = 'search' | 'authoring' | 'review' | 'import' | 'admin';
export interface KbStudioPluginSettings { pluginKey: 'kb-studio'; enabled: boolean; modes: KbStudioMode[]; childFeatures: Record<string, boolean>; display: { showSearch: boolean; showUploader: boolean; showReviewQueue: boolean; showSourceTrace: boolean }; permissions: { adminRoles: string[]; editorRoles: string[]; viewerRoles: string[] }; }
export interface KbStudioPluginManifest { pluginKey: 'kb-studio'; displayName: string; version: string; exportable: boolean; replaceable: boolean; adminConfigurable: boolean; }
export interface KbStudioPluginAdapter { getSettings(): KbStudioPluginSettings; getManifest(): KbStudioPluginManifest; }
