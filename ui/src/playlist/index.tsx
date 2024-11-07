import { Col, Tabs } from "antd";
import PlaylistForm from "./playlist-form";
import { useCallback, useState } from "react";
import { PlaylistResponse } from "../types";
import { PlaylistData } from "./playlist-result";

const Playlist = () => {
  const [data, setData] = useState<PlaylistResponse | null>(null);
  const [key, setKey] = useState("1");

  const onSuccess = useCallback((data: PlaylistResponse) => {
    setData(data);
    setKey("2");
  }, []);

  return (
    <Col xs={20}>
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
            children: data && <PlaylistData log={data[1]} playlist={data[0]} />,
          },
        ]}
        onChange={setKey}
      />
    </Col>
  );
};

export default Playlist;
