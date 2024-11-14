import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Button,
  Col,
  Collapse,
  Form,
  Input,
  Row,
  Select,
  Switch,
  Table,
  TableColumnsType,
} from "antd";
import { strip } from "ansicolor";
import {
  HTMLAttributes,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Playlist, Recording } from "../types";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { useAppContext, useNotifyContext, useTagContext } from "../contexts";
import { DeleteOutlined } from "@ant-design/icons";
import { CreatePlaylist } from "./types";
import { DefaultOptionType } from "antd/es/select";

const { Item, useForm } = Form;

const durationToString = (duration: number): string => {
  const seconds = duration % 60;
  duration = Math.floor(duration / 60);
  const minutes = duration % 60;
  duration = Math.floor(duration / 60);
  const hours = duration % 24;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

interface RowProps extends HTMLAttributes<HTMLTableRowElement> {
  "data-row-key": string;
}

const RecordingRow: React.FC<Readonly<RowProps>> = (props) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: props["data-row-key"],
  });

  const style: React.CSSProperties = {
    ...props.style,
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { position: "relative", zIndex: 9999 } : {}),
  };

  return (
    <tr
      {...props}
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    />
  );
};

interface PlaylistWithName extends Playlist {
  existing: false;
}

interface PlaylistWithId extends Omit<Playlist, "name"> {
  existing: true;
  id: string;
}

type FormData =
  | Omit<PlaylistWithName, "recordings">
  | Omit<PlaylistWithId, "recordings">;

interface PlaylistState extends Playlist {
  id?: string;
}

export interface PlaylistDataProps {
  playlist: Playlist;
  log: string;
}

export const PlaylistData = ({ playlist, log }: PlaylistDataProps) => {
  const { showText, makeRequest } = useAppContext();
  const notify = useNotifyContext();
  const { playlists, setPlaylists } = useTagContext();
  const [form] = useForm<FormData>();
  const [data, setData] = useState<PlaylistState>(playlist);
  const [loading, setLoading] = useState(false);

  const existing = Form.useWatch("existing", form);

  const reset = useCallback(() => {
    setData(playlist);
    form.setFieldsValue({
      name: playlist.name,
      existing: false,
    });
  }, [form, playlist]);

  useEffect(() => {
    reset();
  }, [makeRequest, reset]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 1,
      },
    })
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (active.id !== over?.id) {
      setData((prev) => {
        if (!prev) return prev;

        const activeIndex = prev.recordings.findIndex(
          (i) => i.id === active.id
        );
        const overIndex = prev.recordings.findIndex((i) => i.id === over?.id);

        return {
          name: prev.name,
          recordings: arrayMove(prev.recordings, activeIndex, overIndex),
        };
      });
    }
  };

  const remove = useCallback((id: string) => {
    setData((data) => {
      return {
        name: data.name,
        recordings: data.recordings.filter((recording) => recording.id !== id),
      };
    });
  }, []);

  const logBody = useMemo(() => {
    return strip(log);
  }, [log]);

  const COLUMNS = useMemo(() => {
    const base: TableColumnsType<Recording> = [
      {
        title: "Image",
        dataIndex: "url",
        render: (val) => <img src={val} height={75} />,
      },
      {
        title: "Title",
        render: (_, recording) => (
          <div>
            <div>
              <strong>{recording.title}</strong>
            </div>
            {recording.release && <div>On: {recording.release.name}</div>}
            {recording.artists && (
              <div>
                By: {recording.artists.map((artist) => artist.name).join(" ⋅ ")}
              </div>
            )}
          </div>
        ),
      },
    ];

    if (!data.id) {
      base.push({
        title: "Actions",
        dataIndex: "id",
        render: (id) => (
          <Button
            color="danger"
            variant="solid"
            onClick={() => remove(id)}
            icon={<DeleteOutlined />}
          >
            {showText && "Remove"}
          </Button>
        ),
      });
    }

    return base;
  }, [data.id, remove, showText]);

  const playlistOptions = useMemo(() => {
    return playlists.map(
      (playlist): DefaultOptionType => ({
        label: `${playlist.name} (${playlist.songs} songs, ${durationToString(
          playlist.duration
        )})`,
        value: playlist.id,
      })
    );
  }, [playlists]);

  const submit = useCallback(
    async (formData: FormData) => {
      setLoading(true);
      try {
        const ids = data.recordings.map((recording) => recording.id);

        let body: CreatePlaylist;
        if (formData.existing === true) {
          body = { id: formData.id, ids };
        } else {
          body = { ids, name: formData.name };
        }

        const resp = await makeRequest<{ id: string }>(
          "createPlaylist",
          "POST",
          body
        );

        if (resp !== null) {
          setData((playlist) => ({
            ...playlist,
            id: resp.id,
          }));

          notify.success({
            message: "Successfully created playlist",
            placement: "top",
          });

          if (formData.existing) {
            const duration = data.recordings.reduce(
              (acc, recording) => acc + Math.round(recording.durationMs / 1000),
              0
            );

            setPlaylists((existing) =>
              existing.map((playlist) =>
                playlist.id === formData.id
                  ? {
                      name: playlist.name,
                      id: playlist.id,
                      songs: data.recordings.length,
                      duration,
                    }
                  : playlist
              )
            );
          }
        }
      } catch (error) {
        notify.error({
          message: "Failed to create playlist",
          description: (error as Error).message,
          placement: "top",
        });
      } finally {
        setLoading(false);
      }
    },
    [data.recordings, makeRequest, notify, setPlaylists]
  );

  return (
    <Form form={form} onFinish={submit}>
      <Item>
        <Collapse
          items={[
            {
              key: "data",
              label: "Logs",
              children: <pre className="logs">{logBody}</pre>,
            },
          ]}
        />
      </Item>
      {data.id && (
        <>
          <Item label="Your playlist name">{data.name}</Item>
          <Item label="Your playlist ID">{data.id}</Item>
        </>
      )}

      {!data.id && (
        <>
          <Item
            label="Use an existing playlist"
            name="existing"
            initialValue={false}
          >
            <Switch />
          </Item>
          {existing ? (
            <Item
              label="Existing playlist"
              name="id"
              rules={[{ required: true }]}
            >
              <Select options={playlistOptions} />
            </Item>
          ) : (
            <Item
              label="Playlist name"
              name="name"
              initialValue={playlist.name}
              rules={[{ required: true }]}
            >
              <Input readOnly={!!data.id} />
            </Item>
          )}
          <Row gutter={16}>
            <Col span={12}>
              <Item>
                <Button block onClick={reset}>
                  Reset
                </Button>
              </Item>
            </Col>
            <Col span={12}>
              <Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={loading}
                >
                  {existing ? "Update" : "Create"} Playlist
                </Button>
              </Item>
            </Col>
          </Row>
        </>
      )}
      <DndContext
        sensors={sensors}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={data.recordings.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
          disabled={!!data.id}
        >
          <div className={data.id ? "sortable" : ""}>
            <Table<Recording>
              components={{ body: { row: RecordingRow } }}
              rowKey="id"
              dataSource={data.recordings}
              columns={COLUMNS}
              pagination={false}
            />
          </div>
        </SortableContext>
      </DndContext>
    </Form>
  );
};
