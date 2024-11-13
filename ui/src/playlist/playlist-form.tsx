import { Button, Collapse, Form, Select, Typography } from "antd";
import type { DefaultOptionType } from "antd/es/select";
import { useCallback, useEffect, useState } from "react";
import { useAppContext, useNotifyContext, useTagContext } from "../contexts";
import { PlaylistResponse } from "../types";
import { PromptForm } from "./prompt-form";
import { FormData, FormItemType, PromptType, RadioCreate } from "./types";
import { SessionForm } from "./session-form";

const { Item } = Form;
const { Title, Text } = Typography;

const PromptOptions: DefaultOptionType[] = [
  { label: "New prompt", value: PromptType.PROMPT },
  { label: "Existing session", value: PromptType.SESSION },
];

export interface PlaylistFormProps {
  onSuccess: (playlist: PlaylistResponse) => void;
}

const PlaylistForm = ({ onSuccess }: PlaylistFormProps) => {
  const { sessions, setSessions } = useTagContext();
  const notify = useNotifyContext();
  const { makeRequest } = useAppContext();

  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm<FormData>();
  const type = Form.useWatch("type", form);

  useEffect(() => {
    if (sessions.length === 0) {
      form.setFieldValue("type", PromptType.PROMPT);
    }
  }, [form, sessions.length]);

  const submit = useCallback(
    async (data: FormData) => {
      console.log(data);
      setLoading(true);

      try {
        let body: RadioCreate;

        if (data.type === PromptType.PROMPT) {
          const { advanced, mode, rules, session } = data;

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
            prompt: { type: PromptType.PROMPT, mode, prompt, session },
          };
        } else {
          body = { prompt: { type: PromptType.SESSION, id: data.session } };
        }

        const response = await makeRequest<PlaylistResponse>(
          "radio",
          "POST",
          body,
          (error) => {
            if (data.type === PromptType.SESSION) {
              setSessions((sesss) =>
                sesss.filter((sess) => sess.id !== data.session)
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
          if (data.type === PromptType.PROMPT && data.session) {
            if (response[0].session) {
              setSessions((sessions) =>
                sessions.concat([
                  {
                    name: response[0].name,
                    id: response[0].session!,
                    seen: 50,
                  },
                ])
              );

              notify.success({
                message: "Playlist successfully generated",
                description: response[0].name,
                placement: "top",
              });
            } else {
              notify.warning({
                message: "Playlist successfully generated",
                description: `New playlist ${response[0].name}. However, as there are fewer than 50 tracks, a radio session was not created`,
                placement: "top",
              });
            }
          } else {
            setSessions((sessions) =>
              sessions.map((session) =>
                session.id === data.session
                  ? {
                      id: session.id,
                      name: session.name,
                      seen: (session.seen += response[0].recordings.length),
                    }
                  : session
              )
            );

            notify.success({
              message: "Successfully fetched",
              description: response[0].name,
              placement: "top",
            });
          }

          onSuccess(response);

          form.resetFields();
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
    },
    [form, makeRequest, notify, onSuccess, setSessions]
  );

  return (
    <Form<FormData>
      initialValues={{ rules: [{}] }}
      onFinish={submit}
      form={form}
    >
      <Collapse
        items={[
          {
            key: "1",
            label: "Instructions",
            children: (
              <>
                <Title level={3}>
                  Subsonic Playlist Generator, powered by{" "}
                  <a
                    href="https://github.com/metabrainz/troi-recommendation-playground"
                    rel="noreferrer noopener"
                  >
                    ListenBrainz Troi Recommendation engine
                  </a>
                </Title>
                <Text>
                  This application uses the Troi backend, connected to your
                  Subsonic server of choice, to generate a playlist based off of
                  various criteria (genres, artists). To generate a playlist,
                  there are four steps:
                  <ol>
                    <li>
                      Select a "difficulty." This denotes how Troi will select
                      tracks based off of your queries. "Easy" selects the most
                      relevant data (e.g. for genres, within the same genre),
                      "Medium" in the middle (related releases), and "Hard".
                    </li>
                    <li>
                      Add one or more criteria. These criteria obey the
                      following rules:
                      <ol>
                        <li>
                          If you have a single artist, your playlist will use
                          that singular artist as a starting point
                        </li>
                        <li>
                          If you have multiple artists, each artist will
                          contribute equally (unless yous et the weight)
                        </li>
                        <li>If you have a single genre, same story</li>
                        <li>
                          For genres, you can select multiple genres in one
                          rule. In this case, you can either require tracks to
                          have <b>all</b> of the genres, or <b>any</b> of them
                        </li>
                        <li>
                          If you have multiple genre rules, then they will apply
                          separately to your playlist
                        </li>
                        <li>
                          In advanced mode, you can weigh rules to make certain
                          requirements more important than others
                        </li>
                      </ol>
                    </li>
                    <li>
                      Optionally, choose to save this prompt as a session. This
                      will allow you to continually retrieve new items until all
                      songs have been fetcehd
                    </li>
                    <li>
                      Generate the playlist. After a few seconds, you will have
                      a playlist you can edit. Once you're happy, press save and
                      it will be saved to your server
                    </li>
                  </ol>
                  Note, if you have an existing session, you can instead use to
                  retrieve this prompt. Tracks previously seen will be ignored,
                  and you can continue to use this session until all new tracks
                  have been exhausted.
                </Text>
              </>
            ),
          },
        ]}
      ></Collapse>
      <br />
      <Item<PromptType>
        name="type"
        label="Prompt type"
        rules={[{ required: true }]}
        hidden={sessions.length === 0}
        initialValue={type}
      >
        <Select<PromptType> options={PromptOptions} value={type} />
      </Item>
      {!!sessions.length && type === PromptType.SESSION && (
        <SessionForm sessions={sessions} />
      )}
      {(!sessions.length || type === PromptType.PROMPT) && <PromptForm />}
      <Item>
        <Button type="primary" htmlType="submit" block loading={loading}>
          Submit
        </Button>
      </Item>
    </Form>
  );
};

export default PlaylistForm;
