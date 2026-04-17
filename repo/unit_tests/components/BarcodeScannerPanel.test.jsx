import { describe, expect, it, vi, afterEach } from "vitest";
import "./componentTestSetup";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BarcodeScannerPanel } from "../../src/modules/barcode/BarcodeScannerPanel";

afterEach(cleanup);

describe("BarcodeScannerPanel", () => {
  it("renders heading and description", () => {
    render(<BarcodeScannerPanel onCodeAccepted={vi.fn()} />);

    expect(screen.getByText("Barcode Scanner")).toBeTruthy();
    expect(
      screen.getByText(
        "Scan to locate items and open quick actions, or type manually.",
      ),
    ).toBeTruthy();
  });

  it("renders check-digit algorithm selector", () => {
    const { container } = render(
      <BarcodeScannerPanel onCodeAccepted={vi.fn()} />,
    );

    const select = container.querySelector("select");
    expect(select).toBeTruthy();
    const options = Array.from(select.querySelectorAll("option")).map(
      (o) => o.value,
    );
    expect(options).toContain("none");
    expect(options).toContain("luhn");
    expect(options).toContain("mod11");
  });

  it("renders expected length input", () => {
    render(<BarcodeScannerPanel onCodeAccepted={vi.fn()} />);

    const lengthInput = screen.getByPlaceholderText("Optional");
    expect(lengthInput).toBeTruthy();
    expect(lengthInput.type).toBe("number");
  });

  it("renders camera scan and stop buttons", () => {
    render(<BarcodeScannerPanel onCodeAccepted={vi.fn()} />);

    expect(screen.getByText("Start camera scan")).toBeTruthy();
    expect(screen.getByText("Stop")).toBeTruthy();
  });

  it("stop button is disabled when not scanning", () => {
    render(<BarcodeScannerPanel onCodeAccepted={vi.fn()} />);

    const stopButton = screen.getByText("Stop");
    expect(stopButton.disabled).toBe(true);
  });

  it("start button is enabled when not scanning", () => {
    render(<BarcodeScannerPanel onCodeAccepted={vi.fn()} />);

    const startButton = screen.getByText("Start camera scan");
    expect(startButton.disabled).toBe(false);
  });

  it("renders manual entry input and button", () => {
    render(<BarcodeScannerPanel onCodeAccepted={vi.fn()} />);

    expect(screen.getByPlaceholderText("Manual barcode entry")).toBeTruthy();
    expect(screen.getByText("Use code")).toBeTruthy();
  });

  it("accepts a manual code with algorithm=none and calls onCodeAccepted", async () => {
    const user = userEvent.setup();
    const onCodeAccepted = vi.fn().mockResolvedValue(undefined);

    render(<BarcodeScannerPanel onCodeAccepted={onCodeAccepted} />);

    await user.type(
      screen.getByPlaceholderText("Manual barcode entry"),
      "SKU-12345",
    );
    await user.click(screen.getByText("Use code"));

    await waitFor(() => {
      expect(onCodeAccepted).toHaveBeenCalledWith("SKU-12345");
    });
  });

  it("displays message after manual code accepted", async () => {
    const user = userEvent.setup();
    const onCodeAccepted = vi.fn().mockResolvedValue(undefined);

    render(<BarcodeScannerPanel onCodeAccepted={onCodeAccepted} />);

    await user.type(
      screen.getByPlaceholderText("Manual barcode entry"),
      "TEST-CODE",
    );
    await user.click(screen.getByText("Use code"));

    await waitFor(() => {
      expect(screen.getByText(/Manual entry: TEST-CODE/)).toBeTruthy();
    });
  });

  it("shows validation error for empty manual code", async () => {
    const user = userEvent.setup();
    const onCodeAccepted = vi.fn();

    render(<BarcodeScannerPanel onCodeAccepted={onCodeAccepted} />);

    await user.click(screen.getByText("Use code"));

    await waitFor(() => {
      expect(screen.getByText(/empty/i)).toBeTruthy();
    });

    expect(onCodeAccepted).not.toHaveBeenCalled();
  });

  it("shows validation error when code fails Luhn check", async () => {
    const user = userEvent.setup();
    const onCodeAccepted = vi.fn();

    const { container } = render(
      <BarcodeScannerPanel onCodeAccepted={onCodeAccepted} />,
    );

    // Switch to luhn algorithm
    const select = container.querySelector("select");
    await user.selectOptions(select, "luhn");

    await user.type(
      screen.getByPlaceholderText("Manual barcode entry"),
      "12345",
    );
    await user.click(screen.getByText("Use code"));

    await waitFor(() => {
      expect(screen.getByText(/LUHN/)).toBeTruthy();
    });

    expect(onCodeAccepted).not.toHaveBeenCalled();
  });

  it("shows validation error when code doesn't match expected length", async () => {
    const user = userEvent.setup();
    const onCodeAccepted = vi.fn();

    render(<BarcodeScannerPanel onCodeAccepted={onCodeAccepted} />);

    // Set expected length to 10
    const lengthInput = screen.getByPlaceholderText("Optional");
    await user.type(lengthInput, "10");

    await user.type(
      screen.getByPlaceholderText("Manual barcode entry"),
      "SHORT",
    );
    await user.click(screen.getByText("Use code"));

    await waitFor(() => {
      expect(screen.getByText(/Expected length 10/)).toBeTruthy();
    });

    expect(onCodeAccepted).not.toHaveBeenCalled();
  });

  it("shows camera unsupported message when BarcodeDetector is not available", () => {
    // BarcodeDetector is not available in jsdom by default
    render(<BarcodeScannerPanel onCodeAccepted={vi.fn()} />);

    expect(
      screen.getByText(/Camera scanning unsupported/),
    ).toBeTruthy();
  });

  it("shows message when start camera scan is clicked without BarcodeDetector", async () => {
    const user = userEvent.setup();

    render(<BarcodeScannerPanel onCodeAccepted={vi.fn()} />);

    await user.click(screen.getByText("Start camera scan"));

    await waitFor(() => {
      expect(
        screen.getByText(/Camera scanning is not supported/),
      ).toBeTruthy();
    });
  });

  it("renders video element for camera preview", () => {
    const { container } = render(
      <BarcodeScannerPanel onCodeAccepted={vi.fn()} />,
    );

    const video = container.querySelector("video");
    expect(video).toBeTruthy();
    expect(video.className).toBe("barcode-video");
  });
});
