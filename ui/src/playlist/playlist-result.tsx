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
import { useAppContext, useNotifyContext } from "../contexts";
import { DeleteOutlined } from "@ant-design/icons";

const { Item, useForm } = Form;

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

interface PlaylistWithId extends Playlist {
  id?: string;
}

export interface PlaylistDataProps {
  playlist: Playlist;
  log: string;
}

type FormData = Omit<PlaylistWithId, "recordings">;

export const PlaylistData = ({ playlist, log }: PlaylistDataProps) => {
  const { showText, makeRequest } = useAppContext();
  const notify = useNotifyContext();
  const [form] = useForm<FormData>();
  const [data, setData] = useState<PlaylistWithId>(playlist);
  const [loading, setLoading] = useState(false);

  const reset = useCallback(() => {
    setData(playlist);
    form.setFieldsValue({
      name: playlist.name,
      id: undefined,
    });
  }, [form, playlist]);

  useEffect(() => {
    reset();
  }, [reset]);

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

  const submit = useCallback(
    async (formData: FormData) => {
      setLoading(true);
      try {
        const resp = await makeRequest<{ id: string }>(
          "createPlaylist",
          "POST",
          {
            ids: data.recordings.map((recording) => recording.id),
            name: formData.name,
          }
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

          console.log(resp.id);
          form.setFieldValue("id", resp.id);
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
    [data.recordings, form, makeRequest, notify]
  );

  return (
    <Form form={form} onFinish={submit}>
      <Item>
        <Collapse
          items={[
            { key: "data", label: "Logs", children: <pre>{logBody}</pre> },
          ]}
        />
      </Item>
      <Item
        label="Playlist name"
        name="name"
        initialValue={playlist.name}
        rules={[{ required: true }]}
      >
        <Input readOnly={!!data.id} />
      </Item>
      {data.id && (
        <Item label="Playlist ID">
          <Input readOnly value={data.id} />
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
            <Button type="primary" htmlType="submit" block loading={loading}>
              Create Playlist
            </Button>
          </Item>
        </Col>
      </Row>
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
