import { SearchOutlined } from "@ant-design/icons";
import { Dropdown, Button, MenuProps, theme } from "antd";
import { useMemo, useCallback } from "react";
import { useAppContext, useNotifyContext, useScanContext } from "../contexts";
import { StartScan } from "../types";
import { isScanning, SCAN_INTERVAL_MS } from "../util";

const { useToken } = theme;

enum ScanType {
  QUICK = "quick",
  FULL = "full",
}

export interface ScanDropdownProps {
  makeRequest: <T>(
    endpoint: string,
    method?: string,
    body?: object | undefined
  ) => Promise<T | null>;
}

export const ScanDropdown = () => {
  const { scanRef, scanStatus, handlePeriodicScan, setScanStatus } =
    useScanContext();
  const { showText, makeRequest } = useAppContext();
  const notify = useNotifyContext();
  const { token } = useToken();

  const scanItems = useMemo(() => {
    const base: MenuProps["items"] = [
      { label: "Quick scan", key: ScanType.QUICK },
      { label: "Full scan", key: ScanType.FULL },
    ];

    if (isScanning(scanStatus)) {
      base.push({
        disabled: true,
        label: (
          <span style={{ color: token.colorText }}>
            Fetching {scanStatus!.fetched}
          </span>
        ),
        key: "state",
      });
    }

    return base;
  }, [scanStatus, token.colorText]);

  const startScan = useCallback(
    async (full: boolean) => {
      const scanStart = await makeRequest<StartScan>("scan", "POST", { full });
      if (scanStart) {
        setScanStatus({
          fetched: 0,
          scanning: true,
        });

        if (scanRef.current) {
          clearInterval(scanRef.current);
        }

        scanRef.current = setInterval(handlePeriodicScan, SCAN_INTERVAL_MS);

        if (scanStart.started) {
          notify.success({ message: "Started scan", placement: "top" });
        } else {
          notify.info({ message: "Scan already started", placement: "top" });
        }
      }
    },
    [handlePeriodicScan, makeRequest, notify, scanRef, setScanStatus]
  );

  const clickMenu = useCallback(
    ({ key }: { key: string }) => {
      if (key === ScanType.FULL) {
        startScan(true);
      } else if (key === ScanType.QUICK) {
        startScan(false);
      }
    },
    [startScan]
  );

  return (
    <Dropdown
      menu={{ items: scanItems, onClick: clickMenu }}
      trigger={isScanning(scanStatus) ? ["hover"] : ["click"]}
    >
      <Button
        icon={<SearchOutlined />}
        loading={isScanning(scanStatus)}
        type="primary"
      >
        {showText && "Scan library"}
      </Button>
    </Dropdown>
  );
};
