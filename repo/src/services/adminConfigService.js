import { fail, ok } from "./response";

const ATTRIBUTION_RULES_KEY = "attribution_rules";
const COMMISSION_RULE_KEY = "active_commission_rule";
const SETTLEMENT_CYCLE_KEY = "active_settlement_cycle";

function now() {
  return new Date().toISOString();
}

function toCents(value) {
  return Math.round(Number(value ?? 0) * 100);
}

function fromCents(value) {
  return Number((Number(value ?? 0) / 100).toFixed(2));
}

function normalizePercent(value) {
  return Number(Number(value ?? 0).toFixed(4));
}

export function createAdminConfigService({
  serviceAreas,
  groupLeaders,
  commissions,
  settlements,
}) {
  async function getAttributionRules() {
    const config = await serviceAreas.findOne({ _id: ATTRIBUTION_RULES_KEY });
    return (
      config ?? {
        _id: ATTRIBUTION_RULES_KEY,
        overlapStrategy: "highest_priority",
        multiLeaderStrategy: "weighted_split",
      }
    );
  }

  return {
    async listServiceAreas() {
      const items = await serviceAreas.find(
        { kind: "service_area" },
        { sort: { name: 1 } },
      );
      return ok(items);
    },

    async upsertServiceArea(payload) {
      const name = String(payload?.name ?? "").trim();
      if (!name) {
        return fail("Service area name is required", 400);
      }

      const next = {
        _id: payload._id,
        kind: "service_area",
        name,
        priority: Number(payload?.priority ?? 100),
        locations: Array.isArray(payload?.locations) ? payload.locations : [],
        updatedAt: now(),
      };

      const saved = payload?._id
        ? await serviceAreas.updateOne({ _id: payload._id }, next)
        : await serviceAreas.insertOne(next);

      return ok(saved, payload?._id ? 200 : 201);
    },

    async bindGroupLeaderToLocation(payload) {
      const leaderId = String(payload?.leaderId ?? "").trim();
      const leaderName = String(payload?.leaderName ?? "").trim();
      const locationId = String(payload?.locationId ?? "").trim();

      if (!leaderId || !leaderName || !locationId) {
        return fail("leaderId, leaderName, and locationId are required", 400);
      }

      const binding = {
        leaderId,
        leaderName,
        locationId,
        weight: Number(payload?.weight ?? 1),
        updatedAt: now(),
      };

      const existing = await groupLeaders.findOne({ leaderId, locationId });
      const saved = existing
        ? await groupLeaders.updateOne(
            { _id: existing._id },
            { ...existing, ...binding },
          )
        : await groupLeaders.insertOne(binding);

      return ok(saved, existing ? 200 : 201);
    },

    async listLeaderBindings() {
      const items = await groupLeaders.find({}, { sort: { leaderName: 1 } });
      return ok(items);
    },

    async setCommissionRule(payload) {
      const percentage = normalizePercent(payload?.percentage);
      if (!Number.isFinite(percentage) || percentage < 0) {
        return fail("Invalid commission percentage", 400);
      }

      const rule = {
        _id: COMMISSION_RULE_KEY,
        percentage,
        rounding: "nearest_cent",
        updatedAt: now(),
      };

      const existing = await commissions.findOne({ _id: COMMISSION_RULE_KEY });
      const saved = existing
        ? await commissions.updateOne({ _id: COMMISSION_RULE_KEY }, rule)
        : await commissions.insertOne(rule);

      return ok(saved, existing ? 200 : 201);
    },

    async getCommissionRule() {
      const rule = await commissions.findOne({ _id: COMMISSION_RULE_KEY });
      return ok(
        rule ?? {
          _id: COMMISSION_RULE_KEY,
          percentage: 3.5,
          rounding: "nearest_cent",
        },
      );
    },

    async calculateCommission(orderValue) {
      const ruleResult = await this.getCommissionRule();
      const percentage = Number(ruleResult.data.percentage ?? 0);
      const orderValueCents = toCents(orderValue);
      const rawCommissionCents = (orderValueCents * percentage) / 100;
      const rounded = Math.round(rawCommissionCents);

      return ok({
        orderValue: fromCents(orderValueCents),
        percentage,
        commissionValue: fromCents(rounded),
      });
    },

    async setSettlementCycle(payload) {
      const frequency = String(payload?.frequency ?? "weekly").trim();
      const dayOfWeek = String(payload?.dayOfWeek ?? "Friday").trim();
      const time = String(payload?.time ?? "18:00").trim();

      const cycle = {
        _id: SETTLEMENT_CYCLE_KEY,
        frequency,
        dayOfWeek,
        time,
        updatedAt: now(),
      };

      const existing = await settlements.findOne({ _id: SETTLEMENT_CYCLE_KEY });
      const saved = existing
        ? await settlements.updateOne({ _id: SETTLEMENT_CYCLE_KEY }, cycle)
        : await settlements.insertOne(cycle);

      return ok(saved, existing ? 200 : 201);
    },

    async getSettlementCycle() {
      const cycle = await settlements.findOne({ _id: SETTLEMENT_CYCLE_KEY });
      return ok(
        cycle ?? {
          _id: SETTLEMENT_CYCLE_KEY,
          frequency: "weekly",
          dayOfWeek: "Friday",
          time: "18:00",
        },
      );
    },

    async setAttributionRules(payload) {
      const overlapStrategy = String(
        payload?.overlapStrategy ?? "highest_priority",
      ).trim();
      const multiLeaderStrategy = String(
        payload?.multiLeaderStrategy ?? "weighted_split",
      ).trim();

      const rules = {
        _id: ATTRIBUTION_RULES_KEY,
        kind: "system_config",
        overlapStrategy,
        multiLeaderStrategy,
        updatedAt: now(),
      };

      const existing = await serviceAreas.findOne({
        _id: ATTRIBUTION_RULES_KEY,
      });
      const saved = existing
        ? await serviceAreas.updateOne({ _id: ATTRIBUTION_RULES_KEY }, rules)
        : await serviceAreas.insertOne(rules);

      return ok(saved, existing ? 200 : 201);
    },

    async getAttributionRules() {
      return ok(await getAttributionRules());
    },

    async resolveAttribution({ locationId }) {
      const rules = await getAttributionRules();
      const areas = await serviceAreas.find({ kind: "service_area" });
      const matching = areas
        .filter((area) => (area.locations ?? []).includes(locationId))
        .sort((a, b) => Number(a.priority ?? 100) - Number(b.priority ?? 100));

      if (matching.length === 0) {
        return ok({ area: null, attributions: [] });
      }

      const selectedAreas =
        rules.overlapStrategy === "split_evenly"
          ? matching
          : rules.overlapStrategy === "first_match"
            ? [matching[0]]
            : [matching[0]];

      const bindings = await groupLeaders.find({ locationId });
      const leaders = bindings;

      if (leaders.length === 0) {
        return ok({ area: selectedAreas, attributions: [] });
      }

      if (rules.multiLeaderStrategy === "single_primary") {
        return ok({
          area: selectedAreas,
          attributions: [
            {
              leaderId: leaders[0].leaderId,
              leaderName: leaders[0].leaderName,
              ratio: 1,
            },
          ],
        });
      }

      if (rules.multiLeaderStrategy === "equal_split") {
        const ratio = Number((1 / leaders.length).toFixed(6));
        return ok({
          area: selectedAreas,
          attributions: leaders.map((leader) => ({
            leaderId: leader.leaderId,
            leaderName: leader.leaderName,
            ratio,
          })),
        });
      }

      const totalWeight = leaders.reduce(
        (sum, leader) => sum + Number(leader.weight ?? 1),
        0,
      );
      return ok({
        area: selectedAreas,
        attributions: leaders.map((leader) => ({
          leaderId: leader.leaderId,
          leaderName: leader.leaderName,
          ratio:
            totalWeight > 0
              ? Number((Number(leader.weight ?? 1) / totalWeight).toFixed(6))
              : 0,
        })),
      });
    },
  };
}
