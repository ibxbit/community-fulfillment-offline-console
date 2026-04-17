import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import "./componentTestSetup";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../src/app/App";
import * as AppStateContext from "../../src/app/AppStateContext";

afterEach(cleanup);

function createMockServices() {
  return {
    dashboard: {
      getTodayActivity: vi.fn().mockResolvedValue({
        status: 200,
        data: {
          createdToday: 0,
          approvedToday: 0,
          shippedToday: 0,
          notificationsQueued: 0,
        },
        error: null,
      }),
    },
    fulfillmentManagement: {
      search: vi.fn().mockResolvedValue({
        status: 200,
        data: { items: [], total: 0, page: 1, pageSize: 10 },
        error: null,
      }),
    },
    shipmentService: {
      assignCarrier: vi.fn(),
    },
    requestService: {
      list: vi.fn().mockResolvedValue({
        status: 200,
        data: [],
        error: null,
      }),
      create: vi.fn(),
      submit: vi.fn(),
      archive: vi.fn(),
    },
    reviewerTools: {
      approve: vi.fn(),
      returnWithComments: vi.fn(),
      addComment: vi.fn(),
      attachExceptionReason: vi.fn(),
    },
    messaging: {
      listTemplates: vi.fn().mockResolvedValue({
        status: 200,
        data: [],
        error: null,
      }),
      listQueue: vi.fn().mockResolvedValue({
        status: 200,
        data: [],
        error: null,
      }),
      listReceipts: vi.fn().mockResolvedValue({
        status: 200,
        data: [],
        error: null,
      }),
      getSubscriptionPreferences: vi.fn().mockResolvedValue({
        status: 200,
        data: {
          preferences: {
            allowAll: true,
            mutedTemplateIds: [],
            mutedPriorities: [],
          },
        },
        error: null,
      }),
    },
    adminConfig: {
      listServiceAreas: vi
        .fn()
        .mockResolvedValue({ status: 200, data: [], error: null }),
      listLeaderBindings: vi
        .fn()
        .mockResolvedValue({ status: 200, data: [], error: null }),
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
    },
    bulkData: {
      getSupportedCollections: vi.fn().mockReturnValue(["users"]),
      generateTemplate: vi.fn().mockReturnValue({
        status: 200,
        data: { generated: true },
        error: null,
      }),
      exportData: vi.fn().mockResolvedValue({
        status: 200,
        data: { exportedRows: 0 },
        error: null,
      }),
      importData: vi.fn(),
    },
    integrationValidation: {
      runAll: vi.fn().mockResolvedValue({
        status: 200,
        data: {
          allOk: true,
          report: {},
        },
        error: null,
      }),
    },
  };
}

function renderApp(overrides = {}) {
  const mockServices = createMockServices();
  const mockState = {
    ready: true,
    auth: {
      currentUser: {
        _id: "admin_1",
        name: "Admin User",
        role: "Admin",
      },
    },
    preferences: { theme: "light" },
    services: mockServices,
    ...overrides,
  };

  vi.spyOn(AppStateContext, "useAppState").mockReturnValue(mockState);

  return { ...render(<App />), mockServices, mockState };
}

beforeEach(() => {
  localStorage.removeItem("cfso_ui_layout_state");
  vi.restoreAllMocks();
});

