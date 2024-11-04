import { createContext, MutableRefObject } from "react";
import { ScanStatus } from "../types";

export interface ScanContext {
  scanRef: MutableRefObject<number | undefined>;
  scanStatus: ScanStatus | null;

  handlePeriodicScan: () => Promise<void>;
  setScanStatus: (status: ScanStatus) => void;
}

// @ts-expect-error It is required for this context to exist, but just make it null so no default has to be provided
export const ScanContext = createContext<ScanContext>(null);
