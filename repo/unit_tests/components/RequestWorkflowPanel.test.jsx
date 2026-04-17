import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import "./componentTestSetup";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RequestWorkflowPanel } from "../../src/modules/requests/RequestWorkflowPanel";

afterEach(cleanup);

function createMockRequestService(requests = []) {
  const svc = {
    list: vi.fn().mockResolvedValue({
      status: 200,
      data: [...requests],
      error: null,
    }),
    create: vi.fn().mockResolvedValue({
      status: 201,
      data: { _id: "new-req", itemSku: "SKU-NEW", quantity: 1, status: "draft" },
      error: null,
    }),
    submit: vi.fn().mockResolvedValue({
      status: 200,
      data: { _id: "req-1", status: "review" },
      error: null,
    }),
    archive: vi.fn().mockResolvedValue({
      status: 200,
      data: { _id: "req-1", status: "archive" },
      error: null,
    }),
  };
  return svc;
}

const ACTOR = { userId: "student_1", role: "Student" };

describe("RequestWorkflowPanel", () => {
  it("shows empty state when no requests and hides loading", async () => {
    render(
      <RequestWorkflowPanel
        requestService={createMockRequestService([])}
        actor={ACTOR}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("No requests yet.")).toBeTruthy();
    });
    // Loading should be gone
    expect(screen.queryByText("Loading requests...")).toBeNull();
  });

  it("shows loading state then resolves to content", async () => {
    const service = createMockRequestService();
    let resolveList;
    service.list.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );

    render(
      <RequestWorkflowPanel requestService={service} actor={ACTOR} />,
    );

    // Loading should be visible
    expect(screen.getByText("Loading requests...")).toBeTruthy();
    // Empty state should NOT show during loading
    expect(screen.queryByText("No requests yet.")).toBeNull();

    // Resolve with data
    resolveList({ data: [{ _id: "r1", itemSku: "SKU-X", quantity: 1, status: "draft" }], error: null });

    await waitFor(() => {
      expect(screen.queryByText("Loading requests...")).toBeNull();
      expect(screen.getByText(/SKU-X/)).toBeTruthy();
    });
  });

  it("displays each request with SKU, quantity, and status", async () => {
    const requests = [
      { _id: "req-1", itemSku: "SKU-A", quantity: 5, status: "draft" },
      { _id: "req-2", itemSku: "SKU-B", quantity: 10, status: "review" },
    ];

    const { container } = render(
      <RequestWorkflowPanel
        requestService={createMockRequestService(requests)}
        actor={ACTOR}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/SKU-A/)).toBeTruthy();
    });

    // Verify both items render with their details
    const listItems = container.querySelectorAll("li");
    expect(listItems.length).toBe(2);
    expect(listItems[0].textContent).toContain("SKU-A");
    expect(listItems[0].textContent).toContain("qty 5");
    expect(listItems[0].textContent).toContain("status draft");
    expect(listItems[1].textContent).toContain("SKU-B");
    expect(listItems[1].textContent).toContain("qty 10");
    expect(listItems[1].textContent).toContain("status review");

    // Each item should have Submit and Archive buttons
    const submitButtons = screen.getAllByText("Submit");
    const archiveButtons = screen.getAllByText("Archive");
    expect(submitButtons.length).toBe(2);
    expect(archiveButtons.length).toBe(2);
  });

  it("creates draft, shows success message, clears form, and refreshes list", async () => {
    const user = userEvent.setup();
    const service = createMockRequestService();

    // After create, the re-fetch should return the new item
    let createCalled = false;
    service.create.mockImplementation(async (args) => {
      createCalled = true;
      return {
        status: 201,
        data: { _id: "new-req", itemSku: args.payload.itemSku, quantity: args.payload.quantity, status: "draft" },
        error: null,
      };
    });
    // First list call returns empty, subsequent calls return the created request
    service.list
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValue({
        data: [{ _id: "new-req", itemSku: "SKU-TEST", quantity: 1, status: "draft" }],
        error: null,
      });

    render(
      <RequestWorkflowPanel requestService={service} actor={ACTOR} />,
    );

    await waitFor(() => expect(service.list).toHaveBeenCalled());

    // Fill the form
    const orgInput = screen.getByPlaceholderText("Requesting Org");
    const classInput = screen.getByPlaceholderText("Requesting Class");
    const skuInput = screen.getByPlaceholderText("Item SKU");

    await user.type(orgInput, "org-1");
    await user.type(classInput, "class-1");
    await user.type(skuInput, "SKU-TEST");

    await user.click(screen.getByText("Create draft"));

    // Verify success message
    await waitFor(() => {
      expect(screen.getByText("Draft created")).toBeTruthy();
    });

    // Verify form was cleared
    expect(orgInput.value).toBe("");
    expect(classInput.value).toBe("");
    expect(skuInput.value).toBe("");

    // Verify list was re-fetched and new request appears
    await waitFor(() => {
      expect(screen.getByText(/SKU-TEST/)).toBeTruthy();
    });

    // Verify service.list was called again after create
    expect(service.list.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("submits a request, shows success message, and refreshes list", async () => {
    const user = userEvent.setup();
    const service = createMockRequestService([
      { _id: "req-1", itemSku: "SKU-A", quantity: 1, status: "draft" },
    ]);
    // After submit, re-fetch shows updated status
    service.list
      .mockResolvedValueOnce({
        data: [{ _id: "req-1", itemSku: "SKU-A", quantity: 1, status: "draft" }],
        error: null,
      })
      .mockResolvedValue({
        data: [{ _id: "req-1", itemSku: "SKU-A", quantity: 1, status: "review" }],
        error: null,
      });

    render(
      <RequestWorkflowPanel requestService={service} actor={ACTOR} />,
    );

    await waitFor(() => expect(screen.getByText(/SKU-A/)).toBeTruthy());

    await user.click(screen.getByText("Submit"));

    // Verify service was called with correct args
    await waitFor(() => {
      expect(service.submit).toHaveBeenCalledWith({
        actor: ACTOR,
        requestId: "req-1",
      });
    });

    // Verify success message
    await waitFor(() => {
      expect(screen.getByText("Submitted for review")).toBeTruthy();
    });

    // Verify list refreshed and shows updated status
    await waitFor(() => {
      expect(screen.getByText(/status review/)).toBeTruthy();
    });
  });

  it("archives a request, shows success message, and refreshes list", async () => {
    const user = userEvent.setup();
    const service = createMockRequestService([
      { _id: "req-1", itemSku: "SKU-A", quantity: 1, status: "approved" },
    ]);
    service.list
      .mockResolvedValueOnce({
        data: [{ _id: "req-1", itemSku: "SKU-A", quantity: 1, status: "approved" }],
        error: null,
      })
      .mockResolvedValue({ data: [], error: null }); // archived = removed from list

    render(
      <RequestWorkflowPanel requestService={service} actor={ACTOR} />,
    );

    await waitFor(() => expect(screen.getByText(/SKU-A/)).toBeTruthy());

    await user.click(screen.getByText("Archive"));

    await waitFor(() => {
      expect(service.archive).toHaveBeenCalledWith({
        actor: ACTOR,
        requestId: "req-1",
      });
    });

    // Verify success message and list refresh
    await waitFor(() => {
      expect(screen.getByText("Request archived")).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByText("No requests yet.")).toBeTruthy();
    });
  });

  it("displays error message on create failure and does NOT clear form", async () => {
    const user = userEvent.setup();
    const service = createMockRequestService();
    service.create.mockResolvedValue({
      status: 400,
      data: null,
      error: { message: "Missing required fields" },
    });

    render(
      <RequestWorkflowPanel requestService={service} actor={ACTOR} />,
    );

    await waitFor(() => expect(service.list).toHaveBeenCalled());

    const skuInput = screen.getByPlaceholderText("Item SKU");
    await user.type(skuInput, "SKU-FAIL");
    await user.click(screen.getByText("Create draft"));

    await waitFor(() => {
      expect(screen.getByText("Missing required fields")).toBeTruthy();
    });

    // Form should NOT be cleared on failure
    expect(skuInput.value).toBe("SKU-FAIL");
  });

  it("disables form inputs and button while saving", async () => {
    const user = userEvent.setup();
    const service = createMockRequestService();
    let resolveCreate;
    service.create.mockImplementation(
      () => new Promise((resolve) => { resolveCreate = resolve; }),
    );

    render(
      <RequestWorkflowPanel requestService={service} actor={ACTOR} />,
    );

    await waitFor(() => expect(service.list).toHaveBeenCalled());

    await user.click(screen.getByText("Create draft"));

    // While saving, button text changes and inputs are disabled
    await waitFor(() => {
      expect(screen.getByText("Saving...")).toBeTruthy();
    });
    expect(screen.getByPlaceholderText("Requesting Org").disabled).toBe(true);
    expect(screen.getByPlaceholderText("Item SKU").disabled).toBe(true);

    // Resolve the create
    resolveCreate({ status: 201, data: { _id: "x", itemSku: "X", quantity: 1, status: "draft" }, error: null });

    await waitFor(() => {
      expect(screen.getByText("Create draft")).toBeTruthy();
    });
    expect(screen.getByPlaceholderText("Requesting Org").disabled).toBe(false);
  });
});
