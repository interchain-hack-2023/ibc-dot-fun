import { useContext, useEffect, useState } from "react";
import { LeapContext } from "./context";

export function useLeapClient() {
  const context = useContext(LeapContext);

  if (context === undefined) {
    throw new Error("useLeapClient must be used within a LeapProvider");
  }

  return context.leapClient;
}

export const useDebounce = <T>(value: T, delay = 50): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
};
