import { Button, Collapse, Form, Select, Typography } from "antd";
import type { DefaultOptionType } from "antd/es/select";
import { useEffect } from "react";
import { useTagContext } from "../contexts";
import { PromptForm } from "./prompt-form";
import { FormData, PromptType } from "./types";
import { SessionForm } from "./session-form";

const { Item } = Form;
const { Title, Text } = Typography;

const PromptOptions: DefaultOptionType[] = [
  { label: "New prompt", value: PromptType.PROMPT },
  { label: "Existing session", value: PromptType.SESSION },
];

export interface PlaylistFormProps {
  loading: boolean;

  submit: (data: FormData) => Promise<void>;
}

const PlaylistForm = ({ loading, submit }: PlaylistFormProps) => {
  const { sessions } = useTagContext();

  const [form] = Form.useForm<FormData>();
  const type = Form.useWatch("type", form);

  useEffect(() => {
    if (sessions.length === 0) {
      form.setFieldValue("type", PromptType.PROMPT);
    }
  }, [form, sessions.length]);

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
                      Generate the playlist. After a few seconds, you will have
                      a playlist you can edit.
                    </li>
                    <li>
                      You can also retry, excluding currently selected tracks.
                      This will create a new playlist, excluding tracks
                      previously seen, if possible.
                    </li>
                    <li>
                      Once you're happy, press save and it will be saved to your
                      server. Here, you can also choose to save the prompt as a
                      session to return to it later. Note that if you did
                      multiple retries, this will start with excluding those
                      tracks
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
