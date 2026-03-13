export type Tone = "concise" | "friendly" | "structured" | "insightful";

export type Profile = {
  displayName: string;
  tone: Tone;
  locale: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

export type Brief = {
  topic: string;
  goal?: string;
  outline: string;
  brief: string;
  createdAt: string;
};

export type WorkflowStatus = {
  id?: string;
  status: "idle" | "running" | "complete" | "error";
  step?: string;
  message?: string;
  percent?: number;
};

export type AgentState = {
  profile: Profile;
  history: ChatMessage[];
  lastBrief?: Brief;
  workflow: WorkflowStatus;
  lastUpdatedAt: string;
};

export type Env = {
  AI: Ai;
  ASSETS: Fetcher;
  CompassAgent: DurableObjectNamespace;
  BRIEF_WORKFLOW: unknown;
};
