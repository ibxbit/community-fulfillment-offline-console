import { ok } from "./response";
import { ROLES } from "../auth/roles";

export function createIntegrationValidationService({ services, plugins }) {
  return {
    async runAll() {
      const report = {
        workflows: { ok: false, details: "not run" },
        rbac: { ok: false, details: "not run" },
        audit: { ok: false, details: "not run" },
        plugins: { ok: false, details: "not run" },
      };

      try {
        const actor = { userId: "validation_user", role: ROLES.STUDENT };
        const createResult = await services.requestService.create({
          actor,
          payload: {
            requestingOrgId: "org_validation",
            requestingClassId: "class_validation",
            itemSku: "SKU-VALIDATION-001",
            quantity: 1,
            deliveryWindow: "2026-04-30",
          },
        });

        if (createResult.error) {
          report.workflows = { ok: false, details: createResult.error.message };
        } else {
          const requestId = createResult.data._id;
          const updateResult = await services.requestService.update({
            actor,
            requestId,
            patch: { quantity: 2 },
          });

          report.workflows = {
            ok: !updateResult.error,
            details: updateResult.error
              ? updateResult.error.message
              : "create/update flow passed",
          };
        }
      } catch (error) {
        report.workflows = {
          ok: false,
          details: String(error.message ?? error),
        };
      }

      try {
        const denied = await services.requestService.create({
          actor: { userId: "validation_finance", role: ROLES.FINANCE },
          payload: {
            requestingOrgId: "org_validation",
            requestingClassId: "class_validation",
            itemSku: "SKU-VALIDATION-002",
            quantity: 1,
          },
        });

        report.rbac = {
          ok: Boolean(denied.error && denied.status === 403),
          details: denied.error ? denied.error.message : "expected RBAC denial",
        };
      } catch (error) {
        report.rbac = { ok: false, details: String(error.message ?? error) };
      }

      try {
        const auditCheck = await services.auditTrail.verifyChain();
        report.audit = {
          ok: auditCheck.valid,
          details: auditCheck.valid
            ? `chain valid (${auditCheck.total} records)`
            : `chain invalid (${auditCheck.issues.length} issues)`,
        };
      } catch (error) {
        report.audit = { ok: false, details: String(error.message ?? error) };
      }

      try {
        const pluginList = plugins.list();
        if (pluginList.length === 0) {
          report.plugins = { ok: false, details: "no plugins loaded" };
        } else {
          const first = pluginList[0];
          const runResult = await plugins.runPlugin(first.id, {
            source: { sample: "data" },
            target: null,
          });

          report.plugins = {
            ok: runResult.ok,
            details: runResult.ok
              ? `plugin '${first.id}' executed`
              : runResult.error.message,
          };
        }
      } catch (error) {
        report.plugins = { ok: false, details: String(error.message ?? error) };
      }

      const allOk = Object.values(report).every((item) => item.ok);
      return ok({ allOk, report });
    },
  };
}
