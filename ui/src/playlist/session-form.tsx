import { Button, Col, Form, Row, Select } from "antd";
import { useCallback, useMemo, useState } from "react";

import { Session } from "../types";
import { SessionData } from "./types";
import { useAppContext, useNotifyContext, useTagContext } from "../contexts";

const { Item } = Form;

export interface SessionFormProps {
  sessions: Session[];
}

export const SessionForm = ({ sessions }: SessionFormProps) => {
  const { makeRequest } = useAppContext();
  const notify = useNotifyContext();
  const { setSessions } = useTagContext();
  const form = Form.useFormInstance<SessionData>();
  const session = Form.useWatch("session", form);

  const [loading, setLoading] = useState(false);

  const props = useMemo(
    () =>
      sessions.map((session) => ({
        label: `${session.name} (seen: ${session.seen})`,
        value: session.id,
      })),
    [sessions]
  );

  const deleteSession = useCallback(async () => {
    setLoading(true);
    const response = await makeRequest<Record<string, never>>(
      `session/${session}`,
      "DELETE"
    );
    if (response !== null) {
      notify.success({
        message: "Successfully deleted session",
        placement: "top",
      });

      setSessions((sessions) => sessions.filter((sess) => sess.id !== session));
    }
    form.resetFields(["session"]);
    setLoading(false);
  }, [form, makeRequest, notify, session, setSessions]);

  return (
    <Row className="potato" gutter={16}>
      <Col flex="auto">
        <Item
          name="session"
          label="Existing session"
          rules={[
            { required: true, message: "Please select an existing session" },
          ]}
        >
          <Select options={props} />
        </Item>
      </Col>
      {session && (
        <Col flex="none">
          <Button
            color="danger"
            variant="solid"
            onClick={deleteSession}
            loading={loading}
          >
            Delete Session
          </Button>
        </Col>
      )}
    </Row>
  );
};
