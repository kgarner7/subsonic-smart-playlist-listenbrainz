import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Col, Form, Row, Select, Switch } from "antd";
import { DefaultOptionType } from "antd/es/cascader";
import { useCallback, useState } from "react";

import { useTagContext } from "../contexts";

import { SortType, SortDirection, SortInfo } from "../types";
import { getBool, setBool, setSort, SortKey } from "../util";

import { FormItem } from "./form-item";
import { Difficulty } from "./types";

const { Item, List } = Form;

const DifficultyOption: DefaultOptionType[] = [
  { value: Difficulty.EASY },
  { value: Difficulty.MEDIUM },
  { value: Difficulty.HARD },
];

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

export const PromptForm = () => {
  const { artistSort, tagSort, setArtistSort, setTagSort } = useTagContext();
  const [advanced, setAdvanced] = useState(getBool("advanced") ?? false);

  const doSetAdvanced = useCallback((checked: boolean) => {
    setAdvanced(checked);
    setBool("advanced", checked);
  }, []);

  const doArtistSort = useCallback(
    (data: Partial<SortInfo>) => {
      setArtistSort((existing) => {
        const final = { ...existing, ...data };
        setSort(SortKey.ARTIST, final);
        return final;
      });
    },
    [setArtistSort]
  );

  const doTagSort = useCallback(
    (data: Partial<SortInfo>) => {
      setTagSort((existing) => {
        const final = { ...existing, ...data };
        setSort(SortKey.ARTIST, final);
        return final;
      });
    },
    [setTagSort]
  );

  return (
    <>
      <Row gutter={[16, 10]}>
        <Col span={24}></Col>
        <Col lg={12} xs={24}>
          <Item label="Sort artist by">
            <Row>
              <Col span={12}>
                <Select
                  options={SORT_OPTIONS}
                  value={artistSort.type}
                  onChange={(type) => doArtistSort({ type })}
                />
              </Col>
              <Col span={12}>
                <Select
                  options={SORT_DIRECTION}
                  value={artistSort.direction}
                  onChange={(direction) => doArtistSort({ direction })}
                />
              </Col>
            </Row>
          </Item>
        </Col>
        <Col lg={12} xs={24}>
          <Item label="Sort genres by">
            <Row>
              <Col span={12}>
                <Select
                  options={SORT_OPTIONS}
                  value={tagSort.type}
                  onChange={(type) => doTagSort({ type })}
                />
              </Col>
              <Col span={12}>
                <Select
                  options={SORT_DIRECTION}
                  value={tagSort.direction}
                  onChange={(direction) => doTagSort({ direction })}
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
    </>
  );
};
