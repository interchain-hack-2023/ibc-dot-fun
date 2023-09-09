import { FC, PropsWithChildren, createContext } from "react";
import { SkipClient, LeapClient } from "./client";
import { IGNORE_CHAINS } from "@/config";

export const SkipContext = createContext<
  | {
      skipClient: SkipClient;
    }
  | undefined
>(undefined);

export const SkipProvider: FC<PropsWithChildren> = ({ children }) => {
  return (
    <SkipContext.Provider value={{ skipClient: new SkipClient(IGNORE_CHAINS) }}>
      {children}
    </SkipContext.Provider>
  );
};

export const LeapContext = createContext<
  | {
      leapClient: LeapClient;
    }
  | undefined
>(undefined);

export const LeapProvider: FC<PropsWithChildren> = ({ children }) => {
  return (
    <LeapContext.Provider value={{ leapClient: new LeapClient(IGNORE_CHAINS) }}>
      {children}
    </LeapContext.Provider>
  );
};
