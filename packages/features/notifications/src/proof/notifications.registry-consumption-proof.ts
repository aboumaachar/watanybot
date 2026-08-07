import { notificationsHostRegistration } from '../host-integration/notifications.host-registration';

export function proveNotificationsRegistryConsumption(): boolean {
  return notificationsHostRegistration.pluginKey === 'notifications' &&
    Boolean(notificationsHostRegistration.manifest) &&
    typeof notificationsHostRegistration.createAdapter === 'function';
}
