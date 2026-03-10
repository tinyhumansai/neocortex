export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface Conversation {
  id: string;
  title: string;
  model: string;
  updatedAt: string;
  _count?: { messages: number };
}

export interface Model {
  id: string;
  name: string;
  description: string;
  contextWindow: number;
}
