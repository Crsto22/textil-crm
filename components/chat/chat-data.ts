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
  messageType: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "MEDIA" | "STICKER" | "VIEW_ONCE" | "LOCATION" | "UNSUPPORTED";
  deleted?: boolean;
};

export type ChatMessage = {
  id: string;
  status?: "accepted" | "sent" | "delivered" | "read" | "failed" | "deleted";
  type:
    | "date"
    | "system"
    | "incoming-file"
    | "incoming-audio"
    | "outgoing-file"
    | "outgoing-audio"
    | "outgoing"
    | "incoming";
  text: string;
  time: string;
  createdAt?: string | null;
  audioUrl?: string;
  duration?: number;
  fileSize?: number;
  fileType?: string;
  fileUrl?: string;
  caption?: string;
  pageCount?: number;
  retryText?: string;
  retryFile?: File;
  replyTo?: MessageQuote | null;
  deleted?: boolean;
  aiGenerated?: boolean;
  sentByUserId?: number | null;
  sentByName?: string | null;
  relatedSaleId?: number | null;
  sticker?: boolean;
  viewOnce?: boolean;
  location?: { latitude: number; longitude: number; name?: string | null; address?: string | null } | null;
  reactions?: Array<{ emoji: string; direction: "INCOMING" | "OUTGOING" }>;
};

export const conversations: Conversation[] = [];

export const initialMessagesByConversation: Record<string, ChatMessage[]> = {};

export const initialTimeline: ChatMessage[] = [];
