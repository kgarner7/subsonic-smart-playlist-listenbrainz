import { NotificationInstance } from "antd/es/notification/interface";
import { createContext } from "react";

// @ts-expect-error It is required for this context to exist, but just make it null so no default has to be provided
export const NotifyContext = createContext<NotificationInstance>(null);
