import { useEffect, useState } from "react";

export function DashboardPanel({ dashboardService, onQuickAction }) {
  const [activity, setActivity] = useState({
    createdToday: 0,
    approvedToday: 0,
    shippedToday: 0,
    notificationsQueued: 0,
  });

  useEffect(() => {
    let active = true;

    async function loadTodayActivity() {
      if (!dashboardService) {
        return;
      }

      const result = await dashboardService.getTodayActivity();

      if (!active) {
        return;
      }

      if (!result.error) {
        setActivity(result.data);
      }
    }

    loadTodayActivity();

    return () => {
      active = false;
    };
  }, [dashboardService]);

  return (
    <section className="panel" id="dashboard-panel">
      <h2>Dashboard</h2>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <span>Requests created today</span>
          <strong>{activity.createdToday}</strong>
        </div>
        <div className="dashboard-card">
          <span>Approvals today</span>
          <strong>{activity.approvedToday}</strong>
        </div>
        <div className="dashboard-card">
          <span>Shipments marked shipped</span>
          <strong>{activity.shippedToday}</strong>
        </div>
        <div className="dashboard-card">
          <span>Queued in-app messages</span>
          <strong>{activity.notificationsQueued}</strong>
        </div>
      </div>

      <div className="dashboard-actions">
        <button type="button" onClick={() => onQuickAction("fulfillment")}>
          Open fulfillment
        </button>
        <button type="button" onClick={() => onQuickAction("admin")}>
          Open admin config
        </button>
        <button type="button" onClick={() => onQuickAction("bulk")}>
          Open bulk import/export
        </button>
      </div>
    </section>
  );
}
