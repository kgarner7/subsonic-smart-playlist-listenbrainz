import { createContext, Dispatch, SetStateAction } from "react";
import { APIError } from "../types";

export interface AppContextState {
  authenticated: boolean;
  dark: boolean;
  showText: boolean;

  clearState: () => void;
  fetchMetadata: () => Promise<void>;
  makeRequest: <T>(
    endpoint: string,
    method?: string,
    body?: object | undefined,
    handler?: (error: APIError) => void
  ) => Promise<T | null>;
  setDark: Dispatch<SetStateAction<boolean>>;
  setShowText: Dispatch<SetStateAction<boolean>>;
}

// @ts-expect-error It is required for this context to exist, but just make it null so no default has to be provided
export const AppContext = createContext<AppContextState>(null);
