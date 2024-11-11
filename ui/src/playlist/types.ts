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