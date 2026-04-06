import { createId } from "../utils/id";
import { maskSensitiveFields } from "../auth/masking";
import { getWebCrypto } from "../utils/webCrypto";

function now() {
  return new Date().toISOString();
}

function canonicalStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

async function sha256Hex(input) {
  const bytes = new TextEncoder().encode(input);
  const digest = await getWebCrypto().subtle.digest("SHA-256", bytes);
  const hashArray = Array.from(new Uint8Array(digest));
  return hashArray.map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function createTamperAuditLogService(repository) {
  return {
    async append(entry) {
      const previous = await repository.findOne({}, { sort: { sequence: -1 } });
      const sequence = Number(previous?.sequence ?? 0) + 1;
      const previousHash = previous?.hash ?? "GENESIS";

      const payload = {
        sequence,
        at: now(),
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        actorUserId: entry.actorUserId ?? null,
        actorRole: entry.actorRole ?? null,
        metadata: maskSensitiveFields(entry.metadata ?? {}),
        previousHash,
      };

      const hash = await sha256Hex(canonicalStringify(payload));

      const record = {
        _id: createId("audit"),
        ...payload,
        hash,
      };

      await repository.insertOne(record);
      return record;
    },

    async verifyChain() {
      const logs = await repository.find({}, { sort: { sequence: 1 } });
      const issues = [];

      for (let i = 0; i < logs.length; i += 1) {
        const log = logs[i];
        const expectedPreviousHash = i === 0 ? "GENESIS" : logs[i - 1].hash;

        if (log.previousHash !== expectedPreviousHash) {
          issues.push({
            sequence: log.sequence,
            reason: "previous hash mismatch",
          });
          continue;
        }

        const payload = {
          sequence: log.sequence,
          at: log.at,
          action: log.action,
          resourceType: log.resourceType,
          resourceId: log.resourceId,
          actorUserId: log.actorUserId ?? null,
          actorRole: log.actorRole ?? null,
          metadata: log.metadata ?? {},
          previousHash: log.previousHash,
        };

        const expectedHash = await sha256Hex(canonicalStringify(payload));
        if (expectedHash !== log.hash) {
          issues.push({ sequence: log.sequence, reason: "hash mismatch" });
        }
      }

      return {
        valid: issues.length === 0,
        total: logs.length,
        issues,
      };
    },
  };
}
