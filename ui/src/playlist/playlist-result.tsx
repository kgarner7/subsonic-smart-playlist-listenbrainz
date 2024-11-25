import {
  CloudUploadOutlined,
  DeleteOutlined,
  RedoOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { strip } from "ansicolor";
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
import { DefaultOptionType } from "antd/es/select";
import {
  HTMLAttributes,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAppContext, useNotifyContext, useTagContext } from "../contexts";
import { CreatePlaylist, Playlist, PlaylistState, Recording } from "./types";

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

interface PlaylistDataProps extends Omit<PlaylistState, "prompt"> {
  retryLoading: boolean;
  retry: (excludedMbids: string[]) => Promise<void>;
  saveAsSession: () => void;
  updatePlaylist: (playlist: Playlist) => void;
}

const REMAINING_REGEX = /HatedRecordingsFilterElement\s+(\d+)/;

export const PlaylistData = ({
  log,
  playlist,
  retryLoading,
  retry,
  saveAsSession,
  updatePlaylist,
}: PlaylistDataProps) => {
  const { showText, makeRequest } = useAppContext();
  const notify = useNotifyContext();
  const { playlists, setPlaylists } = useTagContext();
  const [form] = useForm<FormData>();
  const [data, setData] = useState<Playlist>(playlist);
  const [loading, setLoading] = useState(false);

  const existing = Form.useWatch("existing", form);
  const existingId = Form.useWatch("id", form);

  const canRetry = useMemo(() => {
    if (playlist.session) return false;

    const match = REMAINING_REGEX.exec(log);
    if (match) {
      const count = parseInt(match[1], 10);
      return count > 50;
    } else {
      console.error(`No HatedRecording match for ${log}`);
    }

    return false;
  }, [log, playlist.session]);

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
              existing.map((pls) => {
                if (pls.id === formData.id) {
                  const newPlaylist = {
                    name: pls.name,
                    id: pls.id,
                    songs: data.recordings.length,
                    duration,
                  };

                  updatePlaylist({
                    ...newPlaylist,
                    recordings: playlist.recordings,
                  });
                  return newPlaylist;
                } else {
                  return pls;
                }
              })
            );
          } else {
            updatePlaylist({ ...playlist, id: resp.id });
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
    [
      data.recordings,
      makeRequest,
      notify,
      playlist,
      setPlaylists,
      updatePlaylist,
    ]
  );

  const doRetry = useCallback(async () => {
    const excludes = playlist.recordings.map((r) => r.mbid);
    await retry(excludes);
  }, [playlist, retry]);

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
          {canRetry && (
            <Item>
              <Button
                block
                type="primary"
                loading={loading}
                onClick={saveAsSession}
              >
                Save as session
              </Button>
            </Item>
          )}
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
            <Col flex="auto">
              <Item>
                <Button block onClick={reset} icon={<UndoOutlined />}>
                  Undo changes to selected tracks
                </Button>
              </Item>
            </Col>
            {playlist.recordings.length === 50 && (
              <Col flex="auto">
                <Item>
                  <Button
                    block
                    onClick={doRetry}
                    loading={loading || retryLoading}
                    icon={<RedoOutlined />}
                  >
                    Retry, excluding current tracks
                  </Button>
                </Item>
              </Col>
            )}
            <Col flex="auto">
              <Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={loading || retryLoading}
                  icon={<CloudUploadOutlined />}
                  disabled={existing && !existingId}
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
          <div className={data.id ? "" : "sortable"}>
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
