import { describe, expect, it, vi, afterEach } from "vitest";
import "./componentTestSetup";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardPanel } from "../../src/modules/dashboard/DashboardPanel";

afterEach(cleanup);

function createMockDashboardService(data = {}) {
  return {
    getTodayActivity: vi.fn().mockResolvedValue({
      status: 200,
      data: {
        createdToday: 5,
        approvedToday: 3,
        shippedToday: 2,
        notificationsQueued: 7,
        ...data,
      },
      error: null,
    }),
  };
}

describe("DashboardPanel", () => {
  it("renders heading", () => {
    const { container } = render(
      <DashboardPanel
        dashboardService={createMockDashboardService()}
        onQuickAction={() => {}}
      />,
    );

    expect(container.querySelector("h2").textContent).toBe("Dashboard");
  });

  it("loads and displays activity data on mount", async () => {
    const service = createMockDashboardService();

    const { container } = render(
      <DashboardPanel dashboardService={service} onQuickAction={() => {}} />,
    );

    await waitFor(() => {
      const strongs = container.querySelectorAll(".dashboard-card strong");
      const values = Array.from(strongs).map((el) => el.textContent);
      expect(values).toContain("5");
      expect(values).toContain("3");
      expect(values).toContain("2");
      expect(values).toContain("7");
    });

    expect(service.getTodayActivity).toHaveBeenCalled();
  });

  it("renders default zeros when service is null", () => {
    const { container } = render(
      <DashboardPanel dashboardService={null} onQuickAction={() => {}} />,
    );

    const strongs = container.querySelectorAll(".dashboard-card strong");
    const values = Array.from(strongs).map((el) => el.textContent);
    expect(values.every((v) => v === "0")).toBe(true);
    expect(values.length).toBe(4);
  });

  it("fires onQuickAction with correct section for each button", async () => {
    const user = userEvent.setup();
    const onQuickAction = vi.fn();

    const { container } = render(
      <DashboardPanel
        dashboardService={createMockDashboardService()}
        onQuickAction={onQuickAction}
      />,
    );

    const buttons = container.querySelectorAll(".dashboard-actions button");
    expect(buttons.length).toBe(3);

    await user.click(buttons[0]); // fulfillment
    expect(onQuickAction).toHaveBeenCalledWith("fulfillment");

    await user.click(buttons[1]); // admin
    expect(onQuickAction).toHaveBeenCalledWith("admin");

    await user.click(buttons[2]); // bulk
    expect(onQuickAction).toHaveBeenCalledWith("bulk");
  });

  it("handles service error gracefully", async () => {
    const service = {
      getTodayActivity: vi.fn().mockResolvedValue({
        status: 500,
        data: null,
        error: { message: "Service unavailable" },
      }),
    };

    const { container } = render(
      <DashboardPanel dashboardService={service} onQuickAction={() => {}} />,
    );

    await waitFor(() => {
      expect(service.getTodayActivity).toHaveBeenCalled();
    });

    const strongs = container.querySelectorAll(".dashboard-card strong");
    const values = Array.from(strongs).map((el) => el.textContent);
    expect(values.every((v) => v === "0")).toBe(true);
  });
});
