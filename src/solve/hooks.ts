import { useContext } from "react";
import { LeapContext } from "./context";

export function useLeapClient() {
  const context = useContext(LeapContext);

  if (context === undefined) {
    throw new Error("useLeapClient must be used within a LeapProvider");
  }

  return context.leapClient;
}
