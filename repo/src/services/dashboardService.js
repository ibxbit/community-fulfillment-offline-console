import { ok } from "./response";

function startOfTodayIso() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return start.toISOString();
}

export function createDashboardService({
  requests,
  reviews,
  shipments,
  notifications,
}) {
  return {
    async getTodayActivity() {
      const since = startOfTodayIso();

      const [requestItems, reviewItems, shipmentItems, queuedNotifications] =
        await Promise.all([
          requests.find({ createdAt: { $gte: since } }),
          reviews.find({ action: "review_approve", at: { $gte: since } }),
          shipments.find({ shippedAt: { $gte: since } }),
          notifications.find({ kind: "message", status: "queued" }),
        ]);

      return ok({
        createdToday: requestItems.length,
        approvedToday: reviewItems.length,
        shippedToday: shipmentItems.length,
        notificationsQueued: queuedNotifications.length,
      });
    },
  };
}
