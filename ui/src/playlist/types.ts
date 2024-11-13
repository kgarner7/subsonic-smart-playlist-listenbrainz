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
  session?: boolean;
  type: PromptType.PROMPT;
}

export interface Session {
  id: number;
  type: PromptType.SESSION;
}

export interface RadioCreate {
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
  session?: boolean;
  type: PromptType.PROMPT;
}

export type FormData = PromptData | SessionData;

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