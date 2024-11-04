import { useContext } from "react";
import { AppContext } from "./app-context";
import { NotifyContext } from "./notify-context";
import { ScanContext } from "./scan-context";
import { TagContext } from "./tag-context";

export const useAppContext = () => {
  return useContext(AppContext);
};

export const useNotifyContext = () => {
  return useContext(NotifyContext);
};

export const useScanContext = () => {
  return useContext(ScanContext);
};

export const useTagContext = () => {
  return useContext(TagContext);
};
