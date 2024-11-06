import { DefaultOptionType } from "antd/es/select";

declare global {
  interface Window {
    __authenticated__?: boolean;
  }
}

export interface APIError {
  error: string;
}

export type APIResponse<T> = T | APIError;

export function isError(t: unknown): t is APIError {
  return !!(t as APIError | undefined | null)?.error;
}

export interface ScanStatus {
  fetched: number;
  scanning: boolean;
}

export interface Tag {
  count: number;
  name: string;
}

export interface Artist {
  count: number
  mbid: string;
  name: string;
  subsonic_name: string | null;
}

export interface Tags {
  artists: Artist[];
  resolved_recordings: number;
  tags: Tag[];
}

export interface StartScan {
  started: boolean;
}

export enum SortType {
  FREQUENCY = "frequency",
  NAME = "name"
}

export enum SortDirection {
  ASCENDING = "ascending",
  DESCENDING = "descending",
}

export interface SortInfo {
  direction: SortDirection;
  type: SortType;
}

export interface TagInfo {
  artistSort: SortInfo;
  artists: DefaultOptionType[];
  tagSort: SortInfo;
  tags: DefaultOptionType[];
}

export interface Recording {
  artists?: Array<{ mbid: string; name: string }>;
  durationMs: number;
  id: string;
  mbid: string;
  release?: { mbid: string; name: string };
  title: string;
  url: string;
  year: number;
}

export interface Playlist {
  name: string;
  recordings: Recording[];
}

export type PlaylistResponse = [Playlist, string];