import { useEffect, useMemo, useState } from "react";
import { loadFilterPresets, saveFilterPresets } from "./filterPresets";
import { BarcodeScannerPanel } from "../barcode/BarcodeScannerPanel";

const FILTER_STATE_KEY = "cfso_fulfillment_last_filters";
const LAYOUT_STATE_KEY = "cfso_fulfillment_layout_state";

const DEFAULT_FILTERS = {
  itemSku: "",
  lot: "",
  warehouseLocation: "",
  documentStatus: "",
  requester: "",
  fromDate: "",
  toDate: "",
};

function loadSavedFilters() {
  try {
    const raw = localStorage.getItem(FILTER_STATE_KEY);
    if (!raw) {
      return DEFAULT_FILTERS;
    }

    return {
      ...DEFAULT_FILTERS,
      ...JSON.parse(raw),
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

function loadSavedLayout() {
  try {
    const raw = localStorage.getItem(LAYOUT_STATE_KEY);
    if (!raw) {
      return { showScanner: true, showFilters: true };
    }

    return {
      showScanner: true,
      showFilters: true,
      ...JSON.parse(raw),
    };
  } catch {
    return { showScanner: true, showFilters: true };
  }
}

export function FulfillmentManagementPanel({
  service,
  shipmentService,
  actor,
}) {
  const [filters, setFilters] = useState(() => loadSavedFilters());
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [presets, setPresets] = useState(() => loadFilterPresets());
  const [presetName, setPresetName] = useState("");
  const [layout, setLayout] = useState(() => loadSavedLayout());

  const [activeShipmentId, setActiveShipmentId] = useState(null);
  const [splitPackages, setSplitPackages] = useState("1");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [deliveryRecipient, setDeliveryRecipient] = useState("");
  const [exceptionType, setExceptionType] = useState("damaged");
  const [exceptionNotes, setExceptionNotes] = useState("");

  const pageCount = useMemo(
    () => Math.max(Math.ceil(total / pageSize), 1),
    [total, pageSize],
  );
  const activeShipment = useMemo(
    () => items.find((item) => item._id === activeShipmentId) ?? null,
    [items, activeShipmentId],
  );

  useEffect(() => {
    localStorage.setItem(FILTER_STATE_KEY, JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    localStorage.setItem(LAYOUT_STATE_KEY, JSON.stringify(layout));
  }, [layout]);

  async function runSearch(nextPage = page, nextFilters = filters) {
    if (!service) {
      return null;
    }

    setLoading(true);
    setError("");

    const result = await service.search(nextFilters, {
      page: nextPage,
      pageSize,
      sortBy,
      sortDir,
    });

    if (result.error) {
      setError(result.error.message);
      setItems([]);
      setTotal(0);
    } else {
      setItems(result.data.items);
      setTotal(result.data.total);
      setPage(result.data.page);
    }

    setLoading(false);
    return result;
  }

  useEffect(() => {
    runSearch(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortDir, pageSize]);

  function onFilterChange(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  async function onSearchSubmit(event) {
    event.preventDefault();
    await runSearch(1);
  }

  async function onBarcodeAccepted(code) {
    const nextFilters = {
      ...filters,
      itemSku: code,
    };

    setFilters(nextFilters);
    const result = await runSearch(1, nextFilters);
    if (result?.data?.items?.length > 0) {
      setActiveShipmentId(result.data.items[0]._id);
    }
  }

  function onSavePreset() {
    const name = presetName.trim();
    if (!name) {
      return;
    }

    const next = [
      ...presets.filter((preset) => preset.name !== name),
      { name, filters },
    ];

    setPresets(next);
    saveFilterPresets(next);
    setPresetName("");
  }

  async function withRefresh(action) {
    setError("");
    const result = await action();

    if (result.error) {
      setError(result.error.message);
      return;
    }

    await runSearch(page);
  }

  async function onSplitShipment() {
    const count = Math.max(Number(splitPackages), 1);
    const packages = Array.from({ length: count }).map((_, index) => ({
      packageId: `${activeShipmentId}_pkg_${index + 1}`,
      sequence: index + 1,
    }));

    await withRefresh(() =>
      service.splitShipment(activeShipmentId, packages, actor),
    );
  }

  async function onAssignCarrier() {
    await withRefresh(() => {
      if (!shipmentService) {
        return service.assignCarrier(
          activeShipmentId,
          carrier,
          trackingNumber,
          actor,
        );
      }

      return shipmentService.assignCarrier({
        actor,
        shipmentId: activeShipmentId,
        carrier,
        trackingNumber,
      });
    });
  }

  async function onConfirmDelivery() {
    await withRefresh(() =>
      service.confirmDelivery(
        activeShipmentId,
        {
          recipient: deliveryRecipient,
        },
        actor,
      ),
    );
  }

  async function onLogException() {
    await withRefresh(() =>
      service.logException(
        activeShipmentId,
        exceptionType,
        exceptionNotes,
        actor,
      ),
    );
  }

  return (
    <section className="panel">
      <h2>Fulfillment Management</h2>

      <div className="section-actions">
        <button
          type="button"
          onClick={() =>
            setLayout((current) => ({
              ...current,
              showScanner: !current.showScanner,
            }))
          }
        >
          {layout.showScanner ? "Hide" : "Show"} scanner
        </button>
        <button
          type="button"
          onClick={() =>
            setLayout((current) => ({
              ...current,
              showFilters: !current.showFilters,
            }))
          }
        >
          {layout.showFilters ? "Hide" : "Show"} filters
        </button>
      </div>

      {layout.showScanner ? (
        <BarcodeScannerPanel onCodeAccepted={onBarcodeAccepted} />
      ) : null}

      {layout.showFilters ? (
        <form className="fulfillment-filters" onSubmit={onSearchSubmit}>
          <input
            name="itemSku"
            placeholder="Item/SKU"
            value={filters.itemSku}
            onChange={onFilterChange}
          />
          <input
            name="lot"
            placeholder="Lot"
            value={filters.lot}
            onChange={onFilterChange}
          />
          <input
            name="warehouseLocation"
            placeholder="Warehouse location"
            value={filters.warehouseLocation}
            onChange={onFilterChange}
          />
          <input
            name="requester"
            placeholder="Requester"
            value={filters.requester}
            onChange={onFilterChange}
          />
          <select
            name="documentStatus"
            value={filters.documentStatus}
            onChange={onFilterChange}
          >
            <option value="">Any status</option>
            <option value="draft">draft</option>
            <option value="in_progress">in_progress</option>
            <option value="in_transit">in_transit</option>
            <option value="delivered">delivered</option>
            <option value="exception">exception</option>
          </select>
          <input
            type="date"
            name="fromDate"
            value={filters.fromDate}
            onChange={onFilterChange}
          />
          <input
            type="date"
            name="toDate"
            value={filters.toDate}
            onChange={onFilterChange}
          />
          <button type="submit" disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
        </form>
      ) : null}

      <div className="fulfillment-presets">
        <input
          placeholder="Preset name"
          value={presetName}
          onChange={(event) => setPresetName(event.target.value)}
        />
        <button type="button" onClick={onSavePreset}>
          Save preset
        </button>
        <select
          onChange={(event) => {
            const preset = presets.find(
              (entry) => entry.name === event.target.value,
            );
            if (preset) {
              setFilters(preset.filters);
            }
          }}
          defaultValue=""
        >
          <option value="" disabled>
            Load preset
          </option>
          {presets.map((preset) => (
            <option key={preset.name} value={preset.name}>
              {preset.name}
            </option>
          ))}
        </select>
      </div>

      <div className="fulfillment-toolbar">
        <label>
          Sort by
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
          >
            <option value="date">Date</option>
            <option value="itemSku">Item/SKU</option>
            <option value="requester">Requester</option>
            <option value="documentStatus">Status</option>
          </select>
        </label>
        <label>
          Direction
          <select
            value={sortDir}
            onChange={(event) => setSortDir(event.target.value)}
          >
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </label>
        <label>
          Page size
          <select
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </label>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="fulfillment-table-wrap">
        <table className="fulfillment-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>SKU</th>
              <th>Lot</th>
              <th>Location</th>
              <th>Status</th>
              <th>Requester</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item._id}>
                <td>{item.date ?? "-"}</td>
                <td>{item.itemSku ?? "-"}</td>
                <td>{item.lot ?? "-"}</td>
                <td>{item.warehouseLocation ?? "-"}</td>
                <td>{item.documentStatus ?? "-"}</td>
                <td>{item.requester ?? "-"}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => setActiveShipmentId(item._id)}
                  >
                    Quick actions
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={7}>No shipments found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="fulfillment-pagination">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => runSearch(page - 1)}
        >
          Prev
        </button>
        <span>
          Page {page} / {pageCount}
        </span>
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => runSearch(page + 1)}
        >
          Next
        </button>
      </div>

      {activeShipment ? (
        <aside className="drawer">
          <div className="drawer__header">
            <h3>
              Quick Actions: {activeShipment.itemSku ?? activeShipment._id}
            </h3>
            <button type="button" onClick={() => setActiveShipmentId(null)}>
              Close
            </button>
          </div>

          <div className="drawer__grid">
            <div>
              <h4>Split Shipment</h4>
              <input
                value={splitPackages}
                onChange={(event) => setSplitPackages(event.target.value)}
              />
              <button type="button" onClick={onSplitShipment}>
                Apply split
              </button>
            </div>

            <div>
              <h4>Carrier + Tracking</h4>
              <input
                placeholder="Carrier"
                value={carrier}
                onChange={(event) => setCarrier(event.target.value)}
              />
              <input
                placeholder="Tracking number"
                value={trackingNumber}
                onChange={(event) => setTrackingNumber(event.target.value)}
              />
              <button type="button" onClick={onAssignCarrier}>
                Assign
              </button>
            </div>

            <div>
              <h4>Delivery Confirmation</h4>
              <input
                placeholder="Recipient"
                value={deliveryRecipient}
                onChange={(event) => setDeliveryRecipient(event.target.value)}
              />
              <button type="button" onClick={onConfirmDelivery}>
                Confirm
              </button>
            </div>

            <div>
              <h4>Log Exception</h4>
              <select
                value={exceptionType}
                onChange={(event) => setExceptionType(event.target.value)}
              >
                <option value="damaged">damaged</option>
                <option value="recipient unavailable">
                  recipient unavailable
                </option>
              </select>
              <input
                placeholder="Notes"
                value={exceptionNotes}
                onChange={(event) => setExceptionNotes(event.target.value)}
              />
              <button type="button" onClick={onLogException}>
                Log exception
              </button>
            </div>
          </div>
        </aside>
      ) : null}
    </section>
  );
}
