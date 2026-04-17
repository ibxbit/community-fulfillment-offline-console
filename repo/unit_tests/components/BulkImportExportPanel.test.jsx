import { describe, expect, it, vi, afterEach } from "vitest";
import "./componentTestSetup";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BulkImportExportPanel } from "../../src/modules/admin/BulkImportExportPanel";

afterEach(cleanup);

function createMockBulkService() {
  return {
    getSupportedCollections: vi
      .fn()
      .mockReturnValue(["users", "requests", "shipments", "inventory"]),
    generateTemplate: vi
      .fn()
      .mockReturnValue({ status: 200, data: { generated: true }, error: null }),
    exportData: vi.fn().mockResolvedValue({
      status: 200,
      data: { exportedRows: 42 },
      error: null,
    }),
    importData: vi.fn().mockResolvedValue({
      status: 200,
      data: { importedRows: 10 },
      error: null,
    }),
  };
}

describe("BulkImportExportPanel", () => {
  it("renders heading", () => {
    render(<BulkImportExportPanel service={createMockBulkService()} />);
    expect(screen.getByText("Bulk Import / Export")).toBeTruthy();
  });

  it("displays supported collections in dropdown", () => {
    render(<BulkImportExportPanel service={createMockBulkService()} />);

    const options = screen.getAllByRole("option");
    const collectionNames = options.map((o) => o.textContent);
    expect(collectionNames).toContain("users");
    expect(collectionNames).toContain("requests");
    expect(collectionNames).toContain("shipments");
  });

  it("generates a template on button click", async () => {
    const user = userEvent.setup();
    const service = createMockBulkService();

    render(<BulkImportExportPanel service={service} />);

    await user.click(screen.getByText("Download template"));

    expect(service.generateTemplate).toHaveBeenCalledWith({
      collection: "shipments",
      format: "csv",
    });
    expect(screen.getByText("Template generated")).toBeTruthy();
  });

  it("exports data on button click", async () => {
    const user = userEvent.setup();
    const service = createMockBulkService();

    render(<BulkImportExportPanel service={service} />);

    await user.click(screen.getByText("Export data"));

    await waitFor(() => {
      expect(service.exportData).toHaveBeenCalledWith({
        collection: "shipments",
        format: "csv",
      });
      expect(screen.getByText("Exported 42 rows")).toBeTruthy();
    });
  });

  it("displays error message on export failure", async () => {
    const user = userEvent.setup();
    const service = createMockBulkService();
    service.exportData.mockResolvedValue({
      status: 400,
      data: null,
      error: { message: "Unsupported collection" },
    });

    render(<BulkImportExportPanel service={service} />);
    await user.click(screen.getByText("Export data"));

    await waitFor(() => {
      expect(screen.getByText("Unsupported collection")).toBeTruthy();
    });
  });

  it("has a file input for imports", () => {
    const { container } = render(
      <BulkImportExportPanel service={createMockBulkService()} />,
    );

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();
    expect(fileInput.accept).toBe(".csv");
  });

  it("file input accept changes with format", async () => {
    const user = userEvent.setup();
    const service = createMockBulkService();
    const { container } = render(
      <BulkImportExportPanel service={service} />,
    );

    // Switch format to JSON
    const formatSelect = container.querySelectorAll("select")[1];
    await user.selectOptions(formatSelect, "json");

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput.accept).toBe(".json");
  });

  it("renders validation rules list", () => {
    render(<BulkImportExportPanel service={createMockBulkService()} />);

    expect(screen.getByText("Maximum 5,000 rows per file")).toBeTruthy();
    expect(screen.getByText("Required columns validated")).toBeTruthy();
  });

  it("renders safely with null service", () => {
    render(<BulkImportExportPanel service={null} />);
    expect(screen.getByText("Bulk Import / Export")).toBeTruthy();
  });
});
