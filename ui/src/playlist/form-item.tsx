import { Col, Select, Form, InputNumber, Checkbox } from "antd";
import { DefaultOptionType } from "antd/es/select";
import { useTagContext } from "../contexts";
import {
  FormArtistData,
  FormGenreData,
  FormItemType,
  FormRowData,
  GenreMode,
} from "./types";

const { Item, useFormInstance, useWatch } = Form;

export interface FormItemProps {
  advanced: boolean;
  name: number;
}

const items: DefaultOptionType[] = [
  {
    label: "Artist",
    value: FormItemType.ARTIST,
  },
  {
    label: "Genre",
    value: FormItemType.GENRE,
  },
];

const GENRE_MODES: DefaultOptionType[] = [
  { label: "Select recordings with ALL of these tags", value: GenreMode.ALL },
  { label: "Select recordings with ANY of these tags", value: GenreMode.ANY },
];

export const FormItem = ({ advanced, name }: FormItemProps) => {
  const form = useFormInstance();
  const tags = useTagContext();
  const type = useWatch(["rules", name, "type"], form);

  return (
    <>
      <Col flex="none">
        <Item<FormRowData["type"]>
          name={[name, "type"]}
          rules={[{ required: true }]}
        >
          <Select<FormRowData["type"]>
            options={items}
            placeholder="Select a rule"
            showSearch
          />
        </Item>
      </Col>
      <Col className="artist-tag" flex="auto">
        {type === FormItemType.ARTIST && (
          <Item<FormArtistData["artist"]>
            name={[name, "artist"]}
            rules={[{ required: true }]}
          >
            <Select
              options={tags.artists}
              optionFilterProp="label"
              placeholder="Select an artist"
              showSearch
            />
          </Item>
        )}
        {type === FormItemType.GENRE && (
          <Item<FormGenreData["genre"]>
            name={[name, "genre"]}
            rules={[{ required: true }]}
          >
            <Select
              mode="multiple"
              options={tags.tags}
              optionFilterProp="label"
              placeholder="Select one or more artists"
              showSearch
            />
          </Item>
        )}
      </Col>
      {advanced && type && (
        <>
          <Col flex="100px">
            <Item<FormRowData["weight"]> name={[name, "weight"]}>
              <InputNumber
                className="number-input"
                min={1}
                placeholder="Weight"
                step={1}
              />
            </Item>
          </Col>
          {type === FormItemType.GENRE && (
            <Col flex="320px">
              <Item<FormGenreData["join"]>
                name={[name, "join"]}
                initialValue={GenreMode.ALL}
              >
                <Select<FormGenreData["join"]>
                  options={GENRE_MODES}
                  placeholder="How to handle multiple genres"
                />
              </Item>
            </Col>
          )}

          <Col className="allow-sim" flex="180px">
            <Item<FormRowData["similar"]>
              name={[name, "similar"]}
              valuePropName="checked"
              initialValue={true}
            >
              <Checkbox>Allow similar {type}s</Checkbox>
            </Item>
          </Col>
        </>
      )}
    </>
  );
};
