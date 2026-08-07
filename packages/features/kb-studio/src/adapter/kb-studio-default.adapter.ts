import type { KbStudioPluginAdapter } from '../contracts/kb-studio-plugin-contract';
import { kbStudioPluginDefaultSettings } from '../config/kb-studio-plugin-settings.defaults';
import { kbStudioPluginManifest } from '../manifest/kb-studio-plugin.manifest';
export function createKbStudioDefaultAdapter(): KbStudioPluginAdapter { return { getSettings: () => kbStudioPluginDefaultSettings, getManifest: () => kbStudioPluginManifest }; }
