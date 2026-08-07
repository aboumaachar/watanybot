import type { NotificationsPluginAdapter, NotificationsPluginManifest, NotificationsPluginSettings } from '../contracts/notifications-plugin-contract';
import { notificationsPluginManifest } from '../manifest/notifications-plugin.manifest';

export function createNotificationsDefaultAdapter(): NotificationsPluginAdapter {
  return {
    getSettings(): NotificationsPluginSettings {
      return notificationsPluginManifest.settings;
    },
    getManifest(): NotificationsPluginManifest {
      return notificationsPluginManifest;
    }
  };
}
