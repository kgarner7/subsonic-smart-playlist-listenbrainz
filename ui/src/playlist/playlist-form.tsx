import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import {
  Button,
  Col,
  Collapse,
  Form,
  Row,
  Select,
  Switch,
  Typography,
} from "antd";
import { DefaultOptionType } from "antd/es/select";
import { useCallback, useState } from "react";
import { useAppContext, useNotifyContext, useTagContext } from "../contexts";
import { PlaylistResponse, SortDirection, SortType } from "../types";
import { FormItem, FormRowData } from "./form-item";
import { getBool, setBool } from "../util";
import { FormItemType } from "./types";

const { Item, List } = Form;
const { Title, Text } = Typography;

const SORT_OPTIONS: DefaultOptionType[] = [
  {
    label: "name",
    value: SortType.NAME,
  },
  {
    label: "number of recordings",
    value: SortType.FREQUENCY,
  },
];

const SORT_DIRECTION: DefaultOptionType[] = [
  {
    label: "ascending",
    value: SortDirection.ASCENDING,
  },
  {
    label: "descending",
    value: SortDirection.DESCENDING,
  },
];

enum Difficulty {
  EASY = "easy",
  MEDIUM = "medium",
  HARD = "hard",
}

const DifficultyOption: DefaultOptionType[] = [
  { value: Difficulty.EASY },
  { value: Difficulty.MEDIUM },
  { value: Difficulty.HARD },
];

interface FormData {
  advanced?: boolean;
  mode: Difficulty;
  rules: FormRowData[];
}

export interface PlaylistFormProps {
  onSuccess: (playlist: PlaylistResponse) => void;
}

const PlaylistForm = ({ onSuccess }: PlaylistFormProps) => {
  const notify = useNotifyContext();
  const { makeRequest } = useAppContext();
  const { artistSort, tagSort, setArtistSort, setTagSort } = useTagContext();
  const [advanced, setAdvanced] = useState(getBool("advanced") ?? false);
  const [loading, setLoading] = useState(false);

  const submit = useCallback(
    async ({ advanced, mode, rules }: FormData) => {
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

      try {
        setLoading(true);
        const response = await makeRequest<PlaylistResponse>("radio", "POST", {
          mode,
          prompt,
        });

        if (response !== null) {
          notify.success({
            message: "Playlist successfully generated",
            description: response[0].name,
            placement: "top",
          });
          onSuccess(response);
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
    [makeRequest, notify, onSuccess]
  );

  const doSetAdvanced = useCallback((checked: boolean) => {
    setAdvanced(checked);
    setBool("advanced", checked);
  }, []);

  return (
    <Form<FormData> initialValues={{ rules: [{}] }} onFinish={submit}>
      <Row gutter={[16, 10]}>
        <Col span={24}>
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
                      Subsonic server of choice, to generate a playlist based
                      off of various criteria (genres, artists). To generate a
                      playlist, there are four steps:
                      <ol>
                        <li>
                          Select a "difficulty." This denotes how Troi will
                          select tracks based off of your queries. "Easy"
                          selects the most relevant data (e.g. for genres,
                          within the same genre), "Medium" in the middle
                          (related releases), and "Hard".
                        </li>
                        <li>
                          Add one or more criteria. These criteria obey the
                          following rules:
                          <ol>
                            <li>
                              If you have a single artist, your playlist will
                              use that singular artist as a starting point
                            </li>
                            <li>
                              If you have multiple artists, each artist will
                              contribute equally (unless yous et the weight)
                            </li>
                            <li>If you have a single genre, same story</li>
                            <li>
                              For genres, you can select multiple genres in one
                              rule. In this case, you can either require tracks
                              to have <b>all</b> of the genres, or <b>any</b> of
                              them
                            </li>
                            <li>
                              If you have multiple genre rules, then they will
                              apply separately to your playlist
                            </li>
                            <li>
                              In advanced mode, you can weigh rules to make
                              certain requirements more important than others
                            </li>
                          </ol>
                        </li>
                        <li>
                          Generate the playlist. After a few seconds, you will
                          have a playlist you can edit. Once you're happy, press
                          save and it will be saved to your server
                        </li>
                      </ol>
                    </Text>
                  </>
                ),
              },
            ]}
          ></Collapse>
        </Col>
        <Col lg={12} xs={24}>
          <Item label="Sort artist by">
            <Row>
              <Col span={12}>
                <Select
                  options={SORT_OPTIONS}
                  value={artistSort.type}
                  onChange={(type) =>
                    setArtistSort((existing) => ({
                      ...existing,
                      type,
                    }))
                  }
                />
              </Col>
              <Col span={12}>
                <Select
                  options={SORT_DIRECTION}
                  value={artistSort.direction}
                  onChange={(direction) =>
                    setArtistSort((existing) => ({
                      ...existing,
                      direction,
                    }))
                  }
                />
              </Col>
            </Row>
          </Item>
        </Col>
        <Col xl={8} lg={12} xs={24}>
          <Item label="Sort genres by">
            <Row>
              <Col span={12}>
                <Select
                  options={SORT_OPTIONS}
                  value={tagSort.type}
                  onChange={(type) =>
                    setTagSort((existing) => ({
                      ...existing,
                      type,
                    }))
                  }
                />
              </Col>
              <Col span={12}>
                <Select
                  options={SORT_DIRECTION}
                  value={tagSort.direction}
                  onChange={(direction) =>
                    setTagSort((existing) => ({
                      ...existing,
                      direction,
                    }))
                  }
                />
              </Col>
            </Row>
          </Item>
        </Col>
        <Col lg={12} xs={24}>
          <Item name="mode" label="Difficulty" rules={[{ required: true }]}>
            <Select options={DifficultyOption} />
          </Item>
        </Col>
        <Col lg={12} xs={24}>
          <Item
            name="advanced"
            label="Show advanced filters"
            initialValue={advanced}
          >
            <Switch value={advanced} onChange={doSetAdvanced} />
          </Item>
        </Col>
      </Row>
      <List name="rules">
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name }) => (
              <Row key={key}>
                <FormItem name={name} advanced={advanced} />
                {fields.length > 1 && (
                  <Col flex="none">
                    <Button
                      icon={<MinusCircleOutlined />}
                      onClick={() => remove(name)}
                    >
                      Remove
                    </Button>
                  </Col>
                )}
              </Row>
            ))}
            <Item style={{ marginTop: 16 }}>
              <Button
                type="dashed"
                onClick={() => add()}
                block
                icon={<PlusOutlined />}
              >
                Add rule
              </Button>
            </Item>
          </>
        )}
      </List>
      <Item>
        <Button type="primary" htmlType="submit" block loading={loading}>
          Submit
        </Button>
      </Item>
    </Form>
  );
};

export default PlaylistForm;
