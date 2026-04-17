import { describe, expect, it, vi, afterEach } from "vitest";
import "./componentTestSetup";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReviewerPanel } from "../../src/modules/requests/ReviewerPanel";

afterEach(cleanup);

function createMockServices(requests = []) {
  const requestService = {
    list: vi.fn().mockResolvedValue({
      status: 200,
      data: [...requests],
      error: null,
    }),
  };
  const reviewerTools = {
    approve: vi.fn().mockResolvedValue({ status: 200, data: {}, error: null }),
    returnWithComments: vi
      .fn()
      .mockResolvedValue({ status: 200, data: {}, error: null }),
    addComment: vi
      .fn()
      .mockResolvedValue({ status: 200, data: {}, error: null }),
    attachExceptionReason: vi
      .fn()
      .mockResolvedValue({ status: 200, data: {}, error: null }),
  };
  return { requestService, reviewerTools };
}

const ACTOR = { userId: "reviewer_1", role: "Reviewer" };

describe("ReviewerPanel", () => {
  it("shows loading then resolves to content", async () => {
    let resolveList;
    const { requestService, reviewerTools } = createMockServices();
    requestService.list.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );

    render(
      <ReviewerPanel
        requestService={requestService}
        reviewerTools={reviewerTools}
        actor={ACTOR}
      />,
    );

    expect(screen.getByText("Loading review queue...")).toBeTruthy();
    expect(screen.queryByText("No requests pending review.")).toBeNull();

    resolveList({
      data: [{ _id: "r1", itemSku: "SKU-X", quantity: 1, status: "review" }],
      error: null,
    });

    await waitFor(() => {
      expect(screen.queryByText("Loading review queue...")).toBeNull();
      expect(screen.getByText(/SKU-X/)).toBeTruthy();
    });
  });

  it("shows empty state when no requests pending review", async () => {
    const { requestService, reviewerTools } = createMockServices([
      { _id: "r1", itemSku: "SKU-A", quantity: 1, status: "draft" },
      { _id: "r2", itemSku: "SKU-B", quantity: 1, status: "approved" },
    ]);

    render(
      <ReviewerPanel
        requestService={requestService}
        reviewerTools={reviewerTools}
        actor={ACTOR}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("No requests pending review.")).toBeTruthy();
    });
    // Draft and approved items should not appear
    expect(screen.queryByText(/SKU-A/)).toBeNull();
    expect(screen.queryByText(/SKU-B/)).toBeNull();
  });

  it("filters to only review and requires-secondary-review statuses", async () => {
    const all = [
      { _id: "r1", itemSku: "SKU-REVIEW", quantity: 1, status: "review" },
      { _id: "r2", itemSku: "SKU-SECONDARY", quantity: 1, status: "requires secondary review" },
      { _id: "r3", itemSku: "SKU-DRAFT", quantity: 1, status: "draft" },
      { _id: "r4", itemSku: "SKU-APPROVED", quantity: 1, status: "approved" },
    ];
    const { requestService, reviewerTools } = createMockServices(all);

    const { container } = render(
      <ReviewerPanel
        requestService={requestService}
        reviewerTools={reviewerTools}
        actor={ACTOR}
      />,
    );

    await waitFor(() => expect(screen.getByText(/SKU-REVIEW/)).toBeTruthy());

    const listItems = container.querySelectorAll("li");
    expect(listItems.length).toBe(2);
    expect(listItems[0].textContent).toContain("SKU-REVIEW");
    expect(listItems[0].textContent).toContain("status review");
    expect(listItems[1].textContent).toContain("SKU-SECONDARY");
  });

  it("renders each item with comment input, exception input, and 4 action buttons", async () => {
    const { requestService, reviewerTools } = createMockServices([
      { _id: "r1", itemSku: "SKU-A", quantity: 2, status: "review" },
    ]);

    const { container } = render(
      <ReviewerPanel
        requestService={requestService}
        reviewerTools={reviewerTools}
        actor={ACTOR}
      />,
    );

    await waitFor(() => expect(screen.getByText(/SKU-A/)).toBeTruthy());

    expect(screen.getByPlaceholderText("Review comment")).toBeTruthy();
    expect(screen.getByPlaceholderText("Exception reason")).toBeTruthy();
    expect(screen.getByText("Approve")).toBeTruthy();
    expect(screen.getByText("Return")).toBeTruthy();
    expect(screen.getByText("Add Comment")).toBeTruthy();
    expect(screen.getByText("Add Exception")).toBeTruthy();
  });

  it("approve: calls service, refreshes queue, and removes item if no longer in review", async () => {
    const user = userEvent.setup();
    const { requestService, reviewerTools } = createMockServices([
      { _id: "r1", itemSku: "SKU-AP", quantity: 1, status: "review" },
    ]);
    // After approve, re-fetch returns empty (request moved to approved)
    requestService.list
      .mockResolvedValueOnce({
        data: [{ _id: "r1", itemSku: "SKU-AP", quantity: 1, status: "review" }],
        error: null,
      })
      .mockResolvedValue({ data: [], error: null });

    render(
      <ReviewerPanel
        requestService={requestService}
        reviewerTools={reviewerTools}
        actor={ACTOR}
      />,
    );

    await waitFor(() => expect(screen.getByText(/SKU-AP/)).toBeTruthy());

    await user.click(screen.getByText("Approve"));

    await waitFor(() => {
      expect(reviewerTools.approve).toHaveBeenCalledWith(ACTOR, "r1", "");
    });

    // Queue should refresh and show empty state
    await waitFor(() => {
      expect(screen.getByText("No requests pending review.")).toBeTruthy();
    });
    expect(screen.queryByText(/SKU-AP/)).toBeNull();
  });

  it("return: sends comment, calls service, and refreshes queue", async () => {
    const user = userEvent.setup();
    const { requestService, reviewerTools } = createMockServices([
      { _id: "r1", itemSku: "SKU-RT", quantity: 1, status: "review" },
    ]);
    requestService.list
      .mockResolvedValueOnce({
        data: [{ _id: "r1", itemSku: "SKU-RT", quantity: 1, status: "review" }],
        error: null,
      })
      .mockResolvedValue({ data: [], error: null });

    render(
      <ReviewerPanel
        requestService={requestService}
        reviewerTools={reviewerTools}
        actor={ACTOR}
      />,
    );

    await waitFor(() => expect(screen.getByText(/SKU-RT/)).toBeTruthy());

    await user.type(screen.getByPlaceholderText("Review comment"), "Needs fix");
    await user.click(screen.getByText("Return"));

    await waitFor(() => {
      expect(reviewerTools.returnWithComments).toHaveBeenCalledWith(
        ACTOR, "r1", "Needs fix",
      );
    });

    await waitFor(() => {
      expect(screen.getByText("No requests pending review.")).toBeTruthy();
    });
  });

  it("add comment: sends comment, calls service, and refreshes queue", async () => {
    const user = userEvent.setup();
    const { requestService, reviewerTools } = createMockServices([
      { _id: "r1", itemSku: "SKU-CM", quantity: 1, status: "review" },
    ]);

    render(
      <ReviewerPanel
        requestService={requestService}
        reviewerTools={reviewerTools}
        actor={ACTOR}
      />,
    );

    await waitFor(() => expect(screen.getByText(/SKU-CM/)).toBeTruthy());

    await user.type(screen.getByPlaceholderText("Review comment"), "Looks promising");
    await user.click(screen.getByText("Add Comment"));

    await waitFor(() => {
      expect(reviewerTools.addComment).toHaveBeenCalledWith(
        ACTOR, "r1", "Looks promising",
      );
    });

    // list should have been re-fetched
    expect(requestService.list.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("add exception: sends reason, calls service, and refreshes queue", async () => {
    const user = userEvent.setup();
    const { requestService, reviewerTools } = createMockServices([
      { _id: "r1", itemSku: "SKU-EX", quantity: 1, status: "review" },
    ]);

    render(
      <ReviewerPanel
        requestService={requestService}
        reviewerTools={reviewerTools}
        actor={ACTOR}
      />,
    );

    await waitFor(() => expect(screen.getByText(/SKU-EX/)).toBeTruthy());

    await user.type(screen.getByPlaceholderText("Exception reason"), "Budget exceeded");
    await user.click(screen.getByText("Add Exception"));

    await waitFor(() => {
      expect(reviewerTools.attachExceptionReason).toHaveBeenCalledWith(
        ACTOR, "r1", "Budget exceeded",
      );
    });

    expect(requestService.list.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("shows error message on service failure and keeps request in queue", async () => {
    const user = userEvent.setup();
    const { requestService, reviewerTools } = createMockServices([
      { _id: "r1", itemSku: "SKU-ERR", quantity: 1, status: "review" },
    ]);
    reviewerTools.approve.mockResolvedValue({
      status: 403,
      data: null,
      error: { message: "Only Reviewer or Admin can approve" },
    });

    render(
      <ReviewerPanel
        requestService={requestService}
        reviewerTools={reviewerTools}
        actor={ACTOR}
      />,
    );

    await waitFor(() => expect(screen.getByText(/SKU-ERR/)).toBeTruthy());
    await user.click(screen.getByText("Approve"));

    await waitFor(() => {
      expect(screen.getByText("Only Reviewer or Admin can approve")).toBeTruthy();
    });

    // The error message should have the error class
    const errorP = screen.getByText("Only Reviewer or Admin can approve");
    expect(errorP.className).toBe("error");

    // The request should still be in the queue
    expect(screen.getByText(/SKU-ERR/)).toBeTruthy();
  });

  it("shows Working... on button and disables inputs during action", async () => {
    const user = userEvent.setup();
    const { requestService, reviewerTools } = createMockServices([
      { _id: "r1", itemSku: "SKU-BSY", quantity: 1, status: "review" },
    ]);
    let resolveApprove;
    reviewerTools.approve.mockImplementation(
      () => new Promise((resolve) => { resolveApprove = resolve; }),
    );

    render(
      <ReviewerPanel
        requestService={requestService}
        reviewerTools={reviewerTools}
        actor={ACTOR}
      />,
    );

    await waitFor(() => expect(screen.getByText(/SKU-BSY/)).toBeTruthy());
    await user.click(screen.getByText("Approve"));

    // While busy
    expect(screen.getByText("Working...")).toBeTruthy();
    expect(screen.getByPlaceholderText("Review comment").disabled).toBe(true);
    expect(screen.getByPlaceholderText("Exception reason").disabled).toBe(true);

    resolveApprove({ status: 200, data: {}, error: null });

    await waitFor(() => {
      expect(screen.queryByText("Working...")).toBeNull();
    });
  });
});
