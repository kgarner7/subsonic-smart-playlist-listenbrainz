import { SearchOutlined } from "@ant-design/icons";
import { Dropdown, Button, MenuProps, theme } from "antd";
import { useMemo, useCallback } from "react";
import { useAppContext, useNotifyContext, useScanContext } from "../contexts";
import { ScanState, StartScan } from "../types";
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
      let key: string;
      let label: string;

      switch (scanStatus!.state) {
        case ScanState.SUBSONIC: {
          label = `Songs fetched: ${scanStatus!.subsonic}`;
          key = "Subsonic tracks";
          break;
        }
        case ScanState.METADATA:
          label = `ListenBrainz metadata lookup: ${scanStatus!.metadata[0]} / ${
            scanStatus!.metadata[1]
          }`;
          key = "Metadata";
          break;
        default:
          label = `ListenBrainz popularity/tag lookup: ${
            scanStatus!.tags[0]
          } / ${scanStatus!.tags[1]}`;
          key = "tags/popularity";
          break;
      }

      base.push({ type: "divider" });
      base.push({
        disabled: true,
        label: <span style={{ color: token.colorText }}>{label}</span>,
        key,
      });
      base.push({
        disabled: true,
        label: <span style={{ color: token.colorText }}>Fetching {key}</span>,
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
          metadata: [0, 0],
          state: ScanState.SUBSONIC,
          subsonic: [0],
          tags: [0, 0],
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
      trigger={["click", "hover"]}
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
