import type { NotificationsPluginSettings } from '../contracts/notifications-plugin-contract';

export const defaultNotificationsPluginSettings: NotificationsPluginSettings = {
  pluginKey: 'notifications',
  enabled: true,
  adminConfigurable: true,
  exportable: true,
  replaceable: true
};