describe("App", () => {
  it("renders the application header", () => {
    renderApp();
    expect(
      screen.getByText(
        "Community Fulfillment & Submission Operations Console",
      ),
    ).toBeTruthy();
  });

  it("displays system status section with bootstrapped state", () => {
    const { container } = renderApp();
    expect(screen.getByText("System Status")).toBeTruthy();
    expect(container.textContent).toContain("Bootstrapped: Yes");
  });

  it("shows auth user name and role", () => {
    const { container } = renderApp();
    expect(container.textContent).toContain("Auth User: Admin User");
    expect(container.textContent).toContain("Role: Admin");
  });

  it("shows 'Not signed in' when no auth user", () => {
    const { container } = renderApp({ auth: { currentUser: null } });
    expect(container.textContent).toContain("Not signed in");
  });

  it("shows 'No' for bootstrapped when not ready", () => {
    const { container } = renderApp({ ready: false });
    expect(container.textContent).toContain("Bootstrapped: No");
  });

  it("displays theme preference", () => {
    const { container } = renderApp();
    expect(container.textContent).toContain("Theme Preference: light");
  });

  it("displays integration validation result as Pass", async () => {
    const { container } = renderApp();

    await waitFor(() => {
      expect(container.textContent).toContain("Integration Validation: Pass");
    });
  });

  it("displays integration validation result as Fail", async () => {
    const mockServices = createMockServices();
    mockServices.integrationValidation.runAll.mockResolvedValue({
      status: 200,
      data: { allOk: false, report: {} },
      error: null,
    });

    const { container } = renderApp({ services: mockServices });

    await waitFor(() => {
      expect(container.textContent).toContain("Integration Validation: Fail");
    });
  });

  it("shows Running while validation is pending", () => {
    const mockServices = createMockServices();
    mockServices.integrationValidation.runAll.mockImplementation(
      () => new Promise(() => {}),
    );

    const { container } = renderApp({ services: mockServices });
    expect(container.textContent).toContain("Integration Validation: Running");
  });

  it("renders layout toggle buttons", () => {
    const { container } = renderApp();
    const buttons = container.querySelectorAll(".layout-controls button");
    expect(buttons.length).toBe(3);
  });

  it("toggles fulfillment panel visibility", async () => {
    const user = userEvent.setup();
    const { container } = renderApp();

    // Fulfillment panel should be visible initially
    expect(container.querySelector("#fulfillment-panel")).toBeTruthy();

    const toggleBtn = Array.from(
      container.querySelectorAll(".layout-controls button"),
    ).find((b) => b.textContent.includes("fulfillment"));
    await user.click(toggleBtn);

    expect(container.querySelector("#fulfillment-panel")).toBeNull();
  });

  it("toggles admin config panel visibility", async () => {
    const user = userEvent.setup();
    const { container } = renderApp();

    expect(container.querySelector("#admin-panel")).toBeTruthy();

    const toggleBtn = Array.from(
      container.querySelectorAll(".layout-controls button"),
    ).find((b) => b.textContent.includes("admin"));
    await user.click(toggleBtn);

    expect(container.querySelector("#admin-panel")).toBeNull();
  });

  it("toggles bulk panel visibility", async () => {
    const user = userEvent.setup();
    const { container } = renderApp();

    expect(container.querySelector("#bulk-panel")).toBeTruthy();

    const toggleBtn = Array.from(
      container.querySelectorAll(".layout-controls button"),
    ).find((b) => b.textContent.includes("bulk"));
    await user.click(toggleBtn);

    expect(container.querySelector("#bulk-panel")).toBeNull();
  });

  it("persists layout state to localStorage", async () => {
    const user = userEvent.setup();
    const { container } = renderApp();

    const toggleBtn = Array.from(
      container.querySelectorAll(".layout-controls button"),
    ).find((b) => b.textContent.includes("fulfillment"));
    await user.click(toggleBtn);

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem("cfso_ui_layout_state"));
      expect(saved.showFulfillment).toBe(false);
    });
  });

  it("restores layout state from localStorage", () => {
    localStorage.setItem(
      "cfso_ui_layout_state",
      JSON.stringify({
        showFulfillment: false,
        showAdmin: false,
        showBulk: false,
      }),
    );

    const { container } = renderApp();

    expect(container.querySelector("#fulfillment-panel")).toBeNull();
    expect(container.querySelector("#admin-panel")).toBeNull();
    expect(container.querySelector("#bulk-panel")).toBeNull();
  });

  it("renders all major panels when visible", () => {
    const { container } = renderApp();

    expect(container.querySelector("#dashboard-panel")).toBeTruthy();
    expect(container.querySelector("#fulfillment-panel")).toBeTruthy();
    expect(container.querySelector("#request-workflow-panel")).toBeTruthy();
    expect(container.querySelector("#reviewer-panel")).toBeTruthy();
    expect(container.querySelector("#message-center-panel")).toBeTruthy();
    expect(container.querySelector("#admin-panel")).toBeTruthy();
    expect(container.querySelector("#bulk-panel")).toBeTruthy();
  });

  it("applies data-theme attribute from preferences", () => {
    const { container } = renderApp({ preferences: { theme: "dark" } });

    const main = container.querySelector("main");
    expect(main.getAttribute("data-theme")).toBe("dark");
  });
});
