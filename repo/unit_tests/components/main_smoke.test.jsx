import { describe, expect, it, afterEach } from "vitest";
import "./componentTestSetup";
import { render, cleanup, waitFor } from "@testing-library/react";
import React from "react";
import { createRoot } from "react-dom/client";
import { AppProviders } from "../../src/app/AppProviders";
import { App } from "../../src/app/App";

afterEach(cleanup);

describe("main.jsx entry point behavior", () => {
  it("renders the full app tree into a root element", async () => {
    const root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);

    const reactRoot = createRoot(root);
    reactRoot.render(
      <React.StrictMode>
        <AppProviders>
          <App />
        </AppProviders>
      </React.StrictMode>,
    );

    // Wait for the app to render real content
    await waitFor(() => {
      expect(root.querySelector("main.shell")).toBeTruthy();
    });

    // Verify key structural elements rendered
    expect(root.querySelector("header.shell__header")).toBeTruthy();
    expect(root.querySelector("h1").textContent).toBe(
      "Community Fulfillment & Submission Operations Console",
    );

    // Verify at least one panel rendered
    expect(root.querySelector(".panel")).toBeTruthy();

    // Verify system status section exists
    expect(root.textContent).toContain("System Status");
    expect(root.textContent).toContain("Bootstrapped:");

    reactRoot.unmount();
    document.body.removeChild(root);
  });
});
