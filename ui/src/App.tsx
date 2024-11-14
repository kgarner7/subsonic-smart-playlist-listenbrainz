import { ConfigProvider, Layout, notification, Row, Spin, theme } from "antd";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppContext } from "./contexts/app-context";
import { ScanContext } from "./contexts/scan-context";
import { NotifyContext } from "./contexts/notify-context";
import {
  APIError,
  APIResponse,
  isError,
  ScanStatus,
  Session,
  SortDirection,
  SortInfo,
  SortType,
  Tags,
} from "./types";
import { sortFunc, SCAN_INTERVAL_MS, getBool, isScanning } from "./util";
import { TagContext, TagContextProps } from "./contexts/tag-context";
import { AppHeader } from "./header/app-header";
import { ExistingPlaylist } from "./playlist/types";

const LoginForm = lazy(() => import("./login"));
const Playlist = lazy(() => import("./playlist"));

const { Content } = Layout;

const getDarkPreferred = () => {
  const dark = getBool("dark");

  if (dark !== null) {
    return dark;
  }

  return window?.matchMedia?.("(prefers-color-scheme:dark)")?.matches ?? false;
};

const getPreferredTextMode = () => {
  return getBool("text") ?? false;
};

const App = () => {
  const [notify, contextHolder] = notification.useNotification();

  const [authenticated, setAuthenticated] = useState(
    window.__authenticated__ ?? false
  );
  const [dark, setDark] = useState(getDarkPreferred());
  const [showText, setShowText] = useState(getPreferredTextMode());
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null);
  const [artistTags, setArtistTags] = useState<Tags | null>(null);
  const [playlists, setPlaylists] = useState<ExistingPlaylist[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);

  const [artistSort, setArtistSort] = useState<SortInfo>({
    direction: SortDirection.ASCENDING,
    type: SortType.NAME,
  });

  const [tagSort, setTagSort] = useState<SortInfo>({
    direction: SortDirection.ASCENDING,
    type: SortType.NAME,
  });

  const scanRef = useRef<number>();

  const clearState = useCallback(() => {
    setAuthenticated(false);
    setScanStatus(null);
    setArtistTags(null);
  }, []);

  const makeRequest = useCallback(
    async <T,>(
      endpoint: string,
      method = "GET",
      body: object | undefined = undefined,
      handler?: (error: APIError) => void
    ): Promise<T | null> => {
      try {
        const response = await fetch(`./api/${endpoint}`, {
          body: body ? JSON.stringify(body) : undefined,
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          method,
        });

        if (response.status === 401) {
          clearState();

          notify.error({
            description:
              "Your session has likely timed out. Please log in again to continue",
            message: "Session timed out",
            placement: "top",
          });
          return null;
        }

        const data = (await response.json()) as APIResponse<T>;

        if (isError(data)) {
          if (handler) {
            handler(data);
            return null;
          } else {
            throw new Error(data.error);
          }
        }

        return data;
      } catch (error) {
        console.error(error);
        notify.error({
          message: `Request to ${endpoint} failed`,
          description: (error as Error).message,
          placement: "top",
        });

        return null;
      }
    },
    [notify, clearState]
  );

  const fetchScanStatus = useCallback(async () => {
    const scanStatus = await makeRequest<ScanStatus>("scanStatus");
    setScanStatus(scanStatus);
    return scanStatus;
  }, [makeRequest]);

  const fetchTags = useCallback(async () => {
    const tags = await makeRequest<Tags>("tags");
    setArtistTags(tags);
    return tags !== null;
  }, [makeRequest]);

  const fetchSessions = useCallback(async () => {
    const sessions = await makeRequest<Session[]>("session");
    setSessions(sessions ?? []);
    return sessions != null;
  }, [makeRequest]);

  const fetchPlaylists = useCallback(async () => {
    const playlists = await makeRequest<ExistingPlaylist[]>("playlists");
    setPlaylists(playlists ?? []);
    return playlists !== null;
  }, [makeRequest]);

  const handlePeriodicScan = useCallback(async () => {
    const status = await fetchScanStatus();

    if (!isScanning(status)) {
      clearInterval(scanRef.current);
      scanRef.current = undefined;

      if (status !== null) {
        await fetchTags();
        notify.success({ message: "Scan completed", placement: "top" });
      }
    }
  }, [notify, fetchTags, fetchScanStatus]);

  const fetchMetadata = useCallback(async () => {
    const status = await fetchScanStatus();
    if (status) {
      await Promise.all([fetchTags(), fetchSessions(), fetchPlaylists()]);

      if (isScanning(status)) {
        if (scanRef.current) {
          clearInterval(scanRef.current);
        }

        scanRef.current = setInterval(handlePeriodicScan, SCAN_INTERVAL_MS);
      }
    }
  }, [
    fetchPlaylists,
    fetchScanStatus,
    fetchSessions,
    fetchTags,
    handlePeriodicScan,
  ]);

  useEffect(() => {
    if (window.__authenticated__) {
      fetchMetadata().catch(console.error);
    }
  }, [fetchMetadata]);

  const artists = useMemo(() => {
    if (artistTags?.artists) {
      const func = sortFunc(artistSort);

      return artistTags.artists
        .map((item) => ({
          count: item.count,
          name:
            item.subsonic_name && item.subsonic_name !== item.name
              ? `${item.subsonic_name} ⋅ ${item.name}`
              : item.name,
          mbid: item.mbid,
        }))
        .sort(func)
        .map((item) => ({
          label: item.name,
          value: item.mbid,
        }));
    }

    return [];
  }, [artistSort, artistTags?.artists]);

  const tags = useMemo(() => {
    if (artistTags?.tags) {
      const func = sortFunc(tagSort);

      return artistTags.tags.sort(func).map((item) => ({
        label: item.name,
        value: item.name,
      }));
    }

    return [];
  }, [artistTags?.tags, tagSort]);

  const tagInfo = useMemo(
    (): TagContextProps => ({
      artistSort,
      artists,
      playlists,
      tagSort,
      tags,
      sessions,
      setArtistSort,
      setPlaylists,
      setSessions,
      setTagSort,
    }),
    [artistSort, artists, playlists, sessions, tagSort, tags]
  );

  return (
    <ConfigProvider
      theme={{
        algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
      }}
    >
      {contextHolder}
      <NotifyContext.Provider value={notify}>
        <AppContext.Provider
          value={{
            authenticated,
            dark,
            showText,
            clearState,
            fetchMetadata,
            makeRequest,
            setDark,
            setShowText,
          }}
        >
          <ScanContext.Provider
            value={{ scanRef, scanStatus, handlePeriodicScan, setScanStatus }}
          >
            <TagContext.Provider value={tagInfo}>
              <Layout id="layout">
                <AppHeader />
                <Content id="content">
                  <Row justify="center" style={{ marginTop: 30 }}>
                    {authenticated ? (
                      <Suspense fallback={<Spin />}>
                        <Playlist />
                      </Suspense>
                    ) : (
                      <Suspense fallback={<Spin />}>
                        <LoginForm
                          onSuccess={() => {
                            notify.success({
                              message: "Logged in",
                              placement: "top",
                            });
                            setAuthenticated(true);
                            fetchMetadata();
                          }}
                        />
                      </Suspense>
                    )}
                  </Row>
                </Content>
              </Layout>
            </TagContext.Provider>
          </ScanContext.Provider>
        </AppContext.Provider>
      </NotifyContext.Provider>
    </ConfigProvider>
  );
};

export default App;
