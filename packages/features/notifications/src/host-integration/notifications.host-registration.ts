import { createNotificationsDefaultAdapter } from '../adapter/notifications-default.adapter';
import { notificationsPluginManifest } from '../manifest/notifications-plugin.manifest';

export const notificationsHostRegistration = {
  pluginKey: 'notifications',
  manifest: notificationsPluginManifest,
  createAdapter: createNotificationsDefaultAdapter
};
