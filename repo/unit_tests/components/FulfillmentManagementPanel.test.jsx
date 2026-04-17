import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import "./componentTestSetup";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FulfillmentManagementPanel } from "../../src/modules/fulfillment/FulfillmentManagementPanel";

afterEach(cleanup);

const SHIPMENTS = [
  {
    _id: "ship-1",
    date: "2026-04-16",
    itemSku: "SKU-001",
    lot: "LOT-A",
    warehouseLocation: "WH-1",
    documentStatus: "in_progress",
    requester: "user1",
  },
  {
    _id: "ship-2",
    date: "2026-04-15",
    itemSku: "SKU-002",
    lot: "LOT-B",
    warehouseLocation: "WH-2",
    documentStatus: "in_transit",
    requester: "user2",
  },
];

function createMockService(items = SHIPMENTS) {
  return {
    search: vi.fn().mockResolvedValue({
      status: 200,
      data: {
        items,
        total: items.length,
        page: 1,
        pageSize: 10,
      },
      error: null,
    }),
    splitShipment: vi.fn().mockResolvedValue({
      status: 200,
      data: { _id: "ship-1", packages: [] },
      error: null,
    }),
    assignCarrier: vi.fn().mockResolvedValue({
      status: 200,
      data: { _id: "ship-1" },
      error: null,
    }),
    confirmDelivery: vi.fn().mockResolvedValue({
      status: 200,
      data: { _id: "ship-1" },
      error: null,
    }),
    logException: vi.fn().mockResolvedValue({
      status: 200,
      data: { _id: "ship-1" },
      error: null,
    }),
  };
}

function createMockShipmentService() {
  return {
    assignCarrier: vi.fn().mockResolvedValue({
      status: 200,
      data: { _id: "ship-1" },
      error: null,
    }),
  };
}

const ACTOR = { userId: "warehouse_1", role: "Warehouse Staff" };

beforeEach(() => {
  localStorage.removeItem("cfso_fulfillment_last_filters");
  localStorage.removeItem("cfso_fulfillment_layout_state");
  localStorage.removeItem("cfso_fulfillment_filter_presets");
});

