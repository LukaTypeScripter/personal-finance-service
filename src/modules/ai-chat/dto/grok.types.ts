export interface GrokChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GrokChatResponse {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
}
