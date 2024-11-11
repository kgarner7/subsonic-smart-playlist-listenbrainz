import { Form, Select } from "antd";
import { useMemo } from "react";

import { Session } from "../types";

const { Item } = Form;

export interface SessionFormProps {
  sessions: Session[];
}

export const SessionForm = ({ sessions }: SessionFormProps) => {
  const props = useMemo(
    () =>
      sessions.map((session) => ({
        label: `${session.name} (seen: ${session.seen})`,
        value: session.id,
      })),
    [sessions]
  );

  return (
    <Item
      name="session"
      label="Existing session"
      rules={[{ required: true, message: "Please select an existing session" }]}
    >
      <Select options={props} />
    </Item>
  );
};
