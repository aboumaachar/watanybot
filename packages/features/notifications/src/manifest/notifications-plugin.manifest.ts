import type { NotificationsPluginManifest } from '../contracts/notifications-plugin-contract';
import { defaultNotificationsPluginSettings } from '../config/notifications-plugin-settings.defaults';

export const notificationsPluginManifest: NotificationsPluginManifest = {
  pluginKey: 'notifications',
  displayName: 'Notifications',
  version: '0.1.0',
  settings: defaultNotificationsPluginSettings
};
