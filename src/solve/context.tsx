import { FC, PropsWithChildren, createContext } from "react";
import { LeapClient } from "./client";
import { IGNORE_CHAINS } from "@/config";

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
