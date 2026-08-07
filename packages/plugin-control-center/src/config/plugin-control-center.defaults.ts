import type { PluginControlRecord } from '../contracts/plugin-control-center-contract';
export const WATANY_V2_PLUGIN_KEYS = [
  'address-widget',
  'jobs',
  'market',
  'voting',
  'kb-studio',
  'voice-pipeline',
  'sms-otp',
  'salary-pension',
  'payment-intelligence',
  'deployment-sync',
  'apk-mobile-packaging',
  'hybrid-chat',
  'notifications',
  'unified-glossy-ui',
  'pma-governance'
] as const;
export function createDefaultPluginControlRecords(): PluginControlRecord[] { return WATANY_V2_PLUGIN_KEYS.map((pluginKey) => ({ pluginKey, state: 'review_required', exportReady: true, replaceReady: true, health: 'unknown' })); }