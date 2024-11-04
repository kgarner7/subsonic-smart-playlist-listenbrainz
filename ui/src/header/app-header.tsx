import {
  ReloadOutlined,
  LogoutOutlined,
  SunFilled,
  MoonFilled,
} from "@ant-design/icons";
import { Row, Col, Button } from "antd";
import { Header } from "antd/es/layout/layout";
import { useCallback, useState } from "react";
import { useAppContext, useNotifyContext } from "../contexts";
import { setBool } from "../util";
import { ScanDropdown } from "./scan-dropdown";

export const AppHeader = () => {
  const {
    authenticated,
    dark,
    showText,
    clearState,
    fetchMetadata,
    makeRequest,
    setDark,
    setShowText,
  } = useAppContext();
  const notify = useNotifyContext();

  const [fetching, setFetching] = useState(false);

  const toggleDark = useCallback(() => {
    setDark((dark) => {
      setBool("dark", !dark);
      return !dark;
    });
  }, [setDark]);

  const toggleText = useCallback(() => {
    setShowText((showText) => {
      setBool("text", !showText);
      return !showText;
    });
  }, [setShowText]);

  const doRefresh = useCallback(async () => {
    try {
      setFetching(true);
      await fetchMetadata();
    } finally {
      setFetching(false);
    }
  }, [fetchMetadata]);

  const logOut = useCallback(async () => {
    const response = await makeRequest<object>("logout", "DELETE");
    if (response !== null) {
      clearState();
      notify.success({
        message: "You have logged out successfully",
        placement: "top",
      });
    }
  }, [clearState, makeRequest, notify]);

  return (
    <Header id="header">
      <Row justify="end" gutter={6}>
        {authenticated && (
          <>
            <Col>
              <ScanDropdown />
            </Col>
            <Col>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                loading={fetching}
                onClick={doRefresh}
              >
                {showText && `Refresh${fetching ? "ing" : ""}`}
              </Button>
            </Col>
            <Col>
              <Button
                color="danger"
                variant="solid"
                icon={<LogoutOutlined />}
                onClick={logOut}
              >
                {showText && "Log out"}
              </Button>
            </Col>
          </>
        )}
        <Col>
          <Button
            icon={dark ? <SunFilled /> : <MoonFilled />}
            onClick={toggleDark}
            type="primary"
          >
            {showText && `Switch to ${dark ? "light" : "dark"} mode`}
          </Button>
        </Col>
        <Col>
          <Button type="primary" onClick={toggleText}>
            {showText ? "Hide " : "Show "} text
          </Button>
        </Col>
      </Row>
    </Header>
  );
};
