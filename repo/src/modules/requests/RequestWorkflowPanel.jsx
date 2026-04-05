import { useEffect, useState } from "react";

const EMPTY_DRAFT = {
  requestingOrgId: "",
  requestingClassId: "",
  itemSku: "",
  quantity: 1,
  deliveryWindow: "",
};

export function RequestWorkflowPanel({ requestService, actor }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadRequests() {
    if (!requestService) {
      return;
    }

    setLoading(true);
    const result = await requestService.list({
      filter: actor?.userId ? { ownerUserId: actor.userId } : {},
      options: { sort: { updatedAt: "desc" } },
    });

    if (result.error) {
      setError(result.error.message);
      setRequests([]);
    } else {
      setRequests(result.data);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestService, actor?.userId]);

  async function createDraft() {
    setSaving(true);
    setError("");
    setMessage("");

    const result = await requestService.create({ actor, payload: draft });
    if (result.error) {
      setError(result.error.message);
    } else {
      setMessage("Draft created");
      setDraft(EMPTY_DRAFT);
      await loadRequests();
    }

    setSaving(false);
  }

  async function submitRequest(requestId) {
    setSaving(true);
    setError("");

    const result = await requestService.submit({ actor, requestId });
    if (result.error) {
      setError(result.error.message);
    } else {
      setMessage("Submitted for review");
      await loadRequests();
    }

    setSaving(false);
  }

  async function archiveRequest(requestId) {
    setSaving(true);
    setError("");

    const result = await requestService.archive({ actor, requestId });
    if (result.error) {
      setError(result.error.message);
    } else {
      setMessage("Request archived");
      await loadRequests();
    }

    setSaving(false);
  }

  return (
    <section className="panel" id="request-workflow-panel">
      <h2>Request Workflow</h2>

      <div className="admin-grid">
        <div>
          <h3>Create Draft</h3>
          <input
            placeholder="Requesting Org"
            value={draft.requestingOrgId}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                requestingOrgId: event.target.value,
              }))
            }
            disabled={saving}
          />
          <input
            placeholder="Requesting Class"
            value={draft.requestingClassId}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                requestingClassId: event.target.value,
              }))
            }
            disabled={saving}
          />
          <input
            placeholder="Item SKU"
            value={draft.itemSku}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                itemSku: event.target.value,
              }))
            }
            disabled={saving}
          />
          <input
            type="number"
            min="1"
            placeholder="Quantity"
            value={draft.quantity}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                quantity: Number(event.target.value),
              }))
            }
            disabled={saving}
          />
          <input
            type="date"
            value={draft.deliveryWindow}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                deliveryWindow: event.target.value,
              }))
            }
            disabled={saving}
          />
          <button type="button" onClick={createDraft} disabled={saving}>
            {saving ? "Saving..." : "Create draft"}
          </button>
          {error ? <p className="error">{error}</p> : null}
          {message ? <p>{message}</p> : null}
        </div>

        <div>
          <h3>My Requests</h3>
          {loading ? <p>Loading requests...</p> : null}
          {!loading && requests.length === 0 ? <p>No requests yet.</p> : null}
          <ul>
            {requests.map((request) => (
              <li key={request._id}>
                {request.itemSku} | qty {request.quantity} | status{" "}
                {request.status}
                <div className="section-actions">
                  <button
                    type="button"
                    onClick={() => submitRequest(request._id)}
                    disabled={saving}
                  >
                    Submit
                  </button>
                  <button
                    type="button"
                    onClick={() => archiveRequest(request._id)}
                    disabled={saving}
                  >
                    Archive
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
