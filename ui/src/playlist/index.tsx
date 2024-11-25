import { Col, Tabs } from "antd";
import PlaylistForm from "./playlist-form";
import { useCallback, useState } from "react";
import { PlaylistData } from "./playlist-result";
import {
  FormData,
  FormItemType,
  Playlist as PlaylistType,
  PlaylistResponse,
  PromptType,
  RadioCreate,
  Difficulty,
} from "./types";
import { useAppContext, useNotifyContext, useTagContext } from "../contexts";

interface PlaylistState extends PlaylistResponse {
  prompt: RadioCreate;
}

interface CreateSession {
  mbids: string[];
  mode: Difficulty;
  name: string;
  prompt: string;
}

const formDataToPrompt = (
  data: FormData,
  excluded_mbids: string[] = []
): RadioCreate => {
  let body: RadioCreate;

  if (data.type === PromptType.PROMPT) {
    const { advanced, mode, rules } = data;

    let prompt: string;

    if (advanced) {
      prompt = rules
        .map((rule) => {
          const weight = rule.weight ?? 1;

          if (rule.type === FormItemType.ARTIST) {
            const nosim = rule.similar === false ? ":nosim" : "";
            return `artist:(${rule.artist}):${weight}${nosim}`;
          } else {
            const nosim = rule.similar === false ? "nosim," : "";
            return `tag:(${rule.genre.join(",")}):${weight}:${nosim}${
              rule.join
            }`;
          }
        })
        .join(" ");
    } else {
      prompt = rules
        .map((rule) => {
          if (rule.type === FormItemType.ARTIST) {
            return `artist:(${rule.artist})`;
          } else {
            return `tag:(${rule.genre.join(",")})`;
          }
        })
        .join(" ");
    }

    body = {
      excluded_mbids,
      prompt: { type: PromptType.PROMPT, mode, prompt },
    };
  } else {
    body = {
      excluded_mbids,
      prompt: { type: PromptType.SESSION, id: data.session },
    };
  }

  return body;
};

const Playlist = () => {
  const { makeRequest } = useAppContext();
  const notify = useNotifyContext();
  const { setSessions } = useTagContext();

  const [data, setData] = useState<PlaylistState | null>(null);
  const [key, setKey] = useState("1");
  const [loading, setLoading] = useState(false);

  const createRadio = useCallback(
    async (body: RadioCreate): Promise<boolean> => {
      setLoading(true);

      try {
        const response = await makeRequest<PlaylistResponse>(
          "radio",
          "POST",
          body,
          (error) => {
            if (body.prompt.type === PromptType.SESSION) {
              const sessionId = body.prompt.id;

              setSessions((sesss) =>
                sesss.filter((sess) => sess.id !== sessionId)
              );

              notify.error({
                message: "This session has finished",
                description:
                  "All possible tracks have been excluded, no more songs to fetch. Deleting this session",
                placement: "top",
              });
            } else {
              notify.error({
                message: "Failed to generate playlist",
                description: error.error,
                placement: "top",
              });
            }
          }
        );

        if (response !== null) {
          const playlist = response.playlist;

          if (body.prompt.type === PromptType.PROMPT) {
            notify.success({
              message: "Playlist successfully generated",
              description: playlist.name,
              placement: "top",
            });
          } else {
            const sessionId = body.prompt.id;

            setSessions((sessions) =>
              sessions.map((session) =>
                session.id === sessionId
                  ? {
                      id: session.id,
                      name: session.name,
                      seen: (session.seen += playlist.recordings.length),
                    }
                  : session
              )
            );

            notify.success({
              message: "Successfully fetched",
              description: playlist.name,
              placement: "top",
            });
          }

          setData({
            log: response.log,
            playlist,
            prompt: body,
          });

          return true;
        }
      } catch (error) {
        notify.error({
          message: "Failed to generate playlist",
          description: (error as Error).message,
          placement: "top",
        });
      } finally {
        setLoading(false);
      }

      return false;
    },
    [makeRequest, notify, setSessions]
  );

  const submit = useCallback(
    async (data: FormData, exclude?: string[]): Promise<boolean> => {
      const body = formDataToPrompt(data, exclude);
      return createRadio(body);
    },
    [createRadio]
  );

  const createPlaylist = useCallback(
    async (data: FormData) => {
      const passed = await submit(data);
      if (passed) {
        setKey("2");
      }
    },
    [submit]
  );

  const retry = useCallback(
    async (additionalMbids: string[]) => {
      if (data) {
        const { excluded_mbids, prompt } = data.prompt;
        await createRadio({
          excluded_mbids: excluded_mbids.concat(additionalMbids),
          prompt,
        });
      }
    },
    [createRadio, data]
  );

  const updatePlaylist = useCallback((playlist: PlaylistType) => {
    setData((data) => {
      if (data) {
        return { log: data.log, playlist, prompt: data.prompt };
      }

      return data;
    });
  }, []);

  const createSession = useCallback(async () => {
    if (data) {
      const prompt = data.prompt.prompt;
      if (prompt.type === PromptType.PROMPT && !data.playlist.session) {
        setLoading(true);
        const playlistMbids = data.playlist.recordings.map((r) => r.mbid);
        const body: CreateSession = {
          mbids: data.prompt.excluded_mbids.concat(playlistMbids),
          mode: prompt.mode,
          name: data.playlist.name,
          prompt: prompt.prompt,
        };

        const response = await makeRequest<{ id: number }>(
          "session",
          "POST",
          body
        );

        if (response) {
          setSessions((sessions) =>
            sessions.concat({
              id: response.id,
              name: body.name,
              seen: body.mbids.length,
            })
          );

          setData({
            log: data.log,
            playlist: { ...data.playlist, session: response.id },
            prompt: data.prompt,
          });

          notify.success({
            message: "Successfully saved prompt as a session",
            placement: "top",
          });
        }

        setLoading(false);
      }
    }
  }, [data, makeRequest, notify, setSessions]);

  return (
    <Col xs={20}>
      <Tabs
        activeKey={key}
        centered
        items={[
          {
            key: "1",
            label: "Playlist generator",
            children: (
              <PlaylistForm loading={loading} submit={createPlaylist} />
            ),
          },
          {
            key: "2",
            label: "Generated playlist",
            disabled: !data,
            children: data && (
              <PlaylistData
                retryLoading={loading}
                retry={retry}
                saveAsSession={createSession}
                updatePlaylist={updatePlaylist}
                {...data}
              />
            ),
          },
        ]}
        onChange={setKey}
      />
    </Col>
  );
};

export default Playlist;
