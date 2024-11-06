import { ScanStatus, SortDirection, SortInfo, SortType, Tag } from "./types";


export const isScanning = (status: ScanStatus | null) => {
  if (status) {
    return status.scanning;
  }

  return false;
};

export const SCAN_INTERVAL_MS = 5000;

export const getBool = (key: string): boolean | null => {
  const value = localStorage.getItem(key);

  if (value !== null) {
    return value === "true";
  }

  return null;
};

export const setBool = (key: string, value: boolean): void => {
  localStorage.setItem(key, value.toString());
};

export const sortFunc = (info: SortInfo):  ((a: Tag, b: Tag) => number)  => {
  switch (info.type) {
    case SortType.FREQUENCY:
      if (info.direction === SortDirection.ASCENDING) {
        return (a, b) => { 
          return a.count - b.count
        }
      } else {
        return (b, a) => { 
          return a.count - b.count
        }
      }
    case SortType.NAME:
      if (info.direction === SortDirection.ASCENDING) {
        return (a, b) => { 
          return a.name.localeCompare(b.name)
        }
      } else {
        return (b, a) => { 
          return a.name.localeCompare(b.name)
        }
      }
  }
}