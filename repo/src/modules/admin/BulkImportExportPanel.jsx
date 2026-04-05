import { useMemo, useState } from "react";

export function BulkImportExportPanel({ service }) {
  const [collection, setCollection] = useState("shipments");
  const [format, setFormat] = useState("csv");
  const [message, setMessage] = useState("");
  const [rowErrors, setRowErrors] = useState([]);

  const supportedCollections = useMemo(
    () => service?.getSupportedCollections() ?? [],
    [service],
  );

  async function onGenerateTemplate() {
    const result = service.generateTemplate({ collection, format });
    setMessage(result.error ? result.error.message : "Template generated");
  }

  async function onExport() {
    const result = await service.exportData({ collection, format });
    setMessage(
      result.error
        ? result.error.message
        : `Exported ${result.data.exportedRows} rows`,
    );
  }

  async function onImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    const result = await service.importData({
      collection,
      format,
      content: text,
    });

    if (result.error) {
      setMessage(result.error.message);
      setRowErrors(result.error.details?.errors ?? []);
      return;
    }

    setRowErrors([]);
    setMessage(`Imported ${result.data.importedRows} rows`);
  }

  return (
    <section className="panel">
      <h2>Bulk Import / Export</h2>

      <div className="admin-grid">
        <div>
          <label>
            Collection
            <select
              value={collection}
              onChange={(event) => setCollection(event.target.value)}
            >
              {supportedCollections.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Format
            <select
              value={format}
              onChange={(event) => setFormat(event.target.value)}
            >
              <option value="csv">csv</option>
              <option value="json">json</option>
            </select>
          </label>

          <button type="button" onClick={onGenerateTemplate}>
            Download template
          </button>
          <button type="button" onClick={onExport}>
            Export data
          </button>

          <label>
            Import file
            <input
              type="file"
              accept={format === "csv" ? ".csv" : ".json"}
              onChange={onImportFile}
            />
          </label>

          <p>{message}</p>
        </div>

        <div>
          <h3>Import Validation Rules</h3>
          <ul>
            <li>Maximum 5,000 rows per file</li>
            <li>Required columns validated</li>
            <li>Data type checks enforced</li>
            <li>All-or-nothing transaction rollback on failure</li>
          </ul>

          {rowErrors.length > 0 ? (
            <>
              <h3>Row Errors</h3>
              <ul>
                {rowErrors.slice(0, 50).map((entry, index) => (
                  <li key={`${entry.row}_${index}`}>
                    Row {entry.row}: {entry.errors.join("; ")}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
