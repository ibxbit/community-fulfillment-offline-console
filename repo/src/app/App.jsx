import { useEffect, useMemo, useState } from "react";
import { useAppState } from "./AppStateContext";
import { DashboardPanel } from "../modules/dashboard/DashboardPanel";
import { FulfillmentManagementPanel } from "../modules/fulfillment/FulfillmentManagementPanel";
import { AdminConfigPanel } from "../modules/admin/AdminConfigPanel";
import { BulkImportExportPanel } from "../modules/admin/BulkImportExportPanel";
import { RequestWorkflowPanel } from "../modules/requests/RequestWorkflowPanel";
import { ReviewerPanel } from "../modules/requests/ReviewerPanel";
import { MessageCenterPanel } from "../modules/messaging/MessageCenterPanel";

const LAYOUT_KEY = "cfso_ui_layout_state";

function loadLayoutState() {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) {
      return {
        showFulfillment: true,
        showAdmin: true,
        showBulk: true,
      };
    }

    return {
      showFulfillment: true,
      showAdmin: true,
      showBulk: true,
      ...JSON.parse(raw),
    };
  } catch {
    return {
      showFulfillment: true,
      showAdmin: true,
      showBulk: true,
    };
  }
}

export function App() {
  const { ready, auth, preferences, services } = useAppState();
  const [layout, setLayout] = useState(() => loadLayoutState());
  const [validation, setValidation] = useState(null);

  useEffect(() => {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  }, [layout]);

  useEffect(() => {
    let active = true;

    async function validateIntegration() {
      if (!services?.integrationValidation) {
        return;
      }

      const result = await services.integrationValidation.runAll();
      if (active && !result.error) {
        setValidation(result.data);
      }
    }

    validateIntegration();

    return () => {
      active = false;
    };
  }, [services]);

  const actor = useMemo(
    () => ({
      userId: auth.currentUser?._id ?? "system",
      role: auth.currentUser?.role ?? "Admin",
    }),
    [auth.currentUser],
  );

  function handleQuickAction(section) {
    if (section === "fulfillment") {
      setLayout((current) => ({ ...current, showFulfillment: true }));
      document
        .getElementById("fulfillment-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (section === "admin") {
      setLayout((current) => ({ ...current, showAdmin: true }));
      document
        .getElementById("admin-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (section === "bulk") {
      setLayout((current) => ({ ...current, showBulk: true }));
      document
        .getElementById("bulk-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <main className="shell" data-theme={preferences.theme}>
      <header className="shell__header">
        <h1>Community Fulfillment &amp; Submission Operations Console</h1>
        <p>Offline-first architecture scaffold is initialized.</p>
      </header>

      <section className="panel">
        <h2>System Status</h2>
        <ul>
          <li>Bootstrapped: {ready ? "Yes" : "No"}</li>
          <li>Auth User: {auth.currentUser?.name ?? "Not signed in"}</li>
          <li>Role: {auth.currentUser?.role ?? "N/A"}</li>
          <li>Theme Preference: {preferences.theme}</li>
          <li>
            Integration Validation:{" "}
            {validation ? (validation.allOk ? "Pass" : "Fail") : "Running"}
          </li>
        </ul>
      </section>

      <DashboardPanel
        dashboardService={services.dashboard}
        onQuickAction={handleQuickAction}
      />

      <section className="panel layout-controls">
        <h2>Layout</h2>
        <div>
          <button
            type="button"
            onClick={() =>
              setLayout((current) => ({
                ...current,
                showFulfillment: !current.showFulfillment,
              }))
            }
          >
            {layout.showFulfillment ? "Hide" : "Show"} fulfillment
          </button>
          <button
            type="button"
            onClick={() =>
              setLayout((current) => ({
                ...current,
                showAdmin: !current.showAdmin,
              }))
            }
          >
            {layout.showAdmin ? "Hide" : "Show"} admin config
          </button>
          <button
            type="button"
            onClick={() =>
              setLayout((current) => ({
                ...current,
                showBulk: !current.showBulk,
              }))
            }
          >
            {layout.showBulk ? "Hide" : "Show"} bulk import/export
          </button>
        </div>
      </section>

      {layout.showFulfillment ? (
        <div id="fulfillment-panel">
          <FulfillmentManagementPanel
            service={services.fulfillmentManagement}
            shipmentService={services.shipmentService}
            actor={actor}
          />
        </div>
      ) : null}

      <RequestWorkflowPanel
        requestService={services.requestService}
        actor={actor}
      />
      <ReviewerPanel
        requestService={services.requestService}
        reviewerTools={services.reviewerTools}
        actor={actor}
      />
      <MessageCenterPanel messagingService={services.messaging} actor={actor} />

      {layout.showAdmin ? (
        <div id="admin-panel">
          <AdminConfigPanel service={services.adminConfig} />
        </div>
      ) : null}

      {layout.showBulk ? (
        <div id="bulk-panel">
          <BulkImportExportPanel service={services.bulkData} />
        </div>
      ) : null}
    </main>
  );
}
