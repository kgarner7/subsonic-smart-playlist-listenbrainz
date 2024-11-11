import { createContext, Dispatch, SetStateAction } from "react";
import { Session, SortInfo, TagInfo } from "../types";

export interface TagContextProps extends TagInfo {
  setArtistSort: Dispatch<SetStateAction<SortInfo>>;
  setTagSort: Dispatch<SetStateAction<SortInfo>>;

  sessions: Session[];
  setSessions: Dispatch<SetStateAction<Session[]>>;
}

// @ts-expect-error It is required for this context to exist, but just make it null so no default has to be provided
export const TagContext = createContext<TagContextProps>(null);
