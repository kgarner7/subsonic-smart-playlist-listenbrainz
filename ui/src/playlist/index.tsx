import { Col, Tabs } from "antd";
import PlaylistForm from "./playlist-form";
import { useCallback, useState } from "react";
import { Playlist as PlaylistType } from "../types";
import { PlaylistData } from "./playlist-result";

const Playlist = () => {
  const [data, setData] = useState<PlaylistType | null>(null);
  const [key, setKey] = useState("1");

  const onSuccess = useCallback((data: PlaylistType) => {
    setData(data);
    setKey("2");
  }, []);

  return (
    <Col span={20}>
      <Tabs
        activeKey={key}
        centered
        items={[
          {
            key: "1",
            label: "Playlist generator",
            children: <PlaylistForm onSuccess={onSuccess} />,
          },
          {
            key: "2",
            label: "Generated playlist",
            disabled: !data,
            children: data && <PlaylistData playlist={data} />,
          },
        ]}
        onChange={setKey}
      />
    </Col>
  );
};

export default Playlist;
