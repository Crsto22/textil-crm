export type Conversation = {
  id: string;
  displayName: string;
  preview: string;
  time: string;
  initials: string;
  active: boolean;
  unreadCount?: number;
  waiting?: boolean;
};

export type MessageQuote = {
  id: string;
  direction: "INCOMING" | "OUTGOING" | "SYSTEM";
  body: string;
  messageType: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "MEDIA";
  deleted?: boolean;
};

export type ChatMessage = {
  id: string;
  status?: "accepted" | "sent" | "delivered" | "read" | "failed" | "deleted";
  type:
    | "date"
    | "system"
    | "incoming-file"
    | "outgoing-file"
    | "outgoing-audio"
    | "outgoing"
    | "incoming";
  text: string;
  time: string;
  audioUrl?: string;
  duration?: number;
  fileSize?: number;
  fileType?: string;
  fileUrl?: string;
  pageCount?: number;
  retryText?: string;
  retryFile?: File;
  replyTo?: MessageQuote | null;
  deleted?: boolean;
  aiGenerated?: boolean;
  relatedSaleId?: number | null;
};

export const conversations: Conversation[] = [];

export const initialMessagesByConversation: Record<string, ChatMessage[]> = {};

export const initialTimeline: ChatMessage[] = [];
