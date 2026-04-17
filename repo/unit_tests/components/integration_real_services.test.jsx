/**
 * Higher-fidelity component integration tests using REAL services.
 * Validates actual wiring between React components and the service layer,
 * including database persistence checks.
 */
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import "./componentTestSetup";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTestContext, clearAllCollections } from "../testHelpers";
import { AdminConfigPanel } from "../../src/modules/admin/AdminConfigPanel";
import { MessageCenterPanel } from "../../src/modules/messaging/MessageCenterPanel";
import { DashboardPanel } from "../../src/modules/dashboard/DashboardPanel";

afterEach(cleanup);

describe("AdminConfigPanel with real services", () => {
  let services;

  beforeEach(async () => {
    ({ services } = await createTestContext());
    await clearAllCollections(services);
  });

  it("saves a service area, persists to DB, and displays it in the list", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <AdminConfigPanel service={services.adminConfig} />,
    );

    await waitFor(() => {
      expect(container.querySelector("h3")).toBeTruthy();
    });

    await user.type(screen.getByPlaceholderText("Area name"), "Real Area");
    await user.type(
      screen.getByPlaceholderText("Locations (comma separated)"),
      "loc-real,loc-two",
    );
    await user.click(screen.getByText("Save service area"));

    await waitFor(() => {
      expect(screen.getByText("Service area saved")).toBeTruthy();
    });

    // Verify the area appears in the rendered list
    await waitFor(() => {
      expect(container.textContent).toContain("Real Area");
      expect(container.textContent).toContain("loc-real");
    });

    // Verify actual database persistence
    const dbResult = await services.adminConfig.listServiceAreas();
    expect(dbResult.data.length).toBe(1);
    expect(dbResult.data[0].name).toBe("Real Area");
    expect(dbResult.data[0].locations).toEqual(["loc-real", "loc-two"]);
  });

  it("saves commission rule, previews, and verifies DB persistence", async () => {
    const user = userEvent.setup();

    render(<AdminConfigPanel service={services.adminConfig} />);

    await waitFor(() => {
      expect(screen.getByText("Save commission %")).toBeTruthy();
    });

    await user.click(screen.getByText("Save commission %"));

    await waitFor(() => {
      expect(screen.getByText("Commission rule saved")).toBeTruthy();
    });

    // Verify DB persistence
    const dbRule = await services.adminConfig.getCommissionRule();
    expect(dbRule.data.percentage).toBe(3.5);

    // Preview commission calculation
    await user.click(screen.getByText("Preview commission"));

    await waitFor(() => {
      expect(screen.getByText(/3.5% of 100/)).toBeTruthy();
      expect(screen.getByText(/= 3.5/)).toBeTruthy();
    });
  });

  it("saves leader binding and verifies it appears in list and DB", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <AdminConfigPanel service={services.adminConfig} />,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Leader ID")).toBeTruthy();
    });

    await user.type(screen.getByPlaceholderText("Leader ID"), "leader-real");
    await user.type(screen.getByPlaceholderText("Leader name"), "Real Leader");
    await user.type(screen.getByPlaceholderText("Location ID"), "loc-bind");

    await user.click(screen.getByText("Save binding"));

    await waitFor(() => {
      expect(screen.getByText("Group leader binding saved")).toBeTruthy();
    });

    // Verify list updated
    await waitFor(() => {
      expect(container.textContent).toContain("Real Leader");
      expect(container.textContent).toContain("leader-real");
    });

    // Verify DB persistence
    const dbBindings = await services.adminConfig.listLeaderBindings();
    expect(dbBindings.data.length).toBe(1);
    expect(dbBindings.data[0].leaderId).toBe("leader-real");
    expect(dbBindings.data[0].leaderName).toBe("Real Leader");
  });
});

