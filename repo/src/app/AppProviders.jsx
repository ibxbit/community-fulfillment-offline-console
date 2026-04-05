import { AppStateProvider } from "./AppStateContext";

export function AppProviders({ children }) {
  return <AppStateProvider>{children}</AppStateProvider>;
}
