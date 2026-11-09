/* Tiệm Cuộn Len — Background Live Chat Notification Service Worker */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const convId =
    (event.notification &&
      event.notification.data &&
      event.notification.data.conversationId) ||
    null;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if ('focus' in client) {
            client.postMessage({
              type: 'TCL_OPEN_CHAT_CONVERSATION',
              conversationId: convId,
            });
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow('/');
        }
        return null;
      })
  );
});