describe("FulfillmentManagementPanel", () => {
  it("renders heading", () => {
    render(
      <FulfillmentManagementPanel
        service={createMockService()}
        shipmentService={createMockShipmentService()}
        actor={ACTOR}
      />,
    );
    expect(screen.getByText("Fulfillment Management")).toBeTruthy();
  });

  it("runs initial search on mount and displays results", async () => {
    const service = createMockService();
    render(
      <FulfillmentManagementPanel
        service={service}
        shipmentService={createMockShipmentService()}
        actor={ACTOR}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("SKU-001")).toBeTruthy();
      expect(screen.getByText("SKU-002")).toBeTruthy();
    });

    expect(service.search).toHaveBeenCalled();
  });

  it("shows no shipments message when empty", async () => {
    render(
      <FulfillmentManagementPanel
        service={createMockService([])}
        shipmentService={createMockShipmentService()}
        actor={ACTOR}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("No shipments found.")).toBeTruthy();
    });
  });

  it("filter form submits a search", async () => {
    const user = userEvent.setup();
    const service = createMockService();

    render(
      <FulfillmentManagementPanel
        service={service}
        shipmentService={createMockShipmentService()}
        actor={ACTOR}
      />,
    );

    await waitFor(() => expect(service.search).toHaveBeenCalled());
    service.search.mockClear();

    await user.type(screen.getByPlaceholderText("Item/SKU"), "SKU-001");
    await user.click(screen.getByText("Search"));

    await waitFor(() => {
      expect(service.search).toHaveBeenCalled();
    });
  });

  it("saves and loads filter presets", async () => {
    const user = userEvent.setup();
    const service = createMockService();

    render(
      <FulfillmentManagementPanel
        service={service}
        shipmentService={createMockShipmentService()}
        actor={ACTOR}
      />,
    );

    await waitFor(() => expect(service.search).toHaveBeenCalled());

    await user.type(screen.getByPlaceholderText("Preset name"), "My Preset");
    await user.click(screen.getByText("Save preset"));

    // Preset should now appear in the select
    const options = screen.getAllByRole("option");
    const presetOption = options.find((o) => o.textContent === "My Preset");
    expect(presetOption).toBeTruthy();
  });

  it("opens quick actions drawer on row button click", async () => {
    const user = userEvent.setup();
    const service = createMockService();

    render(
      <FulfillmentManagementPanel
        service={service}
        shipmentService={createMockShipmentService()}
        actor={ACTOR}
      />,
    );

    await waitFor(() => expect(screen.getByText("SKU-001")).toBeTruthy());

    const quickActionButtons = screen.getAllByText("Quick actions");
    await user.click(quickActionButtons[0]);

    expect(screen.getByText(/Quick Actions:/)).toBeTruthy();
    expect(screen.getByText("Apply split")).toBeTruthy();
    expect(screen.getByText("Assign")).toBeTruthy();
    expect(screen.getByText("Confirm")).toBeTruthy();
    expect(screen.getByText("Log exception")).toBeTruthy();
  });

  it("calls splitShipment", async () => {
    const user = userEvent.setup();
    const service = createMockService();

    render(
      <FulfillmentManagementPanel
        service={service}
        shipmentService={createMockShipmentService()}
        actor={ACTOR}
      />,
    );

    await waitFor(() => expect(screen.getByText("SKU-001")).toBeTruthy());

    const quickActionButtons = screen.getAllByText("Quick actions");
    await user.click(quickActionButtons[0]);
    await user.click(screen.getByText("Apply split"));

    await waitFor(() => {
      expect(service.splitShipment).toHaveBeenCalled();
    });
  });

  it("calls shipmentService.assignCarrier when shipmentService is provided", async () => {
    const user = userEvent.setup();
    const service = createMockService();
    const shipmentService = createMockShipmentService();

    render(
      <FulfillmentManagementPanel
        service={service}
        shipmentService={shipmentService}
        actor={ACTOR}
      />,
    );

    await waitFor(() => expect(screen.getByText("SKU-001")).toBeTruthy());

    const quickActionButtons = screen.getAllByText("Quick actions");
    await user.click(quickActionButtons[0]);

    await user.type(screen.getByPlaceholderText("Carrier"), "FedEx");
    await user.type(screen.getByPlaceholderText("Tracking number"), "TRK-1");
    await user.click(screen.getByText("Assign"));

    await waitFor(() => {
      expect(shipmentService.assignCarrier).toHaveBeenCalled();
    });
  });

  it("calls confirmDelivery", async () => {
    const user = userEvent.setup();
    const service = createMockService();

    render(
      <FulfillmentManagementPanel
        service={service}
        shipmentService={createMockShipmentService()}
        actor={ACTOR}
      />,
    );

    await waitFor(() => expect(screen.getByText("SKU-001")).toBeTruthy());

    const quickActionButtons = screen.getAllByText("Quick actions");
    await user.click(quickActionButtons[0]);

    await user.type(screen.getByPlaceholderText("Recipient"), "John");
    await user.click(screen.getByText("Confirm"));

    await waitFor(() => {
      expect(service.confirmDelivery).toHaveBeenCalled();
    });
  });

  it("calls logException", async () => {
    const user = userEvent.setup();
    const service = createMockService();

    render(
      <FulfillmentManagementPanel
        service={service}
        shipmentService={createMockShipmentService()}
        actor={ACTOR}
      />,
    );

    await waitFor(() => expect(screen.getByText("SKU-001")).toBeTruthy());

    const quickActionButtons = screen.getAllByText("Quick actions");
    await user.click(quickActionButtons[0]);

    await user.type(screen.getByPlaceholderText("Notes"), "Damaged package");
    await user.click(screen.getByText("Log exception"));

    await waitFor(() => {
      expect(service.logException).toHaveBeenCalled();
    });
  });

  it("shows error on action failure", async () => {
    const user = userEvent.setup();
    const service = createMockService();
    service.splitShipment.mockResolvedValue({
      status: 404,
      data: null,
      error: { message: "Shipment not found" },
    });

    render(
      <FulfillmentManagementPanel
        service={service}
        shipmentService={createMockShipmentService()}
        actor={ACTOR}
      />,
    );

    await waitFor(() => expect(screen.getByText("SKU-001")).toBeTruthy());

    const quickActionButtons = screen.getAllByText("Quick actions");
    await user.click(quickActionButtons[0]);
    await user.click(screen.getByText("Apply split"));

    await waitFor(() => {
      expect(screen.getByText("Shipment not found")).toBeTruthy();
    });
  });

  it("shows pagination controls", async () => {
    render(
      <FulfillmentManagementPanel
        service={createMockService()}
        shipmentService={createMockShipmentService()}
        actor={ACTOR}
      />,
    );

    await waitFor(() => expect(screen.getByText("SKU-001")).toBeTruthy());

    expect(screen.getByText("Prev")).toBeTruthy();
    expect(screen.getByText("Next")).toBeTruthy();
    expect(screen.getByText(/Page 1/)).toBeTruthy();
  });

  it("persists filters to localStorage", async () => {
    const user = userEvent.setup();
    const service = createMockService();

    render(
      <FulfillmentManagementPanel
        service={service}
        shipmentService={createMockShipmentService()}
        actor={ACTOR}
      />,
    );

    await waitFor(() => expect(service.search).toHaveBeenCalled());

    await user.type(screen.getByPlaceholderText("Item/SKU"), "test-sku");

    await waitFor(() => {
      const saved = JSON.parse(
        localStorage.getItem("cfso_fulfillment_last_filters"),
      );
      expect(saved.itemSku).toBe("test-sku");
    });
  });

  it("persists layout to localStorage", async () => {
    const user = userEvent.setup();

    render(
      <FulfillmentManagementPanel
        service={createMockService()}
        shipmentService={createMockShipmentService()}
        actor={ACTOR}
      />,
    );

    await user.click(screen.getByText(/Hide scanner/));

    await waitFor(() => {
      const saved = JSON.parse(
        localStorage.getItem("cfso_fulfillment_layout_state"),
      );
      expect(saved.showScanner).toBe(false);
    });
  });

  it("toggles scanner visibility", async () => {
    const user = userEvent.setup();

    render(
      <FulfillmentManagementPanel
        service={createMockService()}
        shipmentService={createMockShipmentService()}
        actor={ACTOR}
      />,
    );

    // Initially scanner should be visible
    expect(screen.getByText(/Hide scanner/)).toBeTruthy();

    await user.click(screen.getByText(/Hide scanner/));
    expect(screen.getByText(/Show scanner/)).toBeTruthy();
  });

  it("toggles filters visibility", async () => {
    const user = userEvent.setup();

    render(
      <FulfillmentManagementPanel
        service={createMockService()}
        shipmentService={createMockShipmentService()}
        actor={ACTOR}
      />,
    );

    expect(screen.getByText(/Hide filters/)).toBeTruthy();

    await user.click(screen.getByText(/Hide filters/));
    expect(screen.getByText(/Show filters/)).toBeTruthy();

    // Search form should be gone
    expect(screen.queryByPlaceholderText("Item/SKU")).toBeNull();
  });
});
