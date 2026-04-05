import { useEffect, useState } from "react";
import { REQUEST_STATUS } from "../../services/requestLifecycleService";

export function ReviewerPanel({ requestService, reviewerTools, actor }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [commentById, setCommentById] = useState({});
  const [exceptionById, setExceptionById] = useState({});
  const [error, setError] = useState("");

  async function loadReviewQueue() {
    if (!requestService) {
      return;
    }

    setLoading(true);
    const result = await requestService.list({
      filter: {},
      options: { sort: { updatedAt: "desc" } },
    });

    if (result.error) {
      setError(result.error.message);
      setRequests([]);
    } else {
      const queue = result.data.filter(
        (item) =>
          item.status === REQUEST_STATUS.REVIEW ||
          item.status === REQUEST_STATUS.REQUIRES_SECONDARY_REVIEW,
      );
      setRequests(queue);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadReviewQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestService]);

  async function withAction(requestId, action) {
    setBusyId(requestId);
    setError("");
    const result = await action();
    if (result.error) {
      setError(result.error.message);
    }
    await loadReviewQueue();
    setBusyId(null);
  }

  return (
    <section className="panel" id="reviewer-panel">
      <h2>Reviewer Actions</h2>
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p>Loading review queue...</p> : null}
      {!loading && requests.length === 0 ? (
        <p>No requests pending review.</p>
      ) : null}

      <ul>
        {requests.map((request) => {
          const comment = commentById[request._id] ?? "";
          const exceptionReason = exceptionById[request._id] ?? "";
          const busy = busyId === request._id;

          return (
            <li key={request._id}>
              {request.itemSku} | qty {request.quantity} | status{" "}
              {request.status}
              <input
                placeholder="Review comment"
                value={comment}
                onChange={(event) =>
                  setCommentById((current) => ({
                    ...current,
                    [request._id]: event.target.value,
                  }))
                }
                disabled={busy}
              />
              <input
                placeholder="Exception reason"
                value={exceptionReason}
                onChange={(event) =>
                  setExceptionById((current) => ({
                    ...current,
                    [request._id]: event.target.value,
                  }))
                }
                disabled={busy}
              />
              <div className="section-actions">
                <button
                  type="button"
                  onClick={() =>
                    withAction(request._id, () =>
                      reviewerTools.approve(actor, request._id, comment),
                    )
                  }
                  disabled={busy}
                >
                  {busy ? "Working..." : "Approve"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    withAction(request._id, () =>
                      reviewerTools.returnWithComments(
                        actor,
                        request._id,
                        comment,
                      ),
                    )
                  }
                  disabled={busy}
                >
                  Return
                </button>
                <button
                  type="button"
                  onClick={() =>
                    withAction(request._id, () =>
                      reviewerTools.addComment(actor, request._id, comment),
                    )
                  }
                  disabled={busy}
                >
                  Add Comment
                </button>
                <button
                  type="button"
                  onClick={() =>
                    withAction(request._id, () =>
                      reviewerTools.attachExceptionReason(
                        actor,
                        request._id,
                        exceptionReason,
                      ),
                    )
                  }
                  disabled={busy}
                >
                  Add Exception
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
