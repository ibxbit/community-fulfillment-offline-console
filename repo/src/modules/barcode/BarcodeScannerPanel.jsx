import { useEffect, useMemo, useRef, useState } from "react";
import { validateBarcode } from "./checkDigit";

const DEFAULT_CONFIG = {
  algorithm: "none",
  expectedLength: "",
};

export function BarcodeScannerPanel({ onCodeAccepted }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [message, setMessage] = useState("");
  const [config, setConfig] = useState(DEFAULT_CONFIG);

  const canUseBarcodeDetector = useMemo(() => {
    return typeof window !== "undefined" && "BarcodeDetector" in window;
  }, []);

  function stopScanner() {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsScanning(false);
  }

  async function acceptCode(rawCode, source) {
    const result = validateBarcode(rawCode, {
      algorithm: config.algorithm,
      expectedLength: config.expectedLength,
    });

    if (!result.ok) {
      setMessage(result.reason);
      return;
    }

    const code = String(rawCode).trim();
    setMessage(`${source}: ${code}`);
    await onCodeAccepted(code);
  }

  async function startScanner() {
    if (!canUseBarcodeDetector) {
      setMessage(
        "Camera scanning is not supported on this browser/device. Use manual entry.",
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const detector = new window.BarcodeDetector({
        formats: ["code_128", "ean_13", "ean_8", "upc_a", "upc_e", "qr_code"],
      });

      setIsScanning(true);
      setMessage("Scanning...");

      const loop = async () => {
        if (!videoRef.current) {
          return;
        }

        try {
          const detections = await detector.detect(videoRef.current);
          if (detections.length > 0 && detections[0].rawValue) {
            await acceptCode(detections[0].rawValue, "Camera scan");
            stopScanner();
            return;
          }
        } catch {
          setMessage("Unable to detect barcode from camera stream.");
        }

        frameRef.current = requestAnimationFrame(loop);
      };

      frameRef.current = requestAnimationFrame(loop);
    } catch {
      setMessage("Camera access denied or unavailable. Use manual entry.");
      stopScanner();
    }
  }

  useEffect(() => {
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="panel">
      <h2>Barcode Scanner</h2>
      <p>Scan to locate items and open quick actions, or type manually.</p>

      <div className="barcode-controls">
        <label>
          Check-digit rule
          <select
            value={config.algorithm}
            onChange={(event) =>
              setConfig((prev) => ({ ...prev, algorithm: event.target.value }))
            }
          >
            <option value="none">none</option>
            <option value="luhn">luhn</option>
            <option value="mod11">mod11</option>
          </select>
        </label>

        <label>
          Expected length
          <input
            type="number"
            min="0"
            placeholder="Optional"
            value={config.expectedLength}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                expectedLength: event.target.value,
              }))
            }
          />
        </label>

        <button type="button" onClick={startScanner} disabled={isScanning}>
          Start camera scan
        </button>
        <button type="button" onClick={stopScanner} disabled={!isScanning}>
          Stop
        </button>
      </div>

      <video ref={videoRef} className="barcode-video" muted playsInline />

      <div className="barcode-manual">
        <input
          placeholder="Manual barcode entry"
          value={manualCode}
          onChange={(event) => setManualCode(event.target.value)}
        />
        <button
          type="button"
          onClick={() => acceptCode(manualCode, "Manual entry")}
        >
          Use code
        </button>
      </div>

      {message ? <p>{message}</p> : null}
      {!canUseBarcodeDetector ? (
        <p>Camera scanning unsupported here; manual entry remains offline.</p>
      ) : null}
    </section>
  );
}
