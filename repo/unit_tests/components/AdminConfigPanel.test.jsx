import { describe, expect, it, vi, afterEach } from "vitest";
import "./componentTestSetup";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminConfigPanel } from "../../src/modules/admin/AdminConfigPanel";

afterEach(cleanup);

function createMockAdminService() {
  return {
    listServiceAreas: vi.fn().mockResolvedValue({
      status: 200,
      data: [
        {
          _id: "area-1",
          name: "North",
          priority: 1,
          locations: ["loc-1", "loc-2"],
        },
      ],
      error: null,
    }),
    listLeaderBindings: vi.fn().mockResolvedValue({
      status: 200,
      data: [
        {
          _id: "bind-1",
          leaderId: "l1",
          leaderName: "Alice",
          locationId: "loc-1",
          weight: 2,
        },
      ],
      error: null,
    }),
    getCommissionRule: vi.fn().mockResolvedValue({
      status: 200,
      data: { percentage: 3.5 },
      error: null,
    }),
    getSettlementCycle: vi.fn().mockResolvedValue({
      status: 200,
      data: { frequency: "weekly", dayOfWeek: "Friday", time: "18:00" },
      error: null,
    }),
    getAttributionRules: vi.fn().mockResolvedValue({
      status: 200,
      data: {
        overlapStrategy: "highest_priority",
        multiLeaderStrategy: "weighted_split",
      },
      error: null,
    }),
    upsertServiceArea: vi.fn().mockResolvedValue({
      status: 201,
      data: { _id: "area-new", name: "New Area" },
      error: null,
    }),
    bindGroupLeaderToLocation: vi.fn().mockResolvedValue({
      status: 201,
      data: { leaderId: "l2" },
      error: null,
    }),
    setCommissionRule: vi.fn().mockResolvedValue({
      status: 201,
      data: { percentage: 5 },
      error: null,
    }),
    calculateCommission: vi.fn().mockResolvedValue({
      status: 200,
      data: { orderValue: 100, percentage: 3.5, commissionValue: 3.5 },
      error: null,
    }),
    setSettlementCycle: vi.fn().mockResolvedValue({
      status: 201,
      data: {},
      error: null,
    }),
    setAttributionRules: vi.fn().mockResolvedValue({
      status: 201,
      data: {},
      error: null,
    }),
  };
}

describe("AdminConfigPanel", () => {
  it("renders heading", () => {
    render(<AdminConfigPanel service={createMockAdminService()} />);
    expect(screen.getByText("Admin Configuration")).toBeTruthy();
  });

  it("refreshes all data on mount", async () => {
    const service = createMockAdminService();
    render(<AdminConfigPanel service={service} />);

    await waitFor(() => {
      expect(service.listServiceAreas).toHaveBeenCalled();
      expect(service.listLeaderBindings).toHaveBeenCalled();
      expect(service.getCommissionRule).toHaveBeenCalled();
      expect(service.getSettlementCycle).toHaveBeenCalled();
      expect(service.getAttributionRules).toHaveBeenCalled();
    });
  });

  it("displays loaded service areas", async () => {
    render(<AdminConfigPanel service={createMockAdminService()} />);

    await waitFor(() => {
      expect(screen.getByText(/North/)).toBeTruthy();
    });
  });

  it("displays loaded leader bindings", async () => {
    render(<AdminConfigPanel service={createMockAdminService()} />);

    await waitFor(() => {
      expect(screen.getByText(/Alice/)).toBeTruthy();
    });
  });

  it("saves a service area", async () => {
    const user = userEvent.setup();
    const service = createMockAdminService();
    render(<AdminConfigPanel service={service} />);

    await waitFor(() => expect(service.listServiceAreas).toHaveBeenCalled());

    await user.type(screen.getByPlaceholderText("Area name"), "South");
    await user.type(
      screen.getByPlaceholderText("Locations (comma separated)"),
      "loc-3,loc-4",
    );

    await user.click(screen.getByText("Save service area"));

    await waitFor(() => {
      expect(service.upsertServiceArea).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Service area saved")).toBeTruthy();
    });
  });

  it("saves a leader binding", async () => {
    const user = userEvent.setup();
    const service = createMockAdminService();
    render(<AdminConfigPanel service={service} />);

    await waitFor(() => expect(service.listLeaderBindings).toHaveBeenCalled());

    await user.type(screen.getByPlaceholderText("Leader ID"), "l2");
    await user.type(screen.getByPlaceholderText("Leader name"), "Bob");
    await user.type(screen.getByPlaceholderText("Location ID"), "loc-5");

    await user.click(screen.getByText("Save binding"));

    await waitFor(() => {
      expect(service.bindGroupLeaderToLocation).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Group leader binding saved")).toBeTruthy();
    });
  });

  it("saves a commission rule", async () => {
    const user = userEvent.setup();
    const service = createMockAdminService();
    render(<AdminConfigPanel service={service} />);

    await waitFor(() => expect(service.getCommissionRule).toHaveBeenCalled());

    await user.click(screen.getByText("Save commission %"));

    await waitFor(() => {
      expect(service.setCommissionRule).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Commission rule saved")).toBeTruthy();
    });
  });

  it("previews commission calculation", async () => {
    const user = userEvent.setup();
    const service = createMockAdminService();
    render(<AdminConfigPanel service={service} />);

    await waitFor(() => expect(service.getCommissionRule).toHaveBeenCalled());

    await user.click(screen.getByText("Preview commission"));

    await waitFor(() => {
      expect(service.calculateCommission).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/3.5% of 100/)).toBeTruthy();
    });
  });

  it("saves a settlement cycle", async () => {
    const user = userEvent.setup();
    const service = createMockAdminService();
    render(<AdminConfigPanel service={service} />);

    await waitFor(() =>
      expect(service.getSettlementCycle).toHaveBeenCalled(),
    );

    await user.click(screen.getByText("Save cycle"));

    await waitFor(() => {
      expect(service.setSettlementCycle).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Settlement cycle saved")).toBeTruthy();
    });
  });

  it("saves attribution rules", async () => {
    const user = userEvent.setup();
    const service = createMockAdminService();
    render(<AdminConfigPanel service={service} />);

    await waitFor(() =>
      expect(service.getAttributionRules).toHaveBeenCalled(),
    );

    await user.click(screen.getByText("Save attribution rules"));

    await waitFor(() => {
      expect(service.setAttributionRules).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Attribution rules saved")).toBeTruthy();
    });
  });

  it("displays error message on failed save", async () => {
    const user = userEvent.setup();
    const service = createMockAdminService();
    service.upsertServiceArea.mockResolvedValue({
      status: 400,
      data: null,
      error: { message: "Service area name is required" },
    });

    render(<AdminConfigPanel service={service} />);
    await waitFor(() => expect(service.listServiceAreas).toHaveBeenCalled());

    await user.click(screen.getByText("Save service area"));

    await waitFor(() => {
      expect(
        screen.getByText("Service area name is required"),
      ).toBeTruthy();
    });
  });

  it("renders nothing harmful when service is null", () => {
    render(<AdminConfigPanel service={null} />);
    expect(screen.getByText("Admin Configuration")).toBeTruthy();
  });
});
