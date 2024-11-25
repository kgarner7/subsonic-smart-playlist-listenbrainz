export enum FormItemType {
  ARTIST = "artist",
  GENRE = "genre",
}
  
export enum Difficulty {
  EASY = "easy",
  MEDIUM = "medium",
  HARD = "hard",
}

export enum PromptType {
  PROMPT = "prompt",
  SESSION = "session",
}

export interface FormArtistData {
  type: FormItemType.ARTIST;
  artist: string;
  similar?: boolean;
  weight?: number;
}

export enum GenreMode {
  ALL = "and",
  ANY = "or",
}

export interface FormGenreData {
  type: FormItemType.GENRE;
  genre: string[];
  weight?: number;
  join?: GenreMode;
  similar?: boolean;
}

export type FormRowData = FormArtistData | FormGenreData;

export interface Prompt {
  mode: Difficulty;
  prompt: string;
  type: PromptType.PROMPT;
}

export interface Session {
  id: number;
  type: PromptType.SESSION;
}

export interface RadioCreate {
  excluded_mbids: string[]
  prompt: Prompt | Session;
}

export interface SessionData {
  session: number;
  type: PromptType.SESSION;
}

export interface PromptData {
  advanced?: boolean;
  mode: Difficulty;
  rules: FormRowData[];
  type: PromptType.PROMPT;
}

export type FormData = PromptData | SessionData ;

export interface ExistingPlaylist {
  duration: number;
  id: string;
  name: string;
  songs: number;
}

export interface CreatePlaylistFromName {
  name: string;
  ids: string[];
}

export interface UpdatePlaylistById {
  id: string;
  ids: string[];
}

export type CreatePlaylist = CreatePlaylistFromName | UpdatePlaylistById;

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
  id?: string;
  name: string;
  recordings: Recording[];
  session?: number | null;
}

export type PlaylistResponse = {
  log: string;
  playlist: Playlist;
}

export interface PlaylistState extends PlaylistResponse {
  prompt: RadioCreate;
}
