import { useEffect, useState } from "react";

export function AdminConfigPanel({ service }) {
  const [areas, setAreas] = useState([]);
  const [bindings, setBindings] = useState([]);
  const [commissionPreview, setCommissionPreview] = useState(null);
  const [message, setMessage] = useState("");

  const [areaForm, setAreaForm] = useState({
    name: "",
    priority: 100,
    locations: "",
  });
  const [leaderForm, setLeaderForm] = useState({
    leaderId: "",
    leaderName: "",
    locationId: "",
    weight: 1,
  });
  const [commissionPercent, setCommissionPercent] = useState("3.5");
  const [orderValue, setOrderValue] = useState("100");
  const [settlement, setSettlement] = useState({
    frequency: "weekly",
    dayOfWeek: "Friday",
    time: "18:00",
  });
  const [attribution, setAttribution] = useState({
    overlapStrategy: "highest_priority",
    multiLeaderStrategy: "weighted_split",
  });

  async function refresh() {
    if (!service) {
      return;
    }

    const [
      areasResult,
      bindingsResult,
      commissionResult,
      settlementResult,
      attributionResult,
    ] = await Promise.all([
      service.listServiceAreas(),
      service.listLeaderBindings(),
      service.getCommissionRule(),
      service.getSettlementCycle(),
      service.getAttributionRules(),
    ]);

    setAreas(areasResult.data ?? []);
    setBindings(bindingsResult.data ?? []);
    setCommissionPercent(String(commissionResult.data?.percentage ?? 3.5));
    setSettlement({
      frequency: settlementResult.data?.frequency ?? "weekly",
      dayOfWeek: settlementResult.data?.dayOfWeek ?? "Friday",
      time: settlementResult.data?.time ?? "18:00",
    });
    setAttribution({
      overlapStrategy:
        attributionResult.data?.overlapStrategy ?? "highest_priority",
      multiLeaderStrategy:
        attributionResult.data?.multiLeaderStrategy ?? "weighted_split",
    });
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service]);

  async function saveServiceArea() {
    const payload = {
      name: areaForm.name,
      priority: Number(areaForm.priority),
      locations: areaForm.locations
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    };

    const result = await service.upsertServiceArea(payload);
    setMessage(result.error ? result.error.message : "Service area saved");
    if (!result.error) {
      setAreaForm({ name: "", priority: 100, locations: "" });
      await refresh();
    }
  }

  async function saveLeaderBinding() {
    const result = await service.bindGroupLeaderToLocation({
      leaderId: leaderForm.leaderId,
      leaderName: leaderForm.leaderName,
      locationId: leaderForm.locationId,
      weight: Number(leaderForm.weight),
    });

    setMessage(
      result.error ? result.error.message : "Group leader binding saved",
    );
    if (!result.error) {
      setLeaderForm({
        leaderId: "",
        leaderName: "",
        locationId: "",
        weight: 1,
      });
      await refresh();
    }
  }

  async function saveCommission() {
    const result = await service.setCommissionRule({
      percentage: Number(commissionPercent),
    });
    setMessage(result.error ? result.error.message : "Commission rule saved");
  }

  async function previewCommission() {
    const result = await service.calculateCommission(Number(orderValue));
    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    setCommissionPreview(result.data);
  }

  async function saveSettlement() {
    const result = await service.setSettlementCycle(settlement);
    setMessage(result.error ? result.error.message : "Settlement cycle saved");
  }

  async function saveAttribution() {
    const result = await service.setAttributionRules(attribution);
    setMessage(result.error ? result.error.message : "Attribution rules saved");
  }

  return (
    <section className="panel">
      <h2>Admin Configuration</h2>

      {message ? <p>{message}</p> : null}

      <div className="admin-grid">
        <div>
          <h3>Service Areas</h3>
          <input
            placeholder="Area name"
            value={areaForm.name}
            onChange={(event) =>
              setAreaForm((prev) => ({ ...prev, name: event.target.value }))
            }
          />
          <input
            type="number"
            placeholder="Priority"
            value={areaForm.priority}
            onChange={(event) =>
              setAreaForm((prev) => ({ ...prev, priority: event.target.value }))
            }
          />
          <input
            placeholder="Locations (comma separated)"
            value={areaForm.locations}
            onChange={(event) =>
              setAreaForm((prev) => ({
                ...prev,
                locations: event.target.value,
              }))
            }
          />
          <button type="button" onClick={saveServiceArea}>
            Save service area
          </button>

          <ul>
            {areas.map((area) => (
              <li key={area._id}>
                {area.name} | priority {area.priority} | locations:{" "}
                {(area.locations ?? []).join(", ")}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3>Group Leader Bindings</h3>
          <input
            placeholder="Leader ID"
            value={leaderForm.leaderId}
            onChange={(event) =>
              setLeaderForm((prev) => ({
                ...prev,
                leaderId: event.target.value,
              }))
            }
          />
          <input
            placeholder="Leader name"
            value={leaderForm.leaderName}
            onChange={(event) =>
              setLeaderForm((prev) => ({
                ...prev,
                leaderName: event.target.value,
              }))
            }
          />
          <input
            placeholder="Location ID"
            value={leaderForm.locationId}
            onChange={(event) =>
              setLeaderForm((prev) => ({
                ...prev,
                locationId: event.target.value,
              }))
            }
          />
          <input
            type="number"
            min="0"
            step="0.1"
            placeholder="Weight"
            value={leaderForm.weight}
            onChange={(event) =>
              setLeaderForm((prev) => ({ ...prev, weight: event.target.value }))
            }
          />
          <button type="button" onClick={saveLeaderBinding}>
            Save binding
          </button>

          <ul>
            {bindings.map((binding) => (
              <li key={binding._id}>
                {binding.leaderName} ({binding.leaderId}) {"->"}{" "}
                {binding.locationId} | weight {binding.weight}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3>Commission Rule</h3>
          <input
            type="number"
            step="0.01"
            value={commissionPercent}
            onChange={(event) => setCommissionPercent(event.target.value)}
          />
          <button type="button" onClick={saveCommission}>
            Save commission %
          </button>

          <input
            type="number"
            step="0.01"
            value={orderValue}
            onChange={(event) => setOrderValue(event.target.value)}
          />
          <button type="button" onClick={previewCommission}>
            Preview commission
          </button>
          {commissionPreview ? (
            <p>
              {commissionPreview.percentage}% of {commissionPreview.orderValue}{" "}
              = {commissionPreview.commissionValue}
            </p>
          ) : null}
        </div>

        <div>
          <h3>Settlement Cycle</h3>
          <select
            value={settlement.frequency}
            onChange={(event) =>
              setSettlement((prev) => ({
                ...prev,
                frequency: event.target.value,
              }))
            }
          >
            <option value="daily">daily</option>
            <option value="weekly">weekly</option>
            <option value="monthly">monthly</option>
          </select>
          <select
            value={settlement.dayOfWeek}
            onChange={(event) =>
              setSettlement((prev) => ({
                ...prev,
                dayOfWeek: event.target.value,
              }))
            }
          >
            <option>Monday</option>
            <option>Tuesday</option>
            <option>Wednesday</option>
            <option>Thursday</option>
            <option>Friday</option>
            <option>Saturday</option>
            <option>Sunday</option>
          </select>
          <input
            type="time"
            value={settlement.time}
            onChange={(event) =>
              setSettlement((prev) => ({ ...prev, time: event.target.value }))
            }
          />
          <button type="button" onClick={saveSettlement}>
            Save cycle
          </button>
        </div>

        <div>
          <h3>Attribution Rules</h3>
          <select
            value={attribution.overlapStrategy}
            onChange={(event) =>
              setAttribution((prev) => ({
                ...prev,
                overlapStrategy: event.target.value,
              }))
            }
          >
            <option value="highest_priority">highest_priority</option>
            <option value="first_match">first_match</option>
            <option value="split_evenly">split_evenly</option>
          </select>
          <select
            value={attribution.multiLeaderStrategy}
            onChange={(event) =>
              setAttribution((prev) => ({
                ...prev,
                multiLeaderStrategy: event.target.value,
              }))
            }
          >
            <option value="single_primary">single_primary</option>
            <option value="weighted_split">weighted_split</option>
            <option value="equal_split">equal_split</option>
          </select>
          <button type="button" onClick={saveAttribution}>
            Save attribution rules
          </button>
        </div>
      </div>
    </section>
  );
}