describe("MessageCenterPanel with real services", () => {
  let services;

  beforeEach(async () => {
    ({ services } = await createTestContext());
    await clearAllCollections(services);
  });

  it("creates a template, verifies DB persistence, and it appears in list", async () => {
    const user = userEvent.setup();
    const actor = { userId: "test_user", role: "Admin" };

    const { container } = render(
      <MessageCenterPanel messagingService={services.messaging} actor={actor} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Message Center")).toBeTruthy();
    });

    await user.type(screen.getByPlaceholderText("Template ID"), "real-tmpl");
    const titleInputs = container.querySelectorAll('input[placeholder="Title"]');
    await user.type(titleInputs[0], "Real Title");
    await user.type(
      screen.getByPlaceholderText("Body with {{var}}"),
      "Welcome to the platform",
    );
    await user.click(screen.getByText("Save template"));

    await waitFor(() => {
      expect(screen.getByText("Template saved")).toBeTruthy();
    });

    // Verify template appears in the rendered list
    await waitFor(() => {
      expect(container.textContent).toContain("real-tmpl");
    });

    // Verify actual DB persistence
    const dbTemplates = await services.messaging.listTemplates();
    expect(dbTemplates.data.length).toBe(1);
    expect(dbTemplates.data[0].templateId).toBe("real-tmpl");
    expect(dbTemplates.data[0].title).toBe("Real Title");
    expect(dbTemplates.data[0].body).toBe("Welcome to the platform");
  });

  it("queues a message via UI, delivers it, and verifies receipt exists", async () => {
    const user = userEvent.setup();
    const actor = { userId: "test_user", role: "Admin" };

    const { container } = render(
      <MessageCenterPanel messagingService={services.messaging} actor={actor} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Message Center")).toBeTruthy();
    });

    // Fill queue form — use the second set of Title/Body inputs (queue section)
    const titleInputs = container.querySelectorAll('input[placeholder="Title"]');
    const bodyInputs = container.querySelectorAll('input[placeholder="Body"]');
    await user.type(titleInputs[titleInputs.length - 1], "Queue Test");
    await user.type(bodyInputs[bodyInputs.length - 1], "Queue Body");

    await user.click(screen.getByRole("button", { name: "Queue" }));

    await waitFor(() => {
      expect(screen.getByText("Message queued")).toBeTruthy();
    });

    // Verify message is in the DB queue
    const queueResult = await services.messaging.listQueue("test_user");
    expect(queueResult.data.length).toBe(1);
    expect(queueResult.data[0].title).toBe("Queue Test");

    // Deliver via UI
    await user.click(screen.getByText("Deliver next"));

    await waitFor(() => {
      expect(screen.getByText("Delivered next message")).toBeTruthy();
    });

    // Verify receipt exists in DB
    const receipts = await services.messaging.listReceipts("test_user");
    expect(receipts.data.length).toBe(1);
    expect(receipts.data[0].status).toBe("delivered");
  });
});

describe("DashboardPanel with real services", () => {
  let services;

  beforeEach(async () => {
    ({ services } = await createTestContext());
    await clearAllCollections(services);
  });

  it("loads real activity data (empty DB) and displays zeros", async () => {
    const { container } = render(
      <DashboardPanel
        dashboardService={services.dashboard}
        onQuickAction={() => {}}
      />,
    );

    await waitFor(() => {
      const strongs = container.querySelectorAll(".dashboard-card strong");
      expect(strongs.length).toBe(4);
    });

    const strongs = container.querySelectorAll(".dashboard-card strong");
    const values = Array.from(strongs).map((el) => el.textContent);
    expect(values).toEqual(["0", "0", "0", "0"]);

    // Verify the labels are correct
    const cards = container.querySelectorAll(".dashboard-card");
    expect(cards[0].textContent).toContain("Requests created today");
    expect(cards[1].textContent).toContain("Approvals today");
    expect(cards[2].textContent).toContain("Shipments marked shipped");
    expect(cards[3].textContent).toContain("Queued in-app messages");
  });

  it("quick action callbacks fire correctly", async () => {
    const user = userEvent.setup();
    const onQuickAction = vi.fn();

    const { container } = render(
      <DashboardPanel
        dashboardService={services.dashboard}
        onQuickAction={onQuickAction}
      />,
    );

    const buttons = container.querySelectorAll(".dashboard-actions button");
    expect(buttons.length).toBe(3);
    expect(buttons[0].textContent).toBe("Open fulfillment");
    expect(buttons[1].textContent).toBe("Open admin config");
    expect(buttons[2].textContent).toBe("Open bulk import/export");

    await user.click(buttons[0]);
    expect(onQuickAction).toHaveBeenCalledWith("fulfillment");

    await user.click(buttons[1]);
    expect(onQuickAction).toHaveBeenCalledWith("admin");

    await user.click(buttons[2]);
    expect(onQuickAction).toHaveBeenCalledWith("bulk");
  });
});
