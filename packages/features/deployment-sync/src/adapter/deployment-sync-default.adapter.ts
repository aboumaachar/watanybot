import type { DeploymentSyncAdapter } from '../contracts/deployment-sync-plugin-contract';
import { defaultDeploymentSyncSettings } from '../config/deployment-sync-plugin-settings.defaults';
import { deploymentSyncPluginManifest } from '../manifest/deployment-sync-plugin.manifest';
export function createDeploymentSyncDefaultAdapter(): DeploymentSyncAdapter { return { getSettings: () => defaultDeploymentSyncSettings, getManifest: () => deploymentSyncPluginManifest }; }