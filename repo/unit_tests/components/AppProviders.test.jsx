import { describe, expect, it, afterEach } from "vitest";
import "./componentTestSetup";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { AppProviders } from "../../src/app/AppProviders";
import { useAppState } from "../../src/app/AppStateContext";

afterEach(cleanup);

// Consumer component that reads from the context and renders its values
function ContextReader() {
  const state = useAppState();
  return (
    <div data-testid="context-reader">
      <span data-testid="ready">{String(state.ready)}</span>
      <span data-testid="has-services">{String(!!state.services)}</span>
      <span data-testid="has-auth">{String(!!state.auth)}</span>
      <span data-testid="theme">{state.preferences?.theme ?? "none"}</span>
      <span data-testid="has-set-theme">{String(typeof state.setTheme === "function")}</span>
    </div>
  );
}

describe("AppProviders", () => {
  it("provides AppStateContext with services, auth, and preferences", async () => {
    render(
      <AppProviders>
        <ContextReader />
      </AppProviders>,
    );

    const reader = screen.getByTestId("context-reader");
    expect(reader).toBeTruthy();

    // services should be available immediately (before init completes)
    expect(screen.getByTestId("has-services").textContent).toBe("true");
    expect(screen.getByTestId("has-auth").textContent).toBe("true");
    expect(screen.getByTestId("theme").textContent).toBe("light");
    expect(screen.getByTestId("has-set-theme").textContent).toBe("true");
  });

  it("eventually sets ready=true after async init", async () => {
    render(
      <AppProviders>
        <ContextReader />
      </AppProviders>,
    );

    // ready starts false, then becomes true after bootstrap
    await waitFor(() => {
      expect(screen.getByTestId("ready").textContent).toBe("true");
    });
  });

  it("throws when useAppState is used outside provider", () => {
    // Rendering ContextReader without AppProviders should throw
    const consoleError = console.error;
    console.error = () => {}; // suppress React error boundary noise

    let thrown = false;
    try {
      render(<ContextReader />);
    } catch (e) {
      thrown = true;
      expect(e.message).toContain("useAppState must be used inside AppStateProvider");
    }

    console.error = consoleError;
    expect(thrown).toBe(true);
  });
});
