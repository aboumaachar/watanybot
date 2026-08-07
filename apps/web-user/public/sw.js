// Keep the service worker inert so it cannot serve the offline shell.
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Intentionally no-op.
});

function resolveNotificationRoute(data) {
  const route = data && typeof data.route === "string" ? data.route : "";
  return route.startsWith("/") ? route : "/notifications";
}

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = typeof payload.title === "string" && payload.title.trim() ? payload.title.trim() : "موطني";
  const body = typeof payload.body === "string" && payload.body.trim() ? payload.body.trim() : "لديك رسالة جديدة في مجموعة موطني";
  const tag = typeof payload.tag === "string" && payload.tag.trim() ? payload.tag.trim() : undefined;
  const route = resolveNotificationRoute(payload.data);

  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag,
    data: {
      route,
    },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const route = resolveNotificationRoute(event.notification.data);
  const targetUrl = new URL(route, self.location.origin).toString();

  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
    const matchingClient = clientList.find((client) => {
      try {
        return new URL(client.url).origin === self.location.origin;
      } catch {
        return false;
      }
    });

    if (matchingClient && "navigate" in matchingClient) {
      return matchingClient.navigate(targetUrl).then(() => matchingClient.focus());
    }

    return clients.openWindow(targetUrl);
  }));
});
