import { Form, Input, Button, Col } from "antd";
import { useCallback } from "react";
import { useNotifyContext } from "../contexts";
import { APIResponse, isError } from "../types";

const { Item } = Form;

interface LoginFormProps {
  onSuccess: () => void;
}

interface LoginType {
  username?: string;
  password?: string;
}

const LoginForm = ({ onSuccess }: LoginFormProps) => {
  const notify = useNotifyContext();

  const submit = useCallback(
    async ({ username, password }: LoginType) => {
      try {
        const result = await fetch("./api/login", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, password }),
        });

        const json = (await result.json()) as APIResponse<void>;
        if (isError(json)) {
          notify.error({
            description: "Failed to log in",
            message: json.error,
            placement: "top",
          });
        } else {
          onSuccess();
        }
      } catch (error) {
        notify.error({
          description: "Failed to log in",
          message: (error as Error).message,
          placement: "top",
        });
      }
    },
    [notify, onSuccess]
  );

  return (
    <Col span={12}>
      <Form<LoginType>
        onFinish={submit}
        autoComplete="off"
        wrapperCol={{ span: 16 }}
        labelCol={{ span: 8 }}
      >
        <Item<LoginType>
          label="Username"
          name="username"
          rules={[{ required: true }]}
        >
          <Input />
        </Item>
        <Item<LoginType>
          label="Password"
          name="password"
          rules={[{ required: true }]}
        >
          <Input type="password" />
        </Item>
        <Item wrapperCol={{ offset: 8, span: 16 }}>
          <Button type="primary" htmlType="submit">
            Log In
          </Button>
        </Item>
      </Form>
    </Col>
  );
};

export default LoginForm;
