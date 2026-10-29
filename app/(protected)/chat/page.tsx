"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  type UIEvent as ReactUIEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowUturnLeftIcon,
  ArrowPathIcon,
  ArrowPathRoundedSquareIcon,
  BackspaceIcon,
  BoltIcon,
  ChatBubbleLeftRightIcon,
  ChevronDownIcon,
  ShoppingBagIcon,
  DocumentPlusIcon,
  ArrowDownTrayIcon,
  PhotoIcon,
  PlusIcon,
  PaperAirplaneIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  MicrophoneIcon,
  DocumentIcon,
  EnvelopeIcon,
  UserPlusIcon,
  FaceSmileIcon,
  CheckIcon,
  HeartIcon,
  HandRaisedIcon,
  PauseIcon,
  PlayIcon,
  SparklesIcon,
  SwatchIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { UserIcon as UserIconSolid } from "@heroicons/react/24/solid";
import { Keyboard } from "lucide-react";
import { useTheme } from "next-themes";
import type { EmojiClickData } from "emoji-picker-react";
import { EmojiStyle, SuggestionMode, Theme } from "emoji-picker-react";
import type { PDFDocumentLoadingTask, RenderTask } from "pdfjs-dist";
import { toast } from "sonner";

import { ChatAvatar } from "@/components/chat/ChatAvatar";
import { ChatDateSeparator } from "@/components/chat/ChatDateSeparator";
import { AuthenticatedImageThumbnail } from "@/components/chat/AuthenticatedImageThumbnail";
import type { ChatMessage, Conversation } from "@/components/chat/chat-data";
import { ChatWallpaperLayer } from "@/components/chat/ChatWallpaperLayer";
import { ChatConversationSkeletons, ChatMessageSkeletons } from "@/components/chat/ChatLoadingSkeletons";
import { ChatSidebar, type ChatSidebarPanel } from "@/components/chat/ChatSidebar";
import type { GalleryRealtimePayload } from "@/components/chat/ConversationGalleryPanel";
import { ShippingChatPanel } from "@/components/chat/ShippingChatPanel";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth/auth-fetch";
import { useAuth } from "@/lib/auth/auth-context";
import { isCrmAdmin, isWarehouseOnlyUser, isWarehouseUser } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { QuickMessage } from "@/lib/crm/quick-messages";
import { readQuickMessageApiError } from "@/lib/crm/quick-messages";
import {
  conversationDayKey,
  formatConversationDayLabel,
  formatConversationListDate,
} from "@/lib/crm/conversation-date";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
});

const MESSAGE_TEXTAREA_MAX_HEIGHT = 136;
const AUDIO_WAVEFORM_BARS = [10, 18, 14, 24, 16, 30, 20, 12, 26, 18, 32, 14, 24, 16];
const CRM_WHATSAPP_MEDIA_MAX_BYTES = 10 * 1024 * 1024;
const CRM_WHATSAPP_MEDIA_MAX_LABEL = "10 MB";
const CONVERSATION_PAGE_SIZE = 10;
const MESSAGE_PAGE_SIZE = 10;
const MESSAGE_CACHE_LIMIT = 5;

type ConversationStatus = "ESPERA" | "ATENDIDO" | "RESUELTO";
type AttentionQueue = "AGENT_ACTIVE" | "ADVISOR_REQUIRED" | "HUMAN_ACTIVE" | "RESOLVED";
type WaitingReason = "ADVISOR_REQUIRED";
type ConversationFilter = "all" | "mine" | "agent" | "waiting" | "resolved";

type CrmConversation = Conversation & {
  phone: string;
  phoneLabel: string;
  contactName: string | null;
  whatsappUsername: string | null;
  status: ConversationStatus;
  lastMessageAt: string | null;
  assignedUserId: number | null;
  assignedUserName: string | null;
  assignedAt: string | null;
  attentionQueue: AttentionQueue;
  waitingReason: WaitingReason | null;
  waitingDetail: string | null;
  agentState: string | null;
  reservationExpiresAt: string | null;
  tags: ConversationTag[];
  lastMessageType: CrmMessageResponse["messageType"] | null;
};

interface CrmConversationResponse {
  id: number;
  area: "SALES" | "SHIPPING";
  phone: string;
  phoneNumber: string | null;
  whatsappUsername: string | null;
  contactName: string | null;
  status: ConversationStatus;
  lastMessage: string | null;
  lastMessageType?: CrmMessageResponse["messageType"] | null;
  lastMessageAt: string | null;
  unreadCount: number;
  assignedUserId: number | null;
  assignedUserName: string | null;
  assignedAt: string | null;
  attentionQueue?: AttentionQueue | null;
  waitingReason?: WaitingReason | null;
  waitingDetail?: string | null;
  agentState?: string | null;
  reservationExpiresAt?: string | null;
  tags?: CrmConversationTagResponse[] | null;
}

interface EnableAgentResponse {
  conversation: CrmConversationResponse;
  pendingCustomerMessage: boolean;
}

interface ConversationPageResponse {
  content: CrmConversationResponse[];
  page: number;
  size: number;
  totalPages: number;
  totalElements: number;
  numberOfElements: number;
  first: boolean;
  last: boolean;
  empty: boolean;
    counts: {
      all: number;
      attended: number;
      agent: number;
      waiting: number;
      resolved: number;
      mine: number;
  };
}

interface CrmTagResponse {
  id: number;
  nombre: string;
  color: string;
  uso: number;
}

interface CrmConversationTagResponse {
  id: number;
  label: string;
  color: string;
}

interface CrmMessageResponse {
  id: number;
  direction: "INCOMING" | "OUTGOING" | "SYSTEM";
  origin?: "EXTERNAL" | "HUMAN" | "CRM_SYSTEM" | "CRM_ACTIVITY" | "AI_KIMENTS";
  messageType: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "MEDIA" | "STICKER" | "VIEW_ONCE" | "LOCATION" | "UNSUPPORTED";
  body: string | null;
  status: ChatMessage["status"];
  createdAt: string | null;
  mediaMimeType?: string | null;
  mediaFileName?: string | null;
  mediaStoragePath?: string | null;
  mediaUrl?: string | null;
  replyTo?: {
    id: number;
    direction: "INCOMING" | "OUTGOING" | "SYSTEM";
    body: string | null;
    messageType: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "MEDIA" | "STICKER" | "VIEW_ONCE" | "LOCATION" | "UNSUPPORTED";
    deleted?: boolean;
  } | null;
  deleted?: boolean;
  relatedSaleId?: number | null;
  sentByUserId?: number | null;
  sentByName?: string | null;
  location?: { latitude: number; longitude: number; name?: string | null; address?: string | null } | null;
  reactions?: Array<{ emoji: string; direction: "INCOMING" | "OUTGOING" }>;
}

interface MessagePageResponse {
  content: CrmMessageResponse[];
  oldestId: number | null;
  newestId: number | null;
  hasMoreBefore: boolean;
}

interface CrmRealtimeEvent {
  type: "conversation.updated" | "conversation.removed" | "message.created" | "message.updated" | "message.deleted"
    | "payment.evidence.processing" | "payment.evidence.updated" | "payment.request.updated" | "payment.request.completed"
    | "whatsapp.connection.updated";
  conversationId: number;
  connectionId?: string;
  conversation?: CrmConversationResponse;
  message?: CrmMessageResponse | null;
  status?: string;
  reason?: string;
  waitingReason?: WaitingReason;
  connection?: WhatsappConnectionState;
  data?: unknown;
}

interface WhatsappConnectionState {
  clientId: string;
  status: "INITIALIZING" | "QR_REQUIRED" | "CONNECTED" | "DISCONNECTED" | "AUTH_FAILURE" | "UNKNOWN";
  connectedNumber: string | null;
  previousConnectedNumber: string | null;
  phoneChanged: boolean;
  changeAcknowledged: boolean;
  operationsBlocked?: boolean;
  blockedReason: string;
  disconnectedAt: string | null;
  phoneChangedAt: string | null;
}

interface MessageCacheMeta {
  oldestId: number | null;
  newestId: number | null;
  hasMoreBefore: boolean;
}

interface ConversationCacheEntry {
  items: CrmConversation[];
  counts: ConversationPageResponse["counts"];
  totalElements: number;
}

interface TransferUserResponse {
  id: number;
  name: string;
  role: string;
  email: string;
}

const formatAudioDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getTimestamp = () => new Date().getTime();

const formatChatTime = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit" }).format(date);
};

const getInitials = (name: string | null, phone: string) => {
  const source = (name || phone || "CL").trim();
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
};

const getContactDisplayName = (name: string | null, phone: string) => {
  return (name || phone || "Cliente").trim();
};

const getConversationContactValue = (conversation: CrmConversationResponse) =>
  conversation.phoneNumber?.trim() || conversation.whatsappUsername?.trim() || "Numero no disponible";

const getConversationContactLabel = (conversation: Pick<CrmConversation, "phone" | "phoneLabel"> | null) =>
  conversation?.phoneLabel || "Numero";

const mapConversation = (conversation: CrmConversationResponse): CrmConversation => {
  const visiblePhone = getConversationContactValue(conversation);
  const phoneLabel = conversation.phoneNumber?.trim()
    ? "Numero"
    : conversation.whatsappUsername?.trim()
      ? "Nombre de usuario"
      : "Numero";

  return {
    id: String(conversation.id),
    displayName: getContactDisplayName(conversation.contactName, visiblePhone),
    phone: visiblePhone,
    phoneLabel,
    contactName: conversation.contactName,
    whatsappUsername: conversation.whatsappUsername,
    status: conversation.status,
    preview: conversation.lastMessage || "Sin mensajes",
    lastMessageType: conversation.lastMessageType ?? null,
    time: formatConversationListDate(conversation.lastMessageAt),
    initials: getInitials(conversation.contactName, visiblePhone),
    active: false,
    unreadCount: conversation.unreadCount || undefined,
    waiting: conversation.attentionQueue === "ADVISOR_REQUIRED",
    lastMessageAt: conversation.lastMessageAt,
    assignedUserId: conversation.assignedUserId,
    assignedUserName: conversation.assignedUserName,
    assignedAt: conversation.assignedAt,
    attentionQueue: conversation.attentionQueue
      ?? (conversation.status === "RESUELTO" ? "RESOLVED"
        : conversation.assignedUserId ? "HUMAN_ACTIVE" : "ADVISOR_REQUIRED"),
    waitingReason: conversation.waitingReason ?? null,
    waitingDetail: conversation.waitingDetail ?? null,
    agentState: conversation.agentState ?? null,
    reservationExpiresAt: conversation.reservationExpiresAt ?? null,
    tags: (conversation.tags ?? []).map(mapConversationTag),
  };
};

const mapCrmTag = (tag: CrmTagResponse): ConversationTag => ({
  id: String(tag.id),
  label: tag.nombre,
  color: tag.color,
});

const mapConversationTag = (tag: CrmConversationTagResponse): ConversationTag => ({
  id: String(tag.id),
  label: tag.label,
  color: tag.color,
});

const mapMessage = (
  message: CrmMessageResponse,
  mediaObjectUrl?: string,
): ChatMessage => {
  if (message.direction === "SYSTEM") {
    return {
      id: String(message.id),
      type: "system",
      text: message.body || "",
      time: formatChatTime(message.createdAt),
      createdAt: message.createdAt,
      status: message.status || "sent",
      deleted: Boolean(message.deleted),
      relatedSaleId: message.relatedSaleId ?? null,
      sentByUserId: message.sentByUserId ?? null,
      sentByName: message.sentByName ?? null,
    };
  }

  const isViewOnce = message.messageType === "VIEW_ONCE";
  const isSticker = message.messageType === "STICKER";
  const hasMedia = !isViewOnce && Boolean(message.mediaUrl || message.mediaFileName
    || ["IMAGE", "VIDEO", "AUDIO", "DOCUMENT", "MEDIA", "STICKER"].includes(message.messageType));
  const isAudioContent =
    message.messageType === "AUDIO" ||
    isAudioFile(message.mediaMimeType || undefined, message.mediaFileName || undefined);
  const isOutgoingAudio = message.direction === "OUTGOING" && isAudioContent;
  const isIncomingAudio = message.direction === "INCOMING" && isAudioContent;
  const mediaFileName = message.mediaFileName?.trim() || "";
  const bodyText = message.body?.trim() || "";
  const mediaCaption = hasMedia && bodyText && bodyText !== mediaFileName ? bodyText : "";

  return {
    id: String(message.id),
    type: isViewOnce
      ? message.direction === "INCOMING" ? "incoming" : "outgoing"
      : isOutgoingAudio
      ? "outgoing-audio"
      : isIncomingAudio
      ? "incoming-audio"
      : hasMedia
      ? message.direction === "INCOMING"
        ? "incoming-file"
        : "outgoing-file"
      : message.direction === "INCOMING"
        ? "incoming"
        : "outgoing",
    text: isViewOnce
      ? "No se puede abrir este mensaje porque fue enviado para ver una sola vez."
      : hasMedia ? mediaFileName || bodyText : bodyText,
    time: formatChatTime(message.createdAt),
    createdAt: message.createdAt,
    status: message.status || "sent",
    fileType: message.mediaMimeType || undefined,
    fileUrl: mediaObjectUrl ?? message.mediaUrl ?? undefined,
    audioUrl: isOutgoingAudio || isIncomingAudio ? mediaObjectUrl ?? message.mediaUrl ?? undefined : undefined,
    caption: mediaCaption || undefined,
    replyTo: message.replyTo
      ? {
          id: String(message.replyTo.id),
          direction: message.replyTo.direction,
          body: message.replyTo.body || "Mensaje",
          messageType: message.replyTo.messageType,
          deleted: message.replyTo.deleted,
        }
      : null,
    deleted: Boolean(message.deleted),
    sentByUserId: message.sentByUserId ?? null,
    sentByName: message.sentByName ?? null,
    sticker: isSticker,
    viewOnce: isViewOnce,
    location: message.location ?? null,
    reactions: message.reactions ?? [],
  };
};

const buildReplyQuote = (message: ChatMessage): ChatMessage["replyTo"] => ({
  id: message.id,
  direction: message.type.startsWith("outgoing") ? "OUTGOING" : "INCOMING",
  body: message.deleted ? "Mensaje eliminado" : message.caption || message.text,
  messageType: message.type.includes("file") ? "DOCUMENT" : message.type.includes("audio") ? "AUDIO" : "TEXT",
  deleted: message.deleted,
});

const isLocalTransientMessage = (message: ChatMessage) =>
  message.id.startsWith("pending-") ||
  message.id.startsWith("file-pending-") ||
  message.status === "accepted" ||
  message.status === "failed";

const dedupeMessages = (items: ChatMessage[]) =>
  Array.from(new Map(items.map((message) => [message.id, message])).values());

const replaceMessageAndDedupe = (
  items: ChatMessage[],
  previousId: string,
  replacement: ChatMessage,
) => dedupeMessages(items.map((message) =>
  message.id === previousId || message.id === replacement.id ? replacement : message,
));

async function readApiMessage(response: Response, fallback: string) {
  try {
    const data = await response.json();
    return typeof data.message === "string" ? data.message : fallback;
  } catch {
    return fallback;
  }
}

function useAuthenticatedBlobUrl(source: string | undefined, enabled: boolean) {
  const [blobUrl, setBlobUrl] = useState<string>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!source || source.startsWith("blob:") || !enabled) return;

    const controller = new AbortController();
    let createdUrl: string | undefined;
    void authFetch(source, { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`No se pudo cargar el archivo (${response.status})`);
        return response.blob();
      })
      .then((blob) => {
        if (controller.signal.aborted) return;
        if (blob.size === 0 || blob.type.includes("application/json")) {
          throw new Error("El servidor no devolvio un archivo valido");
        }
        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
        setError(false);
      })
      .catch((loadError) => {
        if (controller.signal.aborted) return;
        console.error("[CRM_CHAT_MEDIA]", loadError);
        setError(true);
      });

    return () => {
      controller.abort();
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [attempt, enabled, source]);

  return {
    url: source?.startsWith("blob:") ? source : blobUrl,
    error,
    retry: () => {
      setError(false);
      setAttempt((current) => current + 1);
    },
  };
}

async function openAuthenticatedMedia(source: string, fileName: string, download: boolean) {
  if (source.startsWith("blob:")) {
    if (download) {
      const anchor = document.createElement("a");
      anchor.href = source;
      anchor.download = fileName;
      anchor.click();
    } else {
      window.open(source, "_blank", "noopener,noreferrer");
    }
    return;
  }

  const previewWindow = download ? null : window.open("", "_blank");
  const response = await authFetch(source, { cache: "force-cache" });
  if (!response.ok) {
    previewWindow?.close();
    throw new Error(await readApiMessage(response, "No se pudo abrir el archivo"));
  }
  const objectUrl = URL.createObjectURL(await response.blob());
  if (download) {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.click();
  } else if (previewWindow) {
    previewWindow.location.href = objectUrl;
  }
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
}

type ConversationTag = {
  id: string;
  label: string;
  color: string;
};

const TAG_COLORS = [
  { value: "#3b82f6", label: "Azul", bg: "bg-blue-500", text: "text-white" },
  { value: "#22c55e", label: "Verde", bg: "bg-green-500", text: "text-white" },
  { value: "#ef4444", label: "Rojo", bg: "bg-red-500", text: "text-white" },
  { value: "#eab308", label: "Amarillo", bg: "bg-yellow-500", text: "text-white" },
  { value: "#a855f7", label: "Morado", bg: "bg-purple-500", text: "text-white" },
  { value: "#f97316", label: "Naranja", bg: "bg-orange-500", text: "text-white" },
  { value: "#ec4899", label: "Rosa", bg: "bg-pink-500", text: "text-white" },
  { value: "#14b8a6", label: "Turquesa", bg: "bg-teal-500", text: "text-white" },
];

type PendingAttachment = {
  id: string;
  file?: File;
  name: string;
  objectUrl: string;
  size: number;
  type: string;
};

const isPdfAttachment = (attachment: PendingAttachment) =>
  attachment.type === "application/pdf" ||
  attachment.name.toLowerCase().endsWith(".pdf");

const isPdfFile = (fileType?: string, fileName?: string) =>
  fileType === "application/pdf" || fileName?.toLowerCase().endsWith(".pdf");

const getAttachmentPdfPreviewBounds = () => {
  if (typeof window === "undefined") {
    return { maxWidth: 420, maxHeight: 500 };
  }

  return {
    maxWidth: Math.min(420, Math.max(260, window.innerWidth - 48)),
    maxHeight: Math.min(500, Math.max(240, window.innerHeight - 280)),
  };
};

const isImageFile = (fileType?: string, fileName?: string) =>
  Boolean(fileType?.startsWith("image/")) ||
  /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(fileName ?? "");

const isVideoFile = (fileType?: string, fileName?: string) =>
  Boolean(fileType?.startsWith("video/")) ||
  /\.(3gp|avi|m4v|mkv|mov|mp4|mpeg|mpg|ogg|ogv|webm)$/i.test(fileName ?? "");

const isAudioFile = (fileType?: string, fileName?: string) =>
  Boolean(fileType?.startsWith("audio/")) ||
  /^audio-\d+\.(ogg|opus|webm|m4a|mp3|wav)$/i.test(fileName ?? "");

const getBestAudioMimeType = () => {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/ogg;codecs=opus",
    "audio/webm;codecs=opus",
    "audio/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
};

const getAudioFileExtension = (mimeType: string) => {
  if (mimeType.includes("ogg") || mimeType.includes("opus")) return "ogg";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("mp4")) return "m4a";
  return "ogg";
};

const getFileExtension = (fileName: string) => {
  const extension = fileName.split(".").pop();

  if (!extension || extension === fileName) {
    return "FILE";
  }

  return extension.slice(0, 4).toUpperCase();
};

const getFileBadge = (fileName: string, fileType?: string) => {
  const normalizedName = fileName.toLowerCase();
  const normalizedType = fileType?.toLowerCase() ?? "";

  if (
    normalizedType.includes("word") ||
    /\.(doc|docx)$/i.test(normalizedName)
  ) {
    return {
      className: "bg-blue-600 text-white",
      label: "DOC",
    };
  }

  if (
    normalizedType.includes("excel") ||
    normalizedType.includes("spreadsheet") ||
    /\.(xls|xlsx|csv)$/i.test(normalizedName)
  ) {
    return {
      className: "bg-emerald-600 text-white",
      label: "XLS",
    };
  }

  if (
    normalizedType.includes("powerpoint") ||
    normalizedType.includes("presentation") ||
    /\.(ppt|pptx)$/i.test(normalizedName)
  ) {
    return {
      className: "bg-orange-600 text-white",
      label: "PPT",
    };
  }

  return {
    className: "bg-slate-500 text-white",
    label: getFileExtension(fileName),
  };
};

const mobileEmojiCategories = [
  {
    id: "smileys",
    label: "Caras",
    icon: FaceSmileIcon,
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "🥹", "😅", "😂",
      "🤣", "🥲", "😊", "☺️", "😇", "🙂", "🙃", "😉",
      "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋",
      "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎",
      "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁",
      "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭",
      "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱",
    ],
  },
  {
    id: "gestures",
    label: "Gestos",
    icon: HandRaisedIcon,
    emojis: [
      "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏",
      "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👈", "👉",
      "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊",
      "🤛", "🤜", "👏", "🙌", "🫶", "🤲", "🤝", "🙏",
    ],
  },
  {
    id: "hearts",
    label: "Amor",
    icon: HeartIcon,
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
      "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖",
      "💘", "💝", "💟", "♥️", "💋", "💯", "🔥", "✨",
    ],
  },
  {
    id: "objects",
    label: "Objetos",
    icon: SparklesIcon,
    emojis: [
      "🎉", "🎊", "🎁", "🛍️", "🧾", "📦", "📌", "📍",
      "✂️", "🧵", "🪡", "👕", "👚", "👗", "🧥", "👖",
      "🧢", "👟", "👛", "💼", "📱", "☎️", "💬", "✅",
      "☑️", "❌", "⚠️", "⭐", "🌟", "💰", "💳", "🚚",
    ],
  },
  {
    id: "symbols",
    label: "Símbolos",
    icon: SwatchIcon,
    emojis: [
      "🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "⚫", "⚪",
      "⬛", "⬜", "🟥", "🟧", "🟨", "🟩", "🟦", "🟪",
      "⬆️", "➡️", "⬇️", "⬅️", "↗️", "↘️", "🔁", "🔄",
      "🔕", "📣", "🔒", "🔓", "🔎", "💡", "📅", "⏰",
    ],
  },
];

function MobileEmojiPanel({
  activeCategory,
  onBackspace,
  onCategoryChange,
  onEmojiSelect,
  panelRef,
}: {
  activeCategory: string;
  onBackspace: () => void;
  onCategoryChange: (categoryId: string) => void;
  onEmojiSelect: (emoji: string) => void;
  panelRef: RefObject<HTMLDivElement | null>;
}) {
  const touchStartRef = useRef<{
    moved: boolean;
    target: HTMLButtonElement | null;
    x: number;
    y: number;
  } | null>(null);
  const selectedCategory =
    mobileEmojiCategories.find((category) => category.id === activeCategory) ??
    mobileEmojiCategories[0];
  const handleActionTouchStart = (event: ReactTouchEvent<HTMLButtonElement>) => {
    const touch = event.touches[0];

    touchStartRef.current = touch
      ? {
          moved: false,
          target: event.currentTarget,
          x: touch.clientX,
          y: touch.clientY,
        }
      : null;
  };
  const handleActionTouchMove = (event: ReactTouchEvent<HTMLButtonElement>) => {
    const touch = event.touches[0];
    const touchStart = touchStartRef.current;

    if (!touch || !touchStart) {
      return;
    }

    const moved =
      Math.abs(touch.clientX - touchStart.x) > 8 ||
      Math.abs(touch.clientY - touchStart.y) > 8;

    if (moved) {
      touchStart.moved = true;
    }
  };
  const runMouseAction = (
    event: ReactMouseEvent<HTMLButtonElement>,
    action: () => void,
  ) => {
    const touchStart = touchStartRef.current;

    if (touchStart) {
      const isSameTarget = touchStart.target === event.currentTarget;
      const shouldRunTouchTap = isSameTarget && !touchStart.moved;
      touchStartRef.current = null;

      if (!shouldRunTouchTap) {
        return;
      }

      event.preventDefault();
      action();
      return;
    }

    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    action();
  };
  const runKeyboardAction = (
    event: ReactMouseEvent<HTMLButtonElement>,
    action: () => void,
  ) => {
    if (event.detail === 0) {
      action();
    }
  };

  return (
    <div
      ref={panelRef}
      data-testid="mobile-emoji-panel"
      className="relative z-50 -mx-2 mt-2 flex h-[42dvh] max-h-[380px] min-h-[300px] flex-col overflow-hidden border-t border-slate-200 bg-white text-slate-900 shadow-[0_-12px_30px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:shadow-[0_-12px_30px_rgba(0,0,0,0.35)]"
    >
      <div className="mx-auto mt-3 h-1.5 w-14 rounded-full bg-slate-300 dark:bg-slate-600" />

      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 text-slate-500 dark:text-slate-300">
        <MagnifyingGlassIcon className="h-6 w-6 shrink-0" />
        <div className="flex h-11 flex-1 items-center justify-center rounded-full border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            className="flex h-9 w-24 items-center justify-center rounded-full bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white dark:shadow-none"
            aria-label="Emojis"
          >
            <FaceSmileIcon className="h-6 w-6" />
          </button>
        </div>
        <button
          type="button"
          onTouchStart={handleActionTouchStart}
          onTouchMove={handleActionTouchMove}
          onMouseDown={(event) => runMouseAction(event, onBackspace)}
          onClick={(event) => runKeyboardAction(event, onBackspace)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          aria-label="Borrar emoji"
        >
          <BackspaceIcon className="h-6 w-6" />
        </button>
      </div>

      <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <div className="grid grid-cols-8 gap-y-3">
          {selectedCategory.emojis.map((emoji, index) => (
            <button
              key={`${emoji}-${index}`}
              type="button"
              onTouchStart={handleActionTouchStart}
              onTouchMove={handleActionTouchMove}
              onMouseDown={(event) =>
                runMouseAction(event, () => onEmojiSelect(emoji))
              }
              onClick={(event) =>
                runKeyboardAction(event, () => onEmojiSelect(emoji))
              }
              className="flex aspect-square items-center justify-center rounded-xl text-[2rem] leading-none transition-colors hover:bg-slate-100 active:bg-slate-200 dark:hover:bg-slate-800 dark:active:bg-slate-700"
              aria-label={`Insertar emoji ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-5 border-t border-slate-200 bg-white px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 dark:border-slate-800 dark:bg-slate-950">
        {mobileEmojiCategories.map((category) => {
          const Icon = category.icon;
          const selected = category.id === selectedCategory.id;

          return (
            <button
              key={category.id}
              type="button"
              onTouchStart={handleActionTouchStart}
              onTouchMove={handleActionTouchMove}
              onMouseDown={(event) =>
                runMouseAction(event, () => onCategoryChange(category.id))
              }
              onClick={(event) =>
                runKeyboardAction(event, () => onCategoryChange(category.id))
              }
              className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
                selected
                  ? "bg-slate-900 text-white dark:bg-slate-800"
                  : "text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-900 dark:hover:text-slate-300"
              }`}
              aria-label={category.label}
              aria-pressed={selected}
            >
              <Icon className="h-6 w-6" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

const AGENT_STATE_LABELS: Record<string, string> = {
  IDLE: "IA Kiments atendiendo",
  EXPLORANDO_PRODUCTOS: "Buscando productos",
  ARMANDO_CARRITO: "Armando carrito",
  ESPERANDO_DATOS_CLIENTE: "Esperando datos del cliente",
  ESPERANDO_METODO_PAGO: "Esperando método de pago",
  ESPERANDO_COMPROBANTE: "Esperando comprobante",
  VALIDANDO_COMPROBANTE: "Validando comprobante",
  ESPERANDO_METODO_ENTREGA: "Configurando entrega",
  ESPERANDO_DATOS_SHALOM: "Esperando datos de Shalom",
  ESPERANDO_CONFIRMACION_AGENCIA_SHALOM: "Confirmando agencia Shalom",
  ESPERANDO_DECISION_FILM: "Esperando decisión de film",
  ESPERANDO_PAGO_FILM: "Esperando pago del film",
  LISTO_PARA_VENTA: "Preparando Nota de Venta",
  VENTA_PENDIENTE_REVISION: "Venta pendiente de revisión",
  COMPLETADO: "Atención completada",
  CANCELADO: "Atención cancelada",
  REQUIERE_AYUDA: "Requiere ayuda humana",
};

function AgentConversationStatus({ state, expiresAt }: { state: string | null; expiresAt: string | null }) {
  const calculateRemaining = useCallback(() => {
    if (!expiresAt) return 0;
    const timestamp = new Date(expiresAt).getTime();
    return Number.isFinite(timestamp) ? Math.max(0, Math.ceil((timestamp - Date.now()) / 1000)) : 0;
  }, [expiresAt]);
  const [remaining, setRemaining] = useState(calculateRemaining);

  useEffect(() => {
    if (!expiresAt) return;
    const interval = window.setInterval(() => setRemaining(calculateRemaining()), 1000);
    return () => window.clearInterval(interval);
  }, [calculateRemaining, expiresAt]);

  return (
    <span className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full border border-sky-200/80 bg-sky-50 px-2 py-1 text-left text-[10px] font-semibold leading-none text-sky-800 shadow-sm dark:border-sky-800 dark:bg-sky-950/70 dark:text-sky-200">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-50" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
      </span>
      <span className="truncate">{AGENT_STATE_LABELS[state ?? ""] ?? "IA Kiments atendiendo"}</span>
      {expiresAt && remaining > 0 && (
        <span className="shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 font-bold tabular-nums text-sky-700 dark:bg-sky-900 dark:text-sky-100">
          {formatAudioDuration(remaining)}
        </span>
      )}
    </span>
  );
}

function ConversationRow({
  conversation,
  accepting,
  markingUnread,
  onAccept,
  onMarkUnread,
  onSelect,
  tags,
}: {
  conversation: CrmConversation;
  accepting?: boolean;
  markingUnread?: boolean;
  onAccept?: () => void;
  onMarkUnread: () => void;
  onSelect: () => void;
  tags: ConversationTag[];
}) {
  const unreadCount = conversation.unreadCount ?? 0;
  const hasUnread = unreadCount > 0;
  const mediaPreview = getConversationMediaPreview(conversation);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.currentTarget !== event.target) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={`group relative flex w-full gap-3 border-b border-border px-3 py-3 text-left transition-colors hover:bg-muted/60 ${
        conversation.active ? "bg-muted" : "bg-background"
      }`}
    >
      {conversation.active && (
        <span className="absolute left-0 top-0 h-full w-1 bg-muted-foreground" />
      )}
      <ChatAvatar />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-foreground">
            {conversation.displayName}
          </h3>
          <span className={`shrink-0 text-[11px] ${hasUnread ? "font-bold text-foreground" : "text-foreground"}`}>
            {conversation.time}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          {mediaPreview ? (
            <p className={`min-w-0 flex flex-1 items-center gap-1.5 truncate text-xs ${hasUnread ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
              {mediaPreview.icon}
              <span className="truncate">{mediaPreview.label}</span>
            </p>
          ) : conversation.preview ? (
            <p className={`min-w-0 flex-1 truncate text-xs ${hasUnread ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
              {conversation.preview}
            </p>
          ) : (
            <p className="min-w-0 flex-1 text-xs text-muted-foreground">Sin ultimo mensaje</p>
          )}
          {hasUnread && (
            <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-bold leading-none text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
        {conversation.attentionQueue === "AGENT_ACTIVE" && <AgentConversationStatus state={conversation.agentState} expiresAt={conversation.reservationExpiresAt} />}
        {conversation.waitingReason && (
          <span className="mt-1.5 inline-flex max-w-full items-center rounded bg-amber-100 px-2 py-0.5 text-left text-[10px] font-semibold leading-snug text-amber-800 dark:bg-amber-950 dark:text-amber-200" title={conversation.waitingDetail ?? undefined}>
            {conversation.waitingDetail || "Necesita asesor"}
          </span>
        )}
        {tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                style={{ backgroundColor: tag.color }}
              >
                {tag.label}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between gap-2 text-muted-foreground">
          {onAccept ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                onAccept();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onAccept();
                }
              }}
              className="inline-flex h-7 items-center rounded-full bg-emerald-500 px-3 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-emerald-600 aria-disabled:pointer-events-none aria-disabled:opacity-60"
              aria-disabled={accepting}
            >
              {accepting ? "Aceptando..." : "Aceptar"}
            </span>
          ) : (
            <span />
          )}
          <span className="flex items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(event) => event.stopPropagation()}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-muted-foreground/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Opciones de ${conversation.displayName}`}
                >
                  <ChevronDownIcon className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56"
                onClick={(event) => event.stopPropagation()}
              >
                <DropdownMenuItem
                  disabled={hasUnread || markingUnread}
                  onSelect={onMarkUnread}
                >
                  <EnvelopeIcon className="h-4 w-4" />
                  {markingUnread
                    ? "Marcando..."
                    : hasUnread
                      ? "Ya está marcado como no leído"
                      : "Marcar como no leído"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="rounded bg-muted-foreground/35 px-1.5 py-0.5 text-[10px] font-semibold text-background">
              {conversation.initials}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

function getConversationMediaPreview(conversation: CrmConversation) {
  const preview = conversation.preview || "";
  const extension = preview.match(/\.([a-z0-9]{2,8})(?:\?|#|$)/i)?.[1]?.toUpperCase();

  switch (conversation.lastMessageType) {
    case "IMAGE":
      return { label: "Imagen", icon: <PhotoIcon className="h-3.5 w-3.5 shrink-0" /> };
    case "AUDIO":
      return { label: "Audio", icon: <MicrophoneIcon className="h-3.5 w-3.5 shrink-0" /> };
    case "VIDEO":
      return { label: "Video", icon: <PlayIcon className="h-3.5 w-3.5 shrink-0" /> };
    case "DOCUMENT":
    case "MEDIA":
      return {
        label: extension ? `Archivo ${extension}` : "Archivo",
        icon: <DocumentIcon className="h-3.5 w-3.5 shrink-0" />,
      };
    default:
      return null;
  }
}

function MessageStatusChecks({ status }: { status?: ChatMessage["status"] }) {
  if (status === "accepted" || status === "failed" || status === "deleted") {
    return null;
  }

  if (status === "read") {
    return (
      <span className="relative inline-flex w-4 text-sky-500">
        <CheckIcon className="h-3 w-3" />
        <CheckIcon className="-ml-1.5 h-3 w-3" />
      </span>
    );
  }

  if (status === "delivered") {
    return (
      <span className="relative inline-flex w-4">
        <CheckIcon className="whatsapp-outgoing-check h-3 w-3" />
        <CheckIcon className="whatsapp-outgoing-check -ml-1.5 h-3 w-3" />
      </span>
    );
  }

  return <CheckIcon className="whatsapp-outgoing-check h-3 w-3" />;
}

function MessageQuotePreview({ quote }: { quote?: ChatMessage["replyTo"] }) {
  if (!quote) return null;
  return (
    <div className="mb-2 max-w-full rounded border-l-2 border-emerald-500 bg-black/5 px-2 py-1.5 text-xs dark:bg-white/10">
      <p className="font-semibold text-emerald-700 dark:text-emerald-300">
        {quote.direction === "OUTGOING" ? "KIMETS" : "Cliente"}
      </p>
      <p className="line-clamp-2 break-words text-muted-foreground">
        {quote.deleted ? "Mensaje eliminado" : quote.body || "Mensaje"}
      </p>
    </div>
  );
}

function MessageSenderLabel({ item }: { item: ChatMessage }) {
  if (!item.sentByName) return null;
  return (
    <p className="mb-1 text-[10px] font-semibold text-emerald-700/80 dark:text-emerald-300/80">
      Enviado por {item.sentByName}
    </p>
  );
}

function MessageActions({
  item,
  onReply,
  onDelete,
  deleting,
  allowDelete,
}: {
  item: ChatMessage;
  onReply?: (message: ChatMessage) => void;
  onDelete?: (message: ChatMessage) => void;
  deleting?: boolean;
  allowDelete?: boolean;
}) {
  const canShow = !item.deleted
    && item.type !== "date"
    && item.type !== "system"
    && item.status !== "accepted"
    && item.status !== "failed"
    && item.status !== "deleted";
  const isOutgoing =
    item.type === "outgoing" ||
    item.type === "outgoing-file" ||
    item.type === "outgoing-audio";
  const canDelete = isOutgoing && allowDelete;
  if (!canShow) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded-full text-current/60 transition-colors hover:bg-black/10 hover:text-current dark:hover:bg-white/10"
          aria-label="Opciones del mensaje"
        >
          <ChevronDownIcon className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={isOutgoing ? "end" : "start"}
        side="bottom"
        sideOffset={4}
        collisionPadding={8}
        className="w-44"
      >
        <DropdownMenuItem
          className="gap-2 px-3 py-2 text-xs font-medium"
          onSelect={() => onReply?.(item)}
        >
          <ArrowUturnLeftIcon className="h-4 w-4" />
          Responder
        </DropdownMenuItem>
        {canDelete && (
          <DropdownMenuItem
            variant="destructive"
            disabled={deleting}
            className="gap-2 px-3 py-2 text-xs font-medium"
            onSelect={() => onDelete?.(item)}
          >
            <TrashIcon className="h-4 w-4" />
            {deleting ? "Eliminando..." : "Eliminar para todos"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


function MessageBubble({
  item,
  onOpenImagePreview,
  onRetry,
  onReply,
  onDelete,
  deleting,
  canDelete,
  onSendReceipt,
}: {
  item: ChatMessage;
  onOpenImagePreview: (image: { alt: string; url: string }) => void;
  onRetry?: (message: ChatMessage) => void;
  onReply?: (message: ChatMessage) => void;
  onDelete?: (message: ChatMessage) => void;
  deleting?: boolean;
  canDelete?: boolean;
  onSendReceipt?: (saleId: number, format: "PDF" | "TICKET") => Promise<void>;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState<number>();
  const [audioRequested, setAudioRequested] = useState(false);
  const [sendingReceipt, setSendingReceipt] = useState<"PDF" | "TICKET" | null>(null);
  const isVisualMedia = (isImageFile(item.fileType, item.text) || isVideoFile(item.fileType, item.text))
    && Boolean(item.fileUrl);
  const visualMedia = useAuthenticatedBlobUrl(item.fileUrl, isVisualMedia);
  const visualMediaUrl = visualMedia.url;
  const authenticatedAudio = useAuthenticatedBlobUrl(item.audioUrl, audioRequested);
  const authenticatedAudioUrl = authenticatedAudio.url;

  useEffect(() => {
    const audio = audioRef.current;
    const url = authenticatedAudioUrl;
    if (!audio || !url) return;
    let cancelled = false;
    let decoding = false;
    const controller = new AbortController();
    const updateDuration = async () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        if (!cancelled) setAudioDuration(audio.duration);
        return;
      }
      if (decoding) return;
      decoding = true;
      let context: AudioContext | undefined;
      try {
        // MediaRecorder WebM files may lack a finite metadata duration.
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) return;
        const buffer = await response.arrayBuffer();
        if (cancelled) return;
        context = new AudioContext();
        const decoded = await context.decodeAudioData(buffer);
        if (!cancelled) setAudioDuration(decoded.duration);
      } catch {
        // Keep the recorded duration if the file cannot be decoded.
      } finally {
        await context?.close();
      }
    };
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);
    return () => {
      cancelled = true;
      controller.abort();
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
    };
  }, [authenticatedAudioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const handleTogglePlay = () => {
    const audio = audioRef.current;
    if (!audioRequested) {
      setAudioRequested(true);
      setIsPlaying(true);
      return;
    }
    if (!audio || !authenticatedAudioUrl) return;

    if (audio.paused) {
      void audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    if (!authenticatedAudioUrl || !isPlaying) return;
    void audioRef.current?.play().catch(() => setIsPlaying(false));
  }, [authenticatedAudioUrl, isPlaying]);

  if (item.type === "date") {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-md border border-border bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm">
          {item.text}
        </span>
      </div>
    );
  }

  if (item.type === "system") {
    return (
      <div className="mx-auto w-fit max-w-[92%] rounded-lg border border-border bg-muted px-4 py-2 text-center text-xs font-bold text-foreground shadow-sm md:max-w-[70%]">
        <p className="whitespace-pre-wrap break-words">{item.text}</p>
        {item.relatedSaleId && onSendReceipt ? (
          <div className="mt-2 flex items-center justify-center gap-1.5">
            {(["PDF", "TICKET"] as const).map((format) => (
              <button
                key={format}
                type="button"
                disabled={sendingReceipt !== null}
                onClick={() => {
                  setSendingReceipt(format);
                  void onSendReceipt(item.relatedSaleId!, format)
                    .finally(() => setSendingReceipt(null));
                }}
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-[10px] font-bold transition-colors disabled:opacity-50",
                  format === "PDF"
                    ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/20"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20",
                )}
                title={`Enviar ${format}`}
              >
                <DocumentIcon className="h-3.5 w-3.5" />
                {sendingReceipt === format ? "Enviando..." : format}
              </button>
            ))}
          </div>
        ) : null}
        <p className="mt-1 text-[10px] text-muted-foreground">{item.time}</p>
      </div>
    );
  }

  if (item.deleted) {
    const outgoing = item.type === "outgoing" || item.type === "outgoing-file" || item.type === "outgoing-audio";
    return (
      <div className={`w-fit max-w-[88%] rounded-md px-3 py-2 text-sm italic shadow-sm md:max-w-[55%] ${
        outgoing ? "whatsapp-outgoing-bubble ml-auto" : "mr-auto bg-card text-muted-foreground"
      }`}>
        {outgoing && <MessageSenderLabel item={item} />}
        Mensaje eliminado
        <p className={`mt-2 text-right text-[10px] ${outgoing ? "whatsapp-outgoing-meta" : "text-muted-foreground"}`}>
          {item.time}
        </p>
      </div>
    );
  }

  if (item.viewOnce) {
    const outgoing = item.type === "outgoing";
    return (
      <div className={cn(
        "w-fit max-w-[88%] rounded-md px-3 py-2.5 text-sm shadow-sm md:max-w-[55%]",
        outgoing ? "whatsapp-outgoing-bubble ml-auto" : "mr-auto bg-card text-card-foreground",
      )}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <PhotoIcon className="h-5 w-5 shrink-0" />
          <p className="italic">No se puede abrir: es un mensaje para ver una sola vez.</p>
        </div>
        <p className={cn("mt-2 text-right text-[10px]", outgoing ? "whatsapp-outgoing-meta" : "text-muted-foreground")}>
          {item.time}
        </p>
      </div>
    );
  }

  if (item.location) {
    const outgoing = item.type === "outgoing";
    const location = item.location;
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.latitude},${location.longitude}`)}`;
    return (
      <div className={cn("w-fit max-w-[88%] rounded-md px-3 py-3 text-sm shadow-sm md:max-w-[55%]", outgoing ? "whatsapp-outgoing-bubble ml-auto" : "mr-auto bg-card text-card-foreground")}>
        {outgoing && <MessageSenderLabel item={item} />}
        <div className="rounded-lg border border-current/10 bg-black/5 p-3 dark:bg-white/5">
          <p className="font-semibold">{location.name || "Ubicación compartida"}</p>
          {location.address ? <p className="mt-1 text-xs opacity-75">{location.address}</p> : null}
          <p className="mt-1 text-[11px] opacity-60">{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</p>
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300">Abrir en Google Maps</a>
        </div>
        <MessageReactions reactions={item.reactions} />
        <p className={cn("mt-2 flex items-center justify-end gap-1 text-[10px]", outgoing ? "whatsapp-outgoing-meta" : "text-muted-foreground")}>{item.time}{outgoing && <MessageStatusChecks status={item.status} />}</p>
      </div>
    );
  }

  if (item.type === "outgoing-file" || item.type === "incoming-file") {
    const isOutgoingFile = item.type === "outgoing-file";
    const isImageAttachment = isImageFile(item.fileType, item.text) && item.fileUrl;
    const isStickerAttachment = Boolean(item.sticker && isImageAttachment);
    const isVideoAttachment = isVideoFile(item.fileType, item.text) && item.fileUrl;
    const isPdfAttachmentMessage = isPdfFile(item.fileType, item.text) && item.fileUrl;
    const fileBadge = getFileBadge(item.text, item.fileType);
    const mediaCaption = item.caption?.trim();
    const imageAlt = mediaCaption || item.text || "Imagen";

    return (
      <div className={`relative w-fit max-w-[88%] rounded-md text-sm md:max-w-[55%] ${
        isOutgoingFile ? "whatsapp-outgoing-bubble ml-auto" : "mr-auto bg-card text-card-foreground"
      } ${isStickerAttachment ? "bg-transparent p-0 shadow-none" : "shadow-sm"} ${
        isImageAttachment || isVideoAttachment || isPdfAttachmentMessage ? "p-1.5" : "px-3 py-3"
      }`}>
        {isOutgoingFile && <MessageSenderLabel item={item} />}
        <MessageQuotePreview quote={item.replyTo} />
        {(isImageAttachment || isVideoAttachment || isPdfAttachmentMessage) && (
          <div className="absolute right-2 top-2 z-10 rounded-full bg-background/80 backdrop-blur">
            <MessageActions item={item} onReply={onReply} onDelete={onDelete} deleting={deleting} allowDelete={canDelete} />
          </div>
        )}
        {isImageAttachment ? (
          <div className="space-y-1.5">
            {visualMediaUrl ? (
              <button
                type="button"
                onClick={() => onOpenImagePreview({ alt: imageAlt, url: visualMediaUrl })}
                aria-label={imageAlt}
                className={cn(
                  "block overflow-hidden",
                  isStickerAttachment
                    ? "h-40 w-40 bg-transparent sm:h-44 sm:w-44"
                    : "h-64 w-[min(68vw,320px)] rounded bg-muted",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={visualMediaUrl}
                  alt={imageAlt}
                  loading="lazy"
                  decoding="async"
                  className={cn("h-full w-full", isStickerAttachment ? "object-contain" : "object-cover")}
                />
              </button>
            ) : visualMedia.error ? (
              <div className="flex h-64 w-[min(68vw,320px)] flex-col items-center justify-center gap-2 rounded bg-muted px-4 text-center text-xs text-muted-foreground">
                <PhotoIcon className="h-8 w-8" />
                <span>No se pudo cargar la imagen.</span>
                <button
                  type="button"
                  onClick={visualMedia.retry}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 font-semibold text-foreground hover:bg-accent"
                >
                  <ArrowPathIcon className="h-3.5 w-3.5" />
                  Reintentar
                </button>
              </div>
            ) : (
              <div className="h-64 w-[min(68vw,320px)] animate-pulse rounded bg-muted" aria-label="Cargando imagen" />
            )}
            {mediaCaption ? (
              <p className="whitespace-pre-wrap break-words px-1 text-sm leading-relaxed">
                {mediaCaption}
              </p>
            ) : null}
          </div>
        ) : isVideoAttachment ? (
          visualMediaUrl ? (
            <div className="space-y-1.5">
              <video
                src={visualMediaUrl}
                controls
                playsInline
                preload="none"
                className="max-h-72 w-[min(76vw,360px)] rounded bg-black"
              />
              {mediaCaption ? (
                <p className="whitespace-pre-wrap break-words px-1 text-sm leading-relaxed">
                  {mediaCaption}
                </p>
              ) : null}
            </div>
          ) : visualMedia.error ? (
            <div className="flex h-48 w-[min(76vw,360px)] flex-col items-center justify-center gap-2 rounded bg-muted text-xs text-muted-foreground">
              <span>No se pudo cargar el video.</span>
              <button
                type="button"
                onClick={visualMedia.retry}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 font-semibold text-foreground hover:bg-accent"
              >
                <ArrowPathIcon className="h-3.5 w-3.5" />
                Reintentar
              </button>
            </div>
          ) : (
            <div className="h-48 w-[min(76vw,360px)] animate-pulse rounded bg-muted" />
          )
        ) : isPdfAttachmentMessage ? (
          <>
          <div className="w-[min(76vw,340px)] overflow-hidden rounded bg-[#1f2c24] dark:bg-[#1f2428]">
            <button
              type="button"
              onClick={() => void openAuthenticatedMedia(item.fileUrl ?? "", item.text, false)}
              className="flex h-28 w-full items-center justify-center bg-white text-red-600"
            >
              <DocumentIcon className="h-12 w-12" />
            </button>
            <div className="flex items-center gap-3 bg-black/20 px-3 py-3 text-white">
              <div className="flex h-9 w-8 shrink-0 flex-col items-center justify-center rounded-sm bg-red-600 text-[9px] font-black leading-none text-white">
                PDF
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-5">
                  {item.text}
                </p>
                <p className="mt-0.5 text-xs text-white/65">
                  {item.pageCount ? `${item.pageCount} páginas · ` : ""}
                  PDF
                  {item.fileSize ? ` · ${formatFileSize(item.fileSize)}` : ""}
                </p>
              </div>
              {item.fileUrl && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void openAuthenticatedMedia(item.fileUrl ?? "", item.text, true);
                  }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label={`Descargar ${item.text}`}
                >
                  <ArrowDownTrayIcon className="h-4.5 w-4.5" />
                </button>
              )}
            </div>
          </div>
          {mediaCaption ? (
            <p className="whitespace-pre-wrap break-words px-1 text-sm leading-relaxed">
              {mediaCaption}
            </p>
          ) : null}
          </>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between gap-3 font-semibold">
              <span className="min-w-0 break-words">{isOutgoingFile ? "KIMETS:" : "Archivo"}</span>
              <MessageActions item={item} onReply={onReply} onDelete={onDelete} deleting={deleting} allowDelete={canDelete} />
            </div>
            <div className="whatsapp-outgoing-file flex items-center gap-3 rounded px-3 py-2 text-xs font-semibold">
              <span
                className={`flex h-9 w-8 shrink-0 items-center justify-center rounded-sm text-[9px] font-black leading-none ${fileBadge.className}`}
              >
                {fileBadge.label}
              </span>
              <span className="min-w-0 flex-1 break-words">{item.text}</span>
              {item.fileUrl && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void openAuthenticatedMedia(item.fileUrl ?? "", item.text, true);
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current/20 text-current/80 transition-colors hover:bg-black/5 hover:text-current dark:hover:bg-white/10"
                  aria-label={`Descargar ${item.text}`}
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                </button>
              )}
            </div>
            {mediaCaption ? (
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">
                {mediaCaption}
              </p>
            ) : null}
          </>
        )}
        <MessageReactions reactions={item.reactions} />
        <p className={`flex items-center justify-end gap-1 text-[10px] ${
          isOutgoingFile ? "whatsapp-outgoing-meta" : "text-muted-foreground"
        } ${isImageAttachment ? "mt-1 px-1" : "mt-2"}`}>
          {item.status === "accepted" ? "Enviando..." : item.time}
          {isOutgoingFile && item.status === "failed" ? (
            <button
              type="button"
              onClick={() => onRetry?.(item)}
              className="ml-2 rounded-full bg-red-500/10 px-2 py-0.5 font-semibold text-red-600 hover:bg-red-500/20 dark:text-red-300"
            >
              Error · Reintentar
            </button>
          ) : isOutgoingFile ? (
            <MessageStatusChecks status={item.status} />
          ) : null}
        </p>
      </div>
    );
  }

  if (item.type === "outgoing-audio" || item.type === "incoming-audio") {
    const isOutgoingAudio = item.type === "outgoing-audio";
    return (
      <div className={cn(
        "w-fit max-w-[88%] rounded-md px-3 py-3 text-sm shadow-sm md:max-w-[55%] md:rounded-lg md:px-3.5 md:py-2.5",
        isOutgoingAudio
          ? "whatsapp-outgoing-bubble outgoing-audio-bubble desktop-audio-bubble ml-auto md:shadow-[0_1px_1px_rgba(11,20,26,0.18)]"
          : "mr-auto border border-border bg-card text-card-foreground",
      )}>
        {isOutgoingAudio && <MessageSenderLabel item={item} />}
        <div className="mb-1 flex justify-end">
          <MessageActions item={item} onReply={onReply} onDelete={onDelete} deleting={deleting} allowDelete={canDelete} />
        </div>
        <MessageQuotePreview quote={item.replyTo} />
        <audio ref={audioRef} src={authenticatedAudioUrl} preload="none" />
        <div className={cn(
          "flex max-w-full items-center gap-3 md:gap-2.5",
          isOutgoingAudio ? "min-w-[240px] md:min-w-[330px]" : "min-w-[200px] md:min-w-[260px]",
        )}>
          {isOutgoingAudio && (
            <div className="relative h-10 w-10 shrink-0">
              <div className="desktop-audio-avatar flex h-10 w-10 items-center justify-center rounded-full bg-black/10 text-muted-foreground md:h-11 md:w-11">
                <UserIconSolid className="h-5 w-5" />
              </div>
              <div className="desktop-audio-mic absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                <MicrophoneIcon className="h-3 w-3" />
              </div>
            </div>
          )}
          <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
            <button
              onClick={handleTogglePlay}
              className="desktop-audio-play flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-emerald-700 hover:bg-black/5 md:h-9 md:w-9 dark:text-emerald-400 dark:hover:bg-white/10"
              aria-label={isPlaying ? "Pausar audio" : "Reproducir audio"}
            >
              {isPlaying ? (
                <PauseIcon className="desktop-audio-play-icon h-5 w-5" />
              ) : (
                <PlayIcon className="desktop-audio-play-icon h-5 w-5" />
              )}
            </button>
            <div className="relative flex h-8 flex-1 items-center gap-0.5 overflow-hidden md:h-9">
              {AUDIO_WAVEFORM_BARS.map((height, index) => {
                const barPosition = (index / AUDIO_WAVEFORM_BARS.length) * 100;
                const isPlayed = barPosition <= progress;
                return (
                  <span
                    key={`${height}-${index}`}
                    className="desktop-audio-wave-bar absolute bottom-0 w-0.5 rounded-full transition-colors md:w-1"
                    style={{
                      height,
                      left: `${(index / AUDIO_WAVEFORM_BARS.length) * 100}%`,
                      backgroundColor: isOutgoingAudio
                        ? isPlayed
                          ? "var(--chat-audio-played, rgb(255, 255, 255))"
                          : "var(--chat-audio-idle, rgba(255, 255, 255, 0.4))"
                        : isPlayed
                          ? "var(--chat-audio-played, rgb(16, 185, 129))"
                          : "var(--chat-audio-idle, rgba(100, 116, 139, 0.4))",
                    }}
                  />
                );
              })}
            </div>
            <span className="desktop-audio-duration shrink-0 text-xs md:w-10 md:text-right md:font-medium">
              {audioDuration || item.duration
                ? formatAudioDuration(audioDuration ?? item.duration ?? 0)
                : "--:--"}
            </span>
          </div>
        </div>
        <MessageReactions reactions={item.reactions} />
        <p className={cn(
          "mt-2 flex items-center justify-end gap-1 text-[10px] md:mt-1",
          isOutgoingAudio ? "desktop-audio-time whatsapp-outgoing-meta" : "text-muted-foreground",
        )}>
          {isOutgoingAudio && item.status === "accepted" ? "Enviando..." : item.time}
          {isOutgoingAudio && item.status === "failed" ? (
            <button
              type="button"
              onClick={() => onRetry?.(item)}
              className="ml-2 rounded-full bg-red-500/10 px-2 py-0.5 font-semibold text-red-600 hover:bg-red-500/20 dark:text-red-300"
            >
              Error · Reintentar
            </button>
          ) : isOutgoingAudio ? (
            <MessageStatusChecks status={item.status} />
          ) : null}
        </p>
      </div>
    );
  }

  if (item.type === "outgoing") {
    return (
      <div className="whatsapp-outgoing-bubble ml-auto w-fit max-w-[88%] rounded-md px-3 py-3 text-sm shadow-sm md:max-w-[55%]">
        <MessageSenderLabel item={item} />
        <MessageQuotePreview quote={item.replyTo} />
        {item.aiGenerated && (
          <span className="mb-1 inline-flex rounded bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-blue-700 dark:text-blue-300">
            IA Kiments
          </span>
        )}
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 whitespace-pre-wrap break-words">{item.text}</p>
          <MessageActions item={item} onReply={onReply} onDelete={onDelete} deleting={deleting} allowDelete={canDelete} />
        </div>
        <MessageReactions reactions={item.reactions} />
        <p className="whatsapp-outgoing-meta mt-4 flex items-center justify-end gap-1 text-[10px]">
          {item.status === "accepted" ? "Enviando..." : item.time}
          {item.status === "failed" ? (
            <button
              type="button"
              onClick={() => onRetry?.(item)}
              className="ml-2 rounded-full bg-red-500/10 px-2 py-0.5 font-semibold text-red-600 hover:bg-red-500/20 dark:text-red-300"
            >
              Error · Reintentar
            </button>
          ) : (
            <MessageStatusChecks status={item.status} />
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="mr-auto w-fit max-w-[88%] rounded-md bg-card px-3 py-3 text-sm text-card-foreground shadow-sm md:max-w-[55%]">
      <MessageQuotePreview quote={item.replyTo} />
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 whitespace-pre-wrap break-words">{item.text}</p>
        <MessageActions item={item} onReply={onReply} onDelete={onDelete} deleting={deleting} allowDelete={canDelete} />
      </div>
      <MessageReactions reactions={item.reactions} />
      <p className="mt-4 text-right text-[10px] text-muted-foreground">{item.time}</p>
    </div>
  );
}

function MessageReactions({ reactions }: { reactions?: ChatMessage["reactions"] }) {
  if (!reactions?.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1" aria-label="Reacciones del mensaje">
      {reactions.map((reaction, index) => (
        <span key={`${reaction.direction}-${reaction.emoji}-${index}`} className="rounded-full border border-border bg-background/90 px-2 py-0.5 text-sm shadow-sm" title={reaction.direction === "OUTGOING" ? "Reacción enviada" : "Reacción recibida"}>{reaction.emoji}</span>
      ))}
    </div>
  );
}

function PdfFirstPagePreview({
  attachment,
  className,
  maxHeight,
  maxWidth,
  onPageCount,
}: {
  attachment: PendingAttachment;
  className?: string;
  maxHeight: number;
  maxWidth: number;
  onPageCount?: (pageCount: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onPageCountRef = useRef(onPageCount);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    onPageCountRef.current = onPageCount;
  }, [onPageCount]);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    let renderTask: RenderTask | null = null;

    const renderPdf = async () => {
      setFailed(false);
      setLoaded(false);

      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

        const currentLoadingTask = pdfjs.getDocument(attachment.objectUrl);
        loadingTask = currentLoadingTask;
        const pdf = await currentLoadingTask.promise;
        onPageCountRef.current?.(pdf.numPages);
        const page = await pdf.getPage(1);

        if (cancelled) {
          return;
        }

        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");

        if (!canvas || !context) {
          return;
        }

        const viewport = page.getViewport({ scale: 1 });
        const ratio =
          typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio, 2);
        const baseScale = Math.min(
          maxWidth / viewport.width,
          maxHeight / viewport.height,
        );
        const scaledViewport = page.getViewport({ scale: baseScale * ratio });

        canvas.width = Math.floor(scaledViewport.width);
        canvas.height = Math.floor(scaledViewport.height);
        canvas.style.width = `${Math.floor(scaledViewport.width / ratio)}px`;
        canvas.style.height = `${Math.floor(scaledViewport.height / ratio)}px`;

        const currentRenderTask = page.render({
          canvas,
          canvasContext: context,
          viewport: scaledViewport,
        });
        renderTask = currentRenderTask;
        await currentRenderTask.promise;
        setLoaded(true);
      } catch (error) {
        if (!cancelled) {
          const errorName =
            error instanceof Error ? error.name : "UnknownPdfPreviewError";

          if (errorName !== "RenderingCancelledException") {
            setFailed(true);
          }
        }
      }
    };

    void renderPdf();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      void loadingTask?.destroy();
    };
  }, [attachment.objectUrl, maxHeight, maxWidth]);

  if (failed) {
    return (
      <div className={className}>
        <DocumentIcon className="mb-4 h-14 w-14 text-emerald-600" />
        <p className="max-w-xs break-words text-center text-sm font-semibold">
          {attachment.name}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          {formatFileSize(attachment.size)}
        </p>
      </div>
    );
  }

  return (
    <div className={`relative ${className ?? ""}`}>
      {!loaded && !failed && (
        <div className="absolute inset-0 flex items-center justify-center bg-white text-xs font-semibold text-slate-500">
          Cargando PDF...
        </div>
      )}
      <canvas ref={canvasRef} className="max-h-full max-w-full rounded bg-white shadow-2xl" />
    </div>
  );
}

function SalesChatPage() {
  const { user } = useAuth();
  const isAdmin = isCrmAdmin(user?.rol);
  const { resolvedTheme } = useTheme();
  const searchParams = useSearchParams();
  const requestedConversationId = searchParams.get("conversationId");
  const [messageDraft, setMessageDraft] = useState("");
  const [quickMessages, setQuickMessages] = useState<QuickMessage[]>([]);
  const [quickMessagesLoading, setQuickMessagesLoading] = useState(true);
  const [quickCommandIndex, setQuickCommandIndex] = useState(0);
  const [quickCommandMenuDismissed, setQuickCommandMenuDismissed] = useState(false);
  const [isQuickMessageSending, setIsQuickMessageSending] = useState(false);
  const quickMessageSendingRef = useRef(false);
  const [conversations, setConversations] = useState<CrmConversation[]>([]);
  const conversationsRef = useRef<CrmConversation[]>([]);
  const conversationCacheRef = useRef<Record<string, ConversationCacheEntry>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messageCacheMetaRef = useRef<Record<string, MessageCacheMeta>>({});
  const messageCacheLruRef = useRef<string[]>([]);
  const messageRequestRef = useRef(0);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isOlderMessagesLoading, setIsOlderMessagesLoading] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversationSnapshot, setActiveConversationSnapshot] = useState<CrmConversation | null>(null);
  const [readStatePendingIds, setReadStatePendingIds] = useState<Set<string>>(() => new Set());
  const setChatError = (...messages: string[]) => {
    void messages;
  };
  const activeConversationIdRef = useRef<string | null>(null);
  const messageScrollRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const previousMessagesMetaRef = useRef<{ conversationId: string | null; length: number; lastId: string | null }>({
    conversationId: null,
    length: 0,
    lastId: null,
  });
  const handledRequestedConversationRef = useRef<string | null>(null);
  const allMessagesRef = useRef<Record<string, ChatMessage[]>>({});
  const sentAttachmentUrlsRef = useRef<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<ConversationFilter>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [conversationSearchInput, setConversationSearchInput] = useState("");
  const [conversationSearch, setConversationSearch] = useState("");
  const [selectedTagFilterId, setSelectedTagFilterId] = useState<string | null>(null);
  const conversationRequestRef = useRef(0);
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [isConversationListLoading, setIsConversationListLoading] = useState(true);
  const [isLoadingMoreConversations, setIsLoadingMoreConversations] = useState(false);
  const isLoadingMoreConversationsRef = useRef(false);
  const [conversationListError, setConversationListError] = useState("");
  const conversationAbortRef = useRef<AbortController | null>(null);
  const conversationCountsRefreshTimerRef = useRef<number | null>(null);
  const refreshConversationCountsRef = useRef<() => void>(() => undefined);
  const messageAbortRef = useRef<AbortController | null>(null);
  const visitSessionIdRef = useRef<string | null>(null);
  const visitedConversationIdsRef = useRef<Set<string>>(new Set());
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "live" | "reconnecting">("connecting");
  const [whatsappConnection, setWhatsappConnection] = useState<WhatsappConnectionState | null>(null);
  const realtimeStatusRef = useRef<"connecting" | "live" | "reconnecting">("connecting");
  const realtimeEventHandlerRef = useRef<(event: CrmRealtimeEvent) => void>(() => undefined);
  const realtimeResyncRef = useRef<() => void>(() => undefined);
  const [conversationCounts, setConversationCounts] = useState({
    all: 0,
    attended: 0,
    agent: 0,
    waiting: 0,
    resolved: 0,
    mine: 0,
  });
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [isConversationActionPending, setIsConversationActionPending] = useState(false);
  const [acceptingConversationId, setAcceptingConversationId] = useState<string | null>(null);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferUsers, setTransferUsers] = useState<TransferUserResponse[]>([]);
  const [transferSearch, setTransferSearch] = useState("");
  const [selectedTransferUserId, setSelectedTransferUserId] = useState<number | null>(null);
  const [isLoadingTransferUsers, setIsLoadingTransferUsers] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferError, setTransferError] = useState("");
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [deleteMessageTarget, setDeleteMessageTarget] = useState<ChatMessage | null>(null);
  const [isDeleteConversationOpen, setIsDeleteConversationOpen] = useState(false);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);

  const loadConversations = useCallback(async (options?: { append?: boolean; reset?: boolean; force?: boolean }) => {
    const append = options?.append === true;
    if (append && isLoadingMoreConversationsRef.current) return;
    isLoadingMoreConversationsRef.current = append;
    conversationAbortRef.current?.abort();
    const controller = new AbortController();
    conversationAbortRef.current = controller;
    const requestId = ++conversationRequestRef.current;
    const reset = options?.reset === true;
    const loadedCount = conversationsRef.current.length;
    const requestPage = append ? Math.floor(loadedCount / CONVERSATION_PAGE_SIZE) : 0;
    const requestSize = append
      ? CONVERSATION_PAGE_SIZE
      : reset
        ? CONVERSATION_PAGE_SIZE
        : Math.max(CONVERSATION_PAGE_SIZE, Math.ceil(loadedCount / CONVERSATION_PAGE_SIZE) * CONVERSATION_PAGE_SIZE);
    const view = activeFilter === "agent" ? "AGENT"
      : activeFilter === "mine" ? "MINE"
      : activeFilter === "waiting" ? "WAITING"
        : activeFilter === "resolved" ? "RESOLVED" : "ALL";
    const cacheKey = `${view}|${conversationSearch}|${selectedTagFilterId ?? ""}|${unreadOnly ? "unread" : "all"}`;
    const cached = conversationCacheRef.current[cacheKey];
    const cachedQueueCount = cached
      ? view === "WAITING" ? cached.counts.waiting
          : view === "AGENT" ? cached.counts.agent
          : view === "MINE" ? cached.counts.mine
          : view === "RESOLVED" ? cached.counts.resolved
            : cached.counts.all
      : 0;
    const cacheIsConsistent = Boolean(cached && cached.totalElements === cachedQueueCount);
    if (reset && !options?.force && cached && cacheIsConsistent) {
      conversationsRef.current = cached.items;
      setConversations(cached.items);
      setConversationCounts(cached.counts);
      setHasMoreConversations(cached.items.length < cached.totalElements);
      setResolvedIds(new Set(cached.items.filter((item) => item.status === "RESUELTO").map((item) => item.id)));
      setConversationListError("");
      setIsConversationListLoading(false);
      refreshConversationCountsRef.current();
      return;
    }
    const params = new URLSearchParams({
      view,
      page: String(requestPage),
      size: String(requestSize),
    });
    if (conversationSearch) params.set("q", conversationSearch);
    if (selectedTagFilterId) params.set("tagId", selectedTagFilterId);
    if (unreadOnly) params.set("unreadOnly", "true");

    if (append) {
      setIsLoadingMoreConversations(true);
    } else if (reset) {
      setIsConversationListLoading(true);
    }
    setConversationListError("");

    try {
      const response = await authFetch(`/api/crm/whatsapp/conversations?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(await readApiMessage(response, "No se pudieron cargar los chats"));
      }
      const data = (await response.json()) as ConversationPageResponse;
      if (requestId !== conversationRequestRef.current) return;

      const mapped = data.content.map(mapConversation);
      const nextConversations = append
        ? Array.from(
            new Map(
              [...conversationsRef.current, ...mapped].map((conversation) => [conversation.id, conversation]),
            ).values(),
          )
        : mapped;

      conversationsRef.current = nextConversations;
      setConversations(nextConversations);
      setResolvedIds(new Set(nextConversations.filter((c) => c.status === "RESUELTO").map((c) => c.id)));
      setConversationCounts(data.counts);
      setHasMoreConversations(nextConversations.length < data.totalElements);
      conversationCacheRef.current[cacheKey] = {
        items: nextConversations,
        counts: data.counts,
        totalElements: data.totalElements,
      };
    } catch (error) {
      if (controller.signal.aborted) return;
      if (requestId !== conversationRequestRef.current) return;
      const message = error instanceof Error ? error.message : "No se pudieron cargar los chats";
      setConversationListError(message);
      throw error;
    } finally {
      if (append) isLoadingMoreConversationsRef.current = false;
      if (requestId === conversationRequestRef.current) {
        conversationAbortRef.current = null;
        setIsConversationListLoading(false);
        setIsLoadingMoreConversations(false);
      }
    }
  }, [activeFilter, conversationSearch, selectedTagFilterId, unreadOnly]);

  useEffect(() => {
    const controller = new AbortController();
    void authFetch("/api/crm/whatsapp/quick-messages?area=SALES", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readQuickMessageApiError(response, "No se pudieron cargar los comandos"));
        setQuickMessages((await response.json()) as QuickMessage[]);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          toast.error(error instanceof Error ? error.message : "No se pudieron cargar los comandos");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setQuickMessagesLoading(false);
      });
    return () => controller.abort();
  }, []);

  const refreshConversationCounts = useCallback(async () => {
    const view = activeFilter === "agent" ? "AGENT"
      : activeFilter === "mine" ? "MINE"
      : activeFilter === "waiting" ? "WAITING"
        : activeFilter === "resolved" ? "RESOLVED" : "ALL";
    const params = new URLSearchParams({ view, page: "0", size: "1" });
    if (conversationSearch) params.set("q", conversationSearch);
    if (selectedTagFilterId) params.set("tagId", selectedTagFilterId);
    if (unreadOnly) params.set("unreadOnly", "true");
    const response = await authFetch(`/api/crm/whatsapp/conversations?${params.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) return;
    const data = (await response.json()) as ConversationPageResponse;
    setConversationCounts(data.counts);
    const cacheKey = `${view}|${conversationSearch}|${selectedTagFilterId ?? ""}|${unreadOnly ? "unread" : "all"}`;
    const cached = conversationCacheRef.current[cacheKey];
    if (cached) conversationCacheRef.current[cacheKey] = { ...cached, counts: data.counts };
  }, [activeFilter, conversationSearch, selectedTagFilterId, unreadOnly]);

  useEffect(() => {
    const controller = new AbortController();
    void authFetch("/api/crm/whatsapp/connections/sales/status", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("WhatsApp no esta disponible");
        setWhatsappConnection((await response.json()) as WhatsappConnectionState);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setWhatsappConnection(null);
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    refreshConversationCountsRef.current = () => {
      if (conversationCountsRefreshTimerRef.current != null) {
        window.clearTimeout(conversationCountsRefreshTimerRef.current);
      }
      conversationCountsRefreshTimerRef.current = window.setTimeout(() => {
        conversationCountsRefreshTimerRef.current = null;
        void refreshConversationCounts().catch(() => undefined);
      }, 150);
    };
    return () => {
      if (conversationCountsRefreshTimerRef.current != null) {
        window.clearTimeout(conversationCountsRefreshTimerRef.current);
      }
    };
  }, [refreshConversationCounts]);

  const storeMessageCache = useCallback((
    conversationId: string,
    nextMessages: ChatMessage[],
    meta: MessageCacheMeta,
  ) => {
    const uniqueMessages = dedupeMessages(nextMessages);
    allMessagesRef.current = { ...allMessagesRef.current, [conversationId]: uniqueMessages };
    messageCacheMetaRef.current = { ...messageCacheMetaRef.current, [conversationId]: meta };
    const nextLru = [conversationId, ...messageCacheLruRef.current.filter((id) => id !== conversationId)];
    const evicted = nextLru.slice(MESSAGE_CACHE_LIMIT);
    messageCacheLruRef.current = nextLru.slice(0, MESSAGE_CACHE_LIMIT);
    for (const evictedId of evicted) {
      for (const message of allMessagesRef.current[evictedId] ?? []) {
        if (message.fileUrl?.startsWith("blob:")) URL.revokeObjectURL(message.fileUrl);
        if (message.audioUrl?.startsWith("blob:")) URL.revokeObjectURL(message.audioUrl);
      }
      delete allMessagesRef.current[evictedId];
      delete messageCacheMetaRef.current[evictedId];
    }
    return uniqueMessages;
  }, []);

  const loadMessages = useCallback(async (
    conversationId: string,
    options?: { beforeId?: number; afterId?: number; preserveLocal?: boolean },
  ) => {
    messageAbortRef.current?.abort();
    const controller = new AbortController();
    messageAbortRef.current = controller;
    const isOlderRequest = options?.beforeId != null;
    const requestId = ++messageRequestRef.current;
    if (isOlderRequest) setIsOlderMessagesLoading(true);
    else if (options?.afterId == null) setIsMessagesLoading(true);

    const params = new URLSearchParams({ limit: String(MESSAGE_PAGE_SIZE) });
    if (options?.beforeId != null) params.set("beforeId", String(options.beforeId));
    if (options?.afterId != null) params.set("afterId", String(options.afterId));
    try {
      const response = await authFetch(
        `/api/crm/whatsapp/conversations/${conversationId}/messages?${params.toString()}`,
        { cache: "no-store", signal: controller.signal },
      );
      if (!response.ok) {
        throw new Error(await readApiMessage(response, "No se pudieron cargar los mensajes"));
      }
      const data = (await response.json()) as MessagePageResponse;
      if (requestId !== messageRequestRef.current && !isOlderRequest) return;

      const existing = allMessagesRef.current[conversationId] ?? [];
      const mapped = data.content.map((message) => mapMessage(message));
      const localOnly = existing.filter((message) => isLocalTransientMessage(message));
      const combined = options?.beforeId != null
        ? [...mapped, ...existing]
        : options?.afterId != null
          ? [...existing, ...mapped]
          : options?.preserveLocal
            ? [...mapped, ...localOnly]
            : mapped;
      const nextMessages = Array.from(new Map(combined.map((message) => [message.id, message])).values());
      const previousMeta = messageCacheMetaRef.current[conversationId];
      const meta: MessageCacheMeta = {
        oldestId: options?.afterId != null
          ? previousMeta?.oldestId ?? data.oldestId
          : data.oldestId ?? previousMeta?.oldestId ?? null,
        newestId: options?.beforeId != null
          ? previousMeta?.newestId ?? data.newestId
          : data.newestId ?? previousMeta?.newestId ?? null,
        hasMoreBefore: options?.afterId != null
          ? previousMeta?.hasMoreBefore ?? false
          : data.hasMoreBefore,
      };
      const cachedMessages = storeMessageCache(conversationId, nextMessages, meta);
      if (activeConversationIdRef.current === conversationId) {
        setMessages(cachedMessages);
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      throw error;
    } finally {
      if (requestId === messageRequestRef.current) messageAbortRef.current = null;
      if (isOlderRequest) setIsOlderMessagesLoading(false);
      else if (requestId === messageRequestRef.current) setIsMessagesLoading(false);
    }
  }, [storeMessageCache]);

  const updateConversationReadState = async (conversationId: string, unread: boolean) => {
    const previousConversation = conversationsRef.current.find((conversation) => conversation.id === conversationId)
      ?? (activeConversationSnapshot?.id === conversationId ? activeConversationSnapshot : null);
    const previousUnreadCount = previousConversation?.unreadCount ?? 0;
    if ((!unread && previousUnreadCount === 0) || (unread && previousUnreadCount > 0)) return;

    const optimisticConversation = previousConversation
      ? {
          ...previousConversation,
          unreadCount: unread ? Math.max(1, previousUnreadCount) : 0,
        }
      : null;
    const wasInList = conversationsRef.current.some((conversation) => conversation.id === conversationId);
    const adjustUnreadCounts = (delta: number) => {
      if (!previousConversation || !unreadOnly) return;
      const decrementSafely = (value: number) => Math.max(0, value + delta);
      setConversationCounts((current) => {
        const next = { ...current, all: decrementSafely(current.all) };
        if (previousConversation.attentionQueue === "AGENT_ACTIVE") {
          next.agent = decrementSafely(current.agent);
        } else if (previousConversation.status === "RESUELTO" || previousConversation.attentionQueue === "RESOLVED") {
          next.resolved = decrementSafely(current.resolved);
        } else if (!previousConversation.assignedUserId) {
          next.waiting = decrementSafely(current.waiting);
        } else {
          next.attended = decrementSafely(current.attended);
        }
        if (previousConversation.assignedUserId === user?.idUsuario && previousConversation.status !== "RESUELTO") {
          next.mine = decrementSafely(current.mine);
        }
        return next;
      });
    };
    setReadStatePendingIds((current) => new Set(current).add(conversationId));

    if (optimisticConversation) {
      setActiveConversationSnapshot((current) => current?.id === conversationId ? optimisticConversation : current);
      setConversations((current) => {
        let next = current.map((conversation) => conversation.id === conversationId ? optimisticConversation : conversation);
        if (!unread && unreadOnly) next = next.filter((conversation) => conversation.id !== conversationId);
        conversationsRef.current = next;
        return next;
      });
      if (!unread && previousUnreadCount > 0) adjustUnreadCounts(-1);
    }

    try {
      const response = await authFetch(`/api/crm/whatsapp/conversations/${conversationId}/read-state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unread }),
      });
      if (!response.ok) {
        throw new Error(await readApiMessage(response, "No se pudo actualizar el estado de lectura"));
      }
      const updatedConversation = (await response.json()) as CrmConversationResponse;
      realtimeEventHandlerRef.current({
        type: "conversation.updated",
        conversationId: updatedConversation.id,
        conversation: updatedConversation,
      });
    } catch (error) {
      if (previousConversation) {
        setActiveConversationSnapshot((current) => current?.id === conversationId ? previousConversation : current);
        setConversations((current) => {
          let next = current.map((conversation) => conversation.id === conversationId ? previousConversation : conversation);
          if (wasInList && !next.some((conversation) => conversation.id === conversationId)) {
            next = [previousConversation, ...next];
          }
          conversationsRef.current = next;
          return next;
        });
        if (!unread && previousUnreadCount > 0) adjustUnreadCounts(1);
      }
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el estado de lectura");
    } finally {
      setReadStatePendingIds((current) => {
        const next = new Set(current);
        next.delete(conversationId);
        return next;
      });
    }
  };

  const switchConversation = async (conversationId: string) => {
    if (activeConversationId) {
      allMessagesRef.current = { ...allMessagesRef.current, [activeConversationId]: messages };
    }
    setIsActionMenuOpen(false);
    setReplyTarget(null);
    setActiveConversationSnapshot(
      conversationsRef.current.find((conversation) => conversation.id === conversationId) ?? null,
    );
    setActiveConversationId(conversationId);
    activeConversationIdRef.current = conversationId;
    setChatError("");
    void updateConversationReadState(conversationId, false);
    try {
      const cachedMessages = allMessagesRef.current[conversationId];
      const cachedMeta = messageCacheMetaRef.current[conversationId];
      if (cachedMessages) {
        setMessages(cachedMessages);
        if (cachedMeta?.newestId) {
          await loadMessages(conversationId, { afterId: cachedMeta.newestId, preserveLocal: true });
        }
      } else {
        setMessages([]);
        await loadMessages(conversationId);
      }
      if (!visitedConversationIdsRef.current.has(conversationId)) {
        let sessionId = visitSessionIdRef.current;
        if (!sessionId) {
          sessionId = window.sessionStorage.getItem("crm.sales-chat.visit-session");
          if (!sessionId) {
            sessionId = crypto.randomUUID().replaceAll("-", "");
            window.sessionStorage.setItem("crm.sales-chat.visit-session", sessionId);
          }
          visitSessionIdRef.current = sessionId;
        }
        visitedConversationIdsRef.current.add(conversationId);
        try {
          const visitResponse = await authFetch(`/api/crm/whatsapp/conversations/${conversationId}/visits`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          });
          if (!visitResponse.ok) {
            visitedConversationIdsRef.current.delete(conversationId);
          } else {
            const visitMessage = mapMessage((await visitResponse.json()) as CrmMessageResponse);
            const current = allMessagesRef.current[conversationId] ?? [];
            const next = dedupeMessages([...current, visitMessage]);
            allMessagesRef.current = { ...allMessagesRef.current, [conversationId]: next };
            if (activeConversationIdRef.current === conversationId) setMessages(next);
          }
        } catch {
          visitedConversationIdsRef.current.delete(conversationId);
        }
      }
    } catch (error) {
      if (!allMessagesRef.current[conversationId]) setMessages([]);
      setChatError(error instanceof Error ? error.message : "No se pudieron cargar los mensajes");
    }
  };

  useEffect(() => {
    if (!requestedConversationId || handledRequestedConversationRef.current === requestedConversationId) {
      return;
    }
    handledRequestedConversationRef.current = requestedConversationId;
    const timeoutId = window.setTimeout(() => {
      const openRequestedConversation = async () => {
        if (!conversationsRef.current.some((conversation) => conversation.id === requestedConversationId)) {
          const response = await authFetch(`/api/crm/whatsapp/conversations/${requestedConversationId}`, {
            cache: "no-store",
          });
          if (!response.ok) return;
          const mapped = mapConversation((await response.json()) as CrmConversationResponse);
          const next = [mapped, ...conversationsRef.current.filter((item) => item.id !== mapped.id)];
          conversationsRef.current = next;
          setConversations(next);
        }
        await switchConversation(requestedConversationId);
      };
      void openRequestedConversation();
    }, 0);
    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedConversationId, conversations]);

  const resolveConversation = async (conversationId: string) => {
    const response = await authFetch(`/api/crm/whatsapp/conversations/${conversationId}/resolve`, { method: "POST" });
    if (!response.ok) {
      throw new Error(await readApiMessage(response, "No se pudo resolver la conversacion"));
    }
    const updated = (await response.json()) as CrmConversationResponse;
    realtimeEventHandlerRef.current({
      type: "conversation.updated",
      conversationId: updated.id,
      conversation: updated,
      message: null,
    });
  };

  const handleResolveCurrent = async () => {
    if (!activeConversationId) return;
    const conversationId = activeConversationId;
    allMessagesRef.current = { ...allMessagesRef.current, [conversationId]: messages };
    const toastId = toast.loading("Resolviendo la conversacion...");
    setIsConversationActionPending(true);
    try {
      await resolveConversation(conversationId);
      setActiveConversationId(null);
      setMessages([]);
      setReplyTarget(null);
      setMobileView("list");
      toast.success("Conversacion resuelta", { id: toastId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo resolver la conversacion";
      setChatError(message);
      toast.error(message, { id: toastId });
    } finally {
      setIsConversationActionPending(false);
    }
  };

  const handleReopenCurrent = async () => {
    if (!activeConversationId) return;
    const toastId = toast.loading("Reabriendo la conversacion...");
    setIsConversationActionPending(true);
    try {
      const response = await authFetch(`/api/crm/whatsapp/conversations/${activeConversationId}/reopen`, { method: "POST" });
      if (!response.ok) {
        throw new Error(await readApiMessage(response, "No se pudo reabrir la conversacion"));
      }
      const updated = (await response.json()) as CrmConversationResponse;
      realtimeEventHandlerRef.current({
        type: "conversation.updated",
        conversationId: updated.id,
        conversation: updated,
        message: null,
      });
      setActiveFilter("waiting");
      toast.success("Conversacion reabierta", { id: toastId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo reabrir la conversacion";
      setChatError(message);
      toast.error(message, { id: toastId });
    } finally {
      setIsConversationActionPending(false);
    }
  };

  const handleAcceptCurrent = async (targetConversationId = activeConversationId) => {
    if (!targetConversationId || acceptingConversationId) return;
    const conversationId = targetConversationId;
    setAcceptingConversationId(conversationId);
    setChatError("");
    try {
      const response = await authFetch(`/api/crm/whatsapp/conversations/${conversationId}/accept`, { method: "POST" });
      if (!response.ok) {
        throw new Error(await readApiMessage(response, "No se pudo aceptar el chat"));
      }
      const accepted = mapConversation((await response.json()) as CrmConversationResponse);
      setConversations((current) =>
        current.map((conversation) => conversation.id === conversationId ? accepted : conversation),
      );
      setActiveFilter("all");
      await loadMessages(conversationId);
      toast.success("Chat aceptado. Atencion humana activada");
    } catch (error) {
      setActiveConversationId(null);
      setMessages([]);
      setChatError(error instanceof Error ? error.message : "No se pudo aceptar el chat");
    } finally {
      setAcceptingConversationId(null);
    }
  };

  const handleEnableAgentCurrent = async () => {
    if (!activeConversationId || isConversationActionPending) return;
    const conversationId = activeConversationId;
    const toastId = toast.loading("Habilitando IA Kiments...");
    setIsConversationActionPending(true);
    setChatError("");
    try {
      const response = await authFetch(`/api/crm/whatsapp/conversations/${conversationId}/enable-agent`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(await readApiMessage(response, "No se pudo habilitar IA Kiments"));
      }
      const result = (await response.json()) as EnableAgentResponse;
      const updated = mapConversation(result.conversation);
      setConversations((current) => {
        const next = current.map((conversation) => conversation.id === conversationId ? updated : conversation);
        conversationsRef.current = next;
        return next;
      });
      conversationCacheRef.current = {};
      setActiveFilter("agent");
      toast.success(
        result.pendingCustomerMessage
          ? "IA Kiments habilitada. Responderá el mensaje pendiente."
          : "IA Kiments habilitada. Esperará el próximo mensaje del cliente.",
        { id: toastId },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo habilitar IA Kiments";
      setChatError(message);
      toast.error(message, { id: toastId });
    } finally {
      setIsConversationActionPending(false);
    }
  };

  const openTransferModal = async () => {
    if (!activeConversationId || isUnassignedWaitingActive) return;
    setIsActionMenuOpen(false);
    setIsTransferModalOpen(true);
    setTransferSearch("");
    setSelectedTransferUserId(null);
    setTransferError("");
    setIsLoadingTransferUsers(true);
    try {
      const response = await authFetch("/api/crm/whatsapp/transfer-users", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await readApiMessage(response, "No se pudieron cargar los usuarios"));
      }
      setTransferUsers((await response.json()) as TransferUserResponse[]);
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : "No se pudieron cargar los usuarios");
    } finally {
      setIsLoadingTransferUsers(false);
    }
  };

  const handleTransferCurrent = async () => {
    if (!activeConversationId || !selectedTransferUserId || isTransferring) return;
    setIsTransferring(true);
    setTransferError("");
    try {
      const response = await authFetch(`/api/crm/whatsapp/conversations/${activeConversationId}/transfer`, {
        method: "POST",
        body: JSON.stringify({ assignedUserId: selectedTransferUserId }),
      });
      if (!response.ok) {
        throw new Error(await readApiMessage(response, "No se pudo transferir el chat"));
      }
      const transferredResponse = (await response.json()) as CrmConversationResponse;
      realtimeEventHandlerRef.current({
        type: "conversation.updated",
        conversationId: transferredResponse.id,
        conversation: transferredResponse,
        message: null,
      });
      setIsTransferModalOpen(false);
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : "No se pudo transferir el chat");
    } finally {
      setIsTransferring(false);
    }
  };

  const filteredConversations = conversations;

  const changeFilter = (filter: ConversationFilter) => {
    setActiveFilter(filter);
    if (activeConversationId) {
      const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId);
      const willBeVisible = filter === "all"
        || (filter === "agent" && activeConversation?.attentionQueue === "AGENT_ACTIVE")
        || (filter === "mine" && activeConversation?.assignedUserId === user?.idUsuario && activeConversation?.status !== "RESUELTO")
        || (filter === "waiting" && activeConversation?.attentionQueue === "ADVISOR_REQUIRED")
        || (filter === "resolved" && activeConversation?.attentionQueue === "RESOLVED");
      if (!willBeVisible) {
        allMessagesRef.current = { ...allMessagesRef.current, [activeConversationId]: messages };
        setActiveConversationId(null);
        setMessages([]);
        setReplyTarget(null);
      }
    }
  };

  const toggleUnreadOnly = () => {
    const nextUnreadOnly = !unreadOnly;
    setUnreadOnly(nextUnreadOnly);
    if (!nextUnreadOnly || !activeConversationId) return;
    const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId)
      ?? (activeConversationSnapshot?.id === activeConversationId ? activeConversationSnapshot : null);
    if ((activeConversation?.unreadCount ?? 0) > 0) return;
    allMessagesRef.current = { ...allMessagesRef.current, [activeConversationId]: messages };
    setActiveConversationId(null);
    setMessages([]);
    setReplyTarget(null);
  };

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    realtimeStatusRef.current = realtimeStatus;
  }, [realtimeStatus]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const term = conversationSearchInput.trim();
      setConversationSearch(term.length >= 2 ? term : "");
    }, 400);
    return () => window.clearTimeout(timeoutId);
  }, [conversationSearchInput]);

  const applyRealtimeEvent = useCallback((event: CrmRealtimeEvent) => {
    if (event.type === "whatsapp.connection.updated" && event.connection) {
      if ((event.connectionId || event.connection.clientId) !== "kiments-sales") return;
      setWhatsappConnection(event.connection);
      const conversationId = activeConversationIdRef.current;
      if (conversationId && !event.connection.phoneChanged) {
        void loadMessages(conversationId, { preserveLocal: true }).catch(() => undefined);
      }
      return;
    }
    if (event.type.startsWith("payment.")) {
      window.dispatchEvent(new CustomEvent("crm-payment-event", { detail: event }));
      return;
    }
    if (!event.conversation) return;
    if (event.conversation.area !== "SALES") return;
    window.dispatchEvent(new CustomEvent("crm-agent-event", { detail: event }));
    const mappedConversation = mapConversation(event.conversation);
    if (activeConversationIdRef.current === mappedConversation.id) {
      setActiveConversationSnapshot(mappedConversation);
    }
    const isInternalActivity = event.message?.origin === "CRM_ACTIVITY";
    if (!isInternalActivity) {
      refreshConversationCountsRef.current();
    }
    const expectedQueue: AttentionQueue = activeFilter === "agent" ? "AGENT_ACTIVE"
      : activeFilter === "mine" ? "HUMAN_ACTIVE"
      : activeFilter === "waiting" ? "ADVISOR_REQUIRED"
        : activeFilter === "resolved" ? "RESOLVED" : "HUMAN_ACTIVE";
    const matchesCategory = activeFilter === "all"
      ? true
      : activeFilter === "agent"
        ? mappedConversation.attentionQueue === "AGENT_ACTIVE"
      : activeFilter === "mine"
        ? mappedConversation.assignedUserId === user?.idUsuario && mappedConversation.status !== "RESUELTO"
      : activeFilter === "waiting"
        ? !mappedConversation.assignedUserId
          && mappedConversation.status !== "RESUELTO"
          && mappedConversation.attentionQueue !== "AGENT_ACTIVE"
        : mappedConversation.attentionQueue === expectedQueue;
    const matchesActiveList = matchesCategory && (!unreadOnly || (mappedConversation.unreadCount ?? 0) > 0);

    setConversations((current) => {
      const exists = current.some((item) => item.id === mappedConversation.id);
      let next = current.filter((item) => item.id !== mappedConversation.id);
      if (event.type !== "conversation.removed" && matchesActiveList && (exists || (!conversationSearch && !selectedTagFilterId))) {
        next = exists && (isInternalActivity || event.type !== "message.created")
          ? current.map((item) => item.id === mappedConversation.id ? mappedConversation : item)
          : [mappedConversation, ...next].slice(0, Math.max(CONVERSATION_PAGE_SIZE, current.length));
      }
      conversationsRef.current = next;
      return next;
    });

    for (const [cacheKey, entry] of Object.entries(conversationCacheRef.current)) {
      const [cacheView, cacheSearch, cacheTag, cacheUnread] = cacheKey.split("|");
      const exists = entry.items.some((item) => item.id === mappedConversation.id);
      let items = entry.items.filter((item) => item.id !== mappedConversation.id);
      const matchesCacheUnread = cacheUnread !== "unread" || (mappedConversation.unreadCount ?? 0) > 0;
      if (
        event.type !== "conversation.removed"
        && matchesCacheUnread
        && (cacheView === "ALL"
          ? true
          : cacheView === "MINE"
            ? mappedConversation.assignedUserId === user?.idUsuario && mappedConversation.status !== "RESUELTO"
          : cacheView === "AGENT"
            ? mappedConversation.attentionQueue === "AGENT_ACTIVE"
          : cacheView === "WAITING"
            ? !mappedConversation.assignedUserId
              && mappedConversation.status !== "RESUELTO"
              && mappedConversation.attentionQueue !== "AGENT_ACTIVE"
            : mappedConversation.attentionQueue === ({ ATTENDED: "HUMAN_ACTIVE", RESOLVED: "RESOLVED" } as Record<string, AttentionQueue>)[cacheView])
        && (exists || (!cacheSearch && !cacheTag))
      ) {
        items = exists && (isInternalActivity || event.type !== "message.created")
          ? entry.items.map((item) => item.id === mappedConversation.id ? mappedConversation : item)
          : [mappedConversation, ...items].slice(0, Math.max(CONVERSATION_PAGE_SIZE, entry.items.length));
      }
      conversationCacheRef.current[cacheKey] = { ...entry, items };
    }

    if (!event.message) return;
    const conversationId = String(event.conversationId);
    if (
      (event.type === "message.created" || event.type === "message.updated")
      && !event.message.deleted
      && event.message.mediaStoragePath
      && event.message.mediaUrl
    ) {
      setGalleryRealtimeMedia({
        conversationId,
        item: {
          id: event.message.id,
          messageType: event.message.messageType,
          mimeType: event.message.mediaMimeType ?? null,
          fileName: event.message.mediaFileName ?? null,
          description: event.message.body ?? null,
          direction: event.message.direction,
          createdAt: event.message.createdAt,
          mediaUrl: event.message.mediaUrl,
        },
      });
    }
    const mappedMessage = mapMessage(event.message);
    const existingMessages = allMessagesRef.current[conversationId] ?? [];
    const nextMessages = event.type === "message.deleted" || event.message.deleted
      ? existingMessages.filter((message) => message.id !== mappedMessage.id)
      : event.type === "message.updated"
      ? existingMessages.map((message) => message.id === mappedMessage.id ? mappedMessage : message)
      : Array.from(new Map([...existingMessages, mappedMessage].map((message) => [message.id, message])).values());
    const previousMeta = messageCacheMetaRef.current[conversationId];
    const numericId = Number(event.message.id);
    const cachedMessages = storeMessageCache(conversationId, nextMessages, {
      oldestId: previousMeta?.oldestId ?? (Number.isFinite(numericId) ? numericId : null),
      newestId: Number.isFinite(numericId)
        ? Math.max(previousMeta?.newestId ?? numericId, numericId)
        : previousMeta?.newestId ?? null,
      hasMoreBefore: previousMeta?.hasMoreBefore ?? false,
    });
    if (activeConversationIdRef.current === conversationId) {
      setMessages(cachedMessages);
    }
  }, [activeFilter, conversationSearch, loadMessages, selectedTagFilterId, storeMessageCache, unreadOnly, user?.idUsuario]);

  useEffect(() => {
    realtimeEventHandlerRef.current = applyRealtimeEvent;
  }, [applyRealtimeEvent]);

  useEffect(() => {
    realtimeResyncRef.current = () => {
      void loadConversations({ reset: true, force: true }).catch(() => undefined);
      const conversationId = activeConversationIdRef.current;
      const newestId = conversationId ? messageCacheMetaRef.current[conversationId]?.newestId : null;
      if (conversationId && newestId) {
        void loadMessages(conversationId, { afterId: newestId, preserveLocal: true }).catch(() => undefined);
      }
    };
  }, [loadConversations, loadMessages]);

  useEffect(() => {
    let disposed = false;
    let controller: AbortController | null = null;
    let reconnectTimer: number | null = null;
    let fallbackInterval: number | null = null;
    let retryAttempt = 0;
    let hasConnected = false;

    const stopFallback = () => {
      if (fallbackInterval != null) window.clearInterval(fallbackInterval);
      fallbackInterval = null;
    };

    const startFallback = () => {
      if (fallbackInterval != null) return;
      fallbackInterval = window.setInterval(() => {
        if (!document.hidden) realtimeResyncRef.current();
      }, 30000);
    };

    const scheduleReconnect = () => {
      if (disposed || document.hidden || reconnectTimer != null) return;
      const delay = Math.min(30000, 1000 * 2 ** Math.min(retryAttempt, 5));
      retryAttempt += 1;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, delay);
    };

    const connect = async () => {
      if (disposed || document.hidden) return;
      controller?.abort();
      controller = new AbortController();
      setRealtimeStatus(hasConnected ? "reconnecting" : "connecting");
      try {
        const response = await authFetch("/api/crm/whatsapp/events", {
          cache: "no-store",
          headers: { Accept: "text/event-stream" },
          signal: controller.signal,
        });
        if (!response.ok || !response.body) throw new Error("Canal SSE no disponible");
        retryAttempt = 0;
        stopFallback();
        if (hasConnected) realtimeResyncRef.current();
        hasConnected = true;
        setRealtimeStatus("live");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!disposed && !controller.signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
          let boundary = buffer.indexOf("\n\n");
          while (boundary >= 0) {
            const block = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const eventName = block.split("\n").find((line) => line.startsWith("event:"))?.slice(6).trim();
            const data = block.split("\n")
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.slice(5).trimStart())
              .join("\n");
            if (eventName === "crm-event" && data) {
              try {
                realtimeEventHandlerRef.current(JSON.parse(data) as CrmRealtimeEvent);
              } catch {
                // Ignorar un evento incompleto sin cerrar el canal.
              }
            }
            boundary = buffer.indexOf("\n\n");
          }
        }
        if (!disposed && !document.hidden) throw new Error("Canal SSE cerrado");
      } catch {
        if (disposed || controller?.signal.aborted || document.hidden) return;
        setRealtimeStatus("reconnecting");
        startFallback();
        scheduleReconnect();
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        controller?.abort();
        if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
        stopFallback();
        return;
      }
      realtimeResyncRef.current();
      void connect();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    void connect();
    return () => {
      disposed = true;
      controller?.abort();
      if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
      stopFallback();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadConversations({ reset: true }).catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadConversations]);

  useEffect(() => () => {
    conversationAbortRef.current?.abort();
    messageAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
    shouldStickToBottomRef.current = true;
  }, [activeConversationId]);

  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState<ConversationTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagSaving, setTagSaving] = useState(false);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0].value);
  const selectedTagFilter = availableTags.find((tag) => tag.id === selectedTagFilterId) ?? null;

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId)
    ?? (activeConversationSnapshot?.id === activeConversationId ? activeConversationSnapshot : null);
  const activeConversationTags = activeConversation?.tags ?? [];
  const allConversationCount = conversationCounts.all;
  const agentConversationCount = conversationCounts.agent;
  const mineConversationCount = conversationCounts.mine ?? 0;
  const waitingCount = conversationCounts.waiting;
  const isAgentActive = activeConversation?.attentionQueue === "AGENT_ACTIVE";
  const isSharedUnassignedActive = Boolean(
    activeConversation
    && !activeConversation.assignedUserId
    && activeConversation.status !== "RESUELTO"
    && activeConversation.attentionQueue !== "AGENT_ACTIVE",
  );
  const isUnassignedWaitingActive = isSharedUnassignedActive;
  const canOperateActiveConversation = Boolean(activeConversationId)
    && !isUnassignedWaitingActive
    && activeConversation?.status !== "RESUELTO"
    && activeConversation?.attentionQueue !== "AGENT_ACTIVE";
  const canManageActiveConversation = Boolean(activeConversationId)
    && (isAdmin || activeConversation?.assignedUserId === user?.idUsuario);
  const filteredTransferUsers = transferUsers.filter((transferUser) => {
    if (transferUser.id === activeConversation?.assignedUserId) {
      return false;
    }
    const term = transferSearch.trim().toLowerCase();
    if (!term) {
      return true;
    }
    return `${transferUser.name} ${transferUser.role} ${transferUser.email}`.toLowerCase().includes(term);
  });

  const setConversationTagsForChat = useCallback((conversationId: string, tags: ConversationTag[]) => {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, tags } : conversation,
      ),
    );
  }, []);

  const loadAvailableTags = useCallback(async () => {
    setTagsLoading(true);
    try {
      const response = await authFetch("/api/crm/whatsapp/tags", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await readApiMessage(response, "No se pudieron cargar las etiquetas"));
      }
      const data = (await response.json()) as CrmTagResponse[];
      setAvailableTags(data.map(mapCrmTag));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron cargar las etiquetas");
    } finally {
      setTagsLoading(false);
    }
  }, []);

  const assignTag = async (tagId: string) => {
    if (!activeConversationId) return;
    setTagSaving(true);
    try {
      const response = await authFetch(`/api/crm/whatsapp/conversations/${activeConversationId}/tags/${tagId}`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(await readApiMessage(response, "No se pudo asignar la etiqueta"));
      }
      const data = (await response.json()) as CrmConversationTagResponse[];
      setConversationTagsForChat(activeConversationId, data.map(mapConversationTag));
      toast.success("Etiqueta asignada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo asignar la etiqueta");
    } finally {
      setTagSaving(false);
    }
  };

  const addTag = async () => {
    if (!activeConversationId || !newTagLabel.trim()) return;
    const label = newTagLabel.trim();
    const existing = availableTags.find((tag) => tag.label.toLowerCase() === label.toLowerCase());
    setTagSaving(true);
    try {
      let tagId = existing?.id;
      if (!tagId) {
        const createResponse = await authFetch("/api/crm/whatsapp/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre: label, color: newTagColor }),
        });
        if (!createResponse.ok) {
          throw new Error(await readApiMessage(createResponse, "No se pudo crear la etiqueta"));
        }
        const created = mapCrmTag((await createResponse.json()) as CrmTagResponse);
        tagId = created.id;
        setAvailableTags((current) => [...current, created].sort((a, b) => a.label.localeCompare(b.label)));
      }
      const assignResponse = await authFetch(`/api/crm/whatsapp/conversations/${activeConversationId}/tags/${tagId}`, {
        method: "POST",
      });
      if (!assignResponse.ok) {
        throw new Error(await readApiMessage(assignResponse, "No se pudo asignar la etiqueta"));
      }
      const data = (await assignResponse.json()) as CrmConversationTagResponse[];
      setConversationTagsForChat(activeConversationId, data.map(mapConversationTag));
      setNewTagLabel("");
      setNewTagColor(TAG_COLORS[0].value);
      toast.success("Etiqueta agregada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo agregar la etiqueta");
    } finally {
      setTagSaving(false);
    }
  };

  const removeTag = async (tagId: string) => {
    if (!activeConversationId) return;
    setTagSaving(true);
    try {
      const response = await authFetch(`/api/crm/whatsapp/conversations/${activeConversationId}/tags/${tagId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(await readApiMessage(response, "No se pudo quitar la etiqueta"));
      }
      const data = (await response.json()) as CrmConversationTagResponse[];
      setConversationTagsForChat(activeConversationId, data.map(mapConversationTag));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo quitar la etiqueta");
    } finally {
      setTagSaving(false);
    }
  };

  const openTagModal = () => {
    setNewTagLabel("");
    setNewTagColor(TAG_COLORS[0].value);
    setIsTagModalOpen(true);
    void loadAvailableTags();
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarPanel, setSidebarPanel] = useState<ChatSidebarPanel>("sale");
  const [galleryRealtimeMedia, setGalleryRealtimeMedia] = useState<GalleryRealtimePayload | null>(null);
  const openQuickSaleSidebar = () => {
    setSidebarPanel("sale");
    setIsSidebarOpen(true);
  };
  const openGallerySidebar = () => {
    setSidebarPanel("gallery");
    setIsSidebarOpen(true);
  };

  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [activeMobileEmojiCategory, setActiveMobileEmojiCategory] =
    useState(mobileEmojiCategories[0].id);
  const [mobileView, setMobileView] = useState<"list" | "conversation">("list");

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("crm:chat-mobile-view", {
        detail: { conversationOpen: mobileView === "conversation" },
      }),
    );
  }, [mobileView]);
  const [isDesktopRecording, setIsDesktopRecording] = useState(false);
  const [desktopRecordingSeconds, setDesktopRecordingSeconds] = useState(0);
  const [desktopRecorderError, setDesktopRecorderError] = useState("");
  const [desktopAudioPreview, setDesktopAudioPreview] = useState<{
    blob: Blob;
    audioUrl: string;
    duration: number;
  } | null>(null);
  const [isDesktopAudioPreviewPlaying, setIsDesktopAudioPreviewPlaying] =
    useState(false);
  const [desktopAudioProgress, setDesktopAudioProgress] = useState(0);
  const [isMobileRecording, setIsMobileRecording] = useState(false);
  const [mobileRecordingSeconds, setMobileRecordingSeconds] = useState(0);
  const [mobileAudioPreview, setMobileAudioPreview] = useState<{
    blob: Blob;
    audioUrl: string;
    duration: number;
  } | null>(null);
  const [isMobileAudioPreviewPlaying, setIsMobileAudioPreviewPlaying] =
    useState(false);
  const [mobileAudioProgress, setMobileAudioProgress] = useState(0);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>(
    [],
  );
  const [activeAttachmentId, setActiveAttachmentId] = useState<string | null>(null);
  const [attachmentCaption, setAttachmentCaption] = useState("");
  const [pdfPageCounts, setPdfPageCounts] = useState<Record<string, number>>({});
  const [imagePreview, setImagePreview] = useState<{
    alt: string;
    url: string;
  } | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const dragDepthRef = useRef(0);
  const pendingAttachmentsRef = useRef<PendingAttachment[]>([]);
  const mobileInputRef = useRef<HTMLTextAreaElement>(null);
  const desktopInputRef = useRef<HTMLTextAreaElement>(null);
  const mobileEmojiPanelRef = useRef<HTMLDivElement>(null);
  const desktopEmojiPanelRef = useRef<HTMLDivElement>(null);
  const mobileEmojiButtonRef = useRef<HTMLButtonElement>(null);
  const desktopEmojiButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingCursorPositionRef = useRef<number | null>(null);
  const desktopMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const desktopAudioChunksRef = useRef<Blob[]>([]);
  const desktopRecordingStreamRef = useRef<MediaStream | null>(null);
  const desktopRecordingStartedAtRef = useRef(0);
  const desktopRecordingIntervalRef = useRef<number | null>(null);
  const desktopRecordingActionRef = useRef<"preview" | "send" | "cancel">(
    "preview",
  );
  const desktopAudioPreviewRef = useRef<HTMLAudioElement>(null);
  const recordedAudioUrlsRef = useRef<string[]>([]);
  const mobileMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mobileAudioChunksRef = useRef<Blob[]>([]);
  const mobileRecordingStreamRef = useRef<MediaStream | null>(null);
  const mobileRecordingStartedAtRef = useRef(0);
  const mobileRecordingIntervalRef = useRef<number | null>(null);
  const mobileAudioPreviewRef = useRef<HTMLAudioElement>(null);

  const isMobileViewport = () =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

  const getActiveMessageInput = () =>
    isMobileViewport() ? mobileInputRef.current : desktopInputRef.current;
  const emojiPickerTheme = resolvedTheme === "dark" ? Theme.DARK : Theme.LIGHT;
  const getMessageTime = () =>
    new Intl.DateTimeFormat("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());

  const resizeMessageTextarea = (textarea: HTMLTextAreaElement | null) => {
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, MESSAGE_TEXTAREA_MAX_HEIGHT);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > MESSAGE_TEXTAREA_MAX_HEIGHT ? "auto" : "hidden";
  };

  const clearDesktopRecordingTimer = () => {
    if (desktopRecordingIntervalRef.current === null) {
      return;
    }

    window.clearInterval(desktopRecordingIntervalRef.current);
    desktopRecordingIntervalRef.current = null;
  };

  const stopDesktopRecordingStream = () => {
    desktopRecordingStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    desktopRecordingStreamRef.current = null;
  };

  const revokeRecordedAudioUrl = (audioUrl: string) => {
    URL.revokeObjectURL(audioUrl);
    recordedAudioUrlsRef.current = recordedAudioUrlsRef.current.filter(
      (recordedAudioUrl) => recordedAudioUrl !== audioUrl,
    );
  };

  const handleDeleteDesktopAudioPreview = () => {
    if (!desktopAudioPreview) {
      return;
    }

    desktopAudioPreviewRef.current?.pause();
    setIsDesktopAudioPreviewPlaying(false);
    setDesktopAudioProgress(0);
    revokeRecordedAudioUrl(desktopAudioPreview.audioUrl);
    setDesktopAudioPreview(null);
  };

  const handleToggleDesktopAudioPreview = () => {
    const audio = desktopAudioPreviewRef.current;

    if (!audio) {
      return;
    }

    if (audio.paused) {
      if (audio.duration && audio.currentTime >= audio.duration) {
        audio.currentTime = 0;
        setDesktopAudioProgress(0);
      }

      void audio.play();
      setIsDesktopAudioPreviewPlaying(true);
      return;
    }

    audio.pause();
    setIsDesktopAudioPreviewPlaying(false);
  };

  const handleSendDesktopAudioPreview = () => {
    if (!desktopAudioPreview) {
      return;
    }

    desktopAudioPreviewRef.current?.pause();
    setIsDesktopAudioPreviewPlaying(false);
    setDesktopAudioProgress(0);

    sendRecordedAudio(
      desktopAudioPreview.blob,
      desktopAudioPreview.audioUrl,
      desktopAudioPreview.duration,
    );
    setDesktopAudioPreview(null);
  };

  useEffect(() => {
    const audio = desktopAudioPreviewRef.current;

    if (!audio) {
      return;
    }

    const handleTimeUpdate = () => {
      if (audio.duration) {
        setDesktopAudioProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleEnded = () => {
      setIsDesktopAudioPreviewPlaying(false);
      setDesktopAudioProgress(100);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [desktopAudioPreview]);

  const handleFinishDesktopAudioRecording = () => {
    clearDesktopRecordingTimer();
    stopDesktopRecordingStream();

    const recorder = desktopMediaRecorderRef.current;
    const audioChunks = desktopAudioChunksRef.current;
    const recordingAction = desktopRecordingActionRef.current;
    const duration = Math.max(
      1,
      Math.round((getTimestamp() - desktopRecordingStartedAtRef.current) / 1000),
    );

    setIsDesktopRecording(false);
    setDesktopRecordingSeconds(0);
    desktopMediaRecorderRef.current = null;
    desktopAudioChunksRef.current = [];
    desktopRecordingActionRef.current = "preview";

    if (recordingAction === "cancel" || audioChunks.length === 0) {
      return;
    }

    const audioBlob = new Blob(audioChunks, {
      type: recorder?.mimeType || "audio/webm",
    });
    const audioUrl = URL.createObjectURL(audioBlob);
    recordedAudioUrlsRef.current.push(audioUrl);

    if (recordingAction === "send") {
      sendRecordedAudio(audioBlob, audioUrl, duration);
      return;
    }

    setDesktopAudioProgress(0);
    setDesktopAudioPreview({ blob: audioBlob, audioUrl, duration });
  };

  const clearMobileRecordingTimer = () => {
    if (mobileRecordingIntervalRef.current === null) return;
    window.clearInterval(mobileRecordingIntervalRef.current);
    mobileRecordingIntervalRef.current = null;
  };

  const stopMobileRecordingStream = () => {
    mobileRecordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    mobileRecordingStreamRef.current = null;
  };

  const handleDeleteMobileAudioPreview = () => {
    if (!mobileAudioPreview) return;
    mobileAudioPreviewRef.current?.pause();
    setIsMobileAudioPreviewPlaying(false);
    setMobileAudioProgress(0);
    URL.revokeObjectURL(mobileAudioPreview.audioUrl);
    setMobileAudioPreview(null);
  };

  const handleToggleMobileAudioPreview = () => {
    const audio = mobileAudioPreviewRef.current;
    if (!audio) return;
    if (audio.paused) {
      if (audio.duration && audio.currentTime >= audio.duration) {
        audio.currentTime = 0;
        setMobileAudioProgress(0);
      }

      void audio.play();
      setIsMobileAudioPreviewPlaying(true);
    } else {
      audio.pause();
      setIsMobileAudioPreviewPlaying(false);
    }
  };

  useEffect(() => {
    const audio = mobileAudioPreviewRef.current;
    if (!audio) return;
    const handleTimeUpdate = () => {
      if (audio.duration) setMobileAudioProgress((audio.currentTime / audio.duration) * 100);
    };
    const handleEnded = () => {
      setIsMobileAudioPreviewPlaying(false);
      setMobileAudioProgress(0);
    };
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [mobileAudioPreview]);

  const handleSendMobileAudioPreview = () => {
    if (!mobileAudioPreview) return;
    mobileAudioPreviewRef.current?.pause();
    setIsMobileAudioPreviewPlaying(false);
    setMobileAudioProgress(0);
    sendRecordedAudio(
      mobileAudioPreview.blob,
      mobileAudioPreview.audioUrl,
      mobileAudioPreview.duration,
    );
    setMobileAudioPreview(null);
  };

  const handleFinishMobileAudioRecording = (action: "cancel" | "preview" | "send") => {
    clearMobileRecordingTimer();
    stopMobileRecordingStream();

    const recorder = mobileMediaRecorderRef.current;
    const audioChunks = mobileAudioChunksRef.current;
    const duration = Math.max(
      1,
      Math.round((getTimestamp() - mobileRecordingStartedAtRef.current) / 1000),
    );

    setIsMobileRecording(false);
    setMobileRecordingSeconds(0);
    mobileMediaRecorderRef.current = null;
    mobileAudioChunksRef.current = [];

    if (action === "cancel" || audioChunks.length === 0) return;

    const audioBlob = new Blob(audioChunks, { type: recorder?.mimeType || "audio/webm" });
    const audioUrl = URL.createObjectURL(audioBlob);
    recordedAudioUrlsRef.current.push(audioUrl);

    if (action === "send") {
      sendRecordedAudio(audioBlob, audioUrl, duration);
      return;
    }

    setMobileAudioPreview({ blob: audioBlob, audioUrl, duration });
  };

  const handleStopMobileAudioRecording = (action: "cancel" | "preview" | "send") => {
    const recorder = mobileMediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = () => {
        handleFinishMobileAudioRecording(action);
      };
      recorder.stop();
    } else {
      handleFinishMobileAudioRecording(action);
    }
  };

  const handleStartMobileAudioRecording = async () => {
    if (!isMobileViewport() || isMobileRecording) {
      return;
    }

    if (messageDraft.trim()) {
      handleSendMessage();
      return;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setChatError("Tu navegador no permite grabar audio en este entorno.");
      return;
    }

    try {
      setChatError("");
      setEmojiPickerOpen(false);
      handleDeleteMobileAudioPreview();
      mobileInputRef.current?.blur();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getBestAudioMimeType();
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      mobileAudioChunksRef.current = [];
      mobileRecordingStreamRef.current = stream;
      mobileMediaRecorderRef.current = mediaRecorder;
      mobileRecordingStartedAtRef.current = getTimestamp();

      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          mobileAudioChunksRef.current.push(event.data);
        }
      });

      mediaRecorder.start();
      setIsMobileRecording(true);
      setMobileRecordingSeconds(0);
      mobileRecordingIntervalRef.current = window.setInterval(() => {
        setMobileRecordingSeconds(
          Math.max(
            1,
            Math.floor((getTimestamp() - mobileRecordingStartedAtRef.current) / 1000),
          ),
        );
      }, 250);
    } catch {
      clearMobileRecordingTimer();
      stopMobileRecordingStream();
      mobileMediaRecorderRef.current = null;
      mobileAudioChunksRef.current = [];
      setIsMobileRecording(false);
      setChatError("No se pudo acceder al microfono. Revisa los permisos del navegador.");
    }
  };

  const handleStartDesktopAudioRecording = async () => {
    if (isMobileViewport() || isDesktopRecording) {
      return;
    }

    if (messageDraft.trim()) {
      handleSendMessage();
      return;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setDesktopRecorderError(
        "Tu navegador no permite grabar audio en este entorno.",
      );
      return;
    }

    try {
      setDesktopRecorderError("");
      setEmojiPickerOpen(false);
      handleDeleteDesktopAudioPreview();
      desktopInputRef.current?.blur();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getBestAudioMimeType();
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      desktopAudioChunksRef.current = [];
      desktopRecordingStreamRef.current = stream;
      desktopMediaRecorderRef.current = mediaRecorder;
      desktopRecordingStartedAtRef.current = getTimestamp();
      desktopRecordingActionRef.current = "preview";

      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          desktopAudioChunksRef.current.push(event.data);
        }
      });
      mediaRecorder.addEventListener("stop", handleFinishDesktopAudioRecording, {
        once: true,
      });

      mediaRecorder.start();
      setIsDesktopRecording(true);
      setDesktopRecordingSeconds(0);
      desktopRecordingIntervalRef.current = window.setInterval(() => {
        setDesktopRecordingSeconds(
          Math.max(
            1,
            Math.floor((getTimestamp() - desktopRecordingStartedAtRef.current) / 1000),
          ),
        );
      }, 250);
    } catch {
      clearDesktopRecordingTimer();
      stopDesktopRecordingStream();
      desktopMediaRecorderRef.current = null;
      desktopAudioChunksRef.current = [];
      setIsDesktopRecording(false);
      setDesktopRecorderError(
        "No se pudo acceder al microfono. Revisa los permisos del navegador.",
      );
    }
  };

  const handleStopDesktopAudioRecording = (
    action: "preview" | "send" | "cancel",
  ) => {
    desktopRecordingActionRef.current = action;
    const recorder = desktopMediaRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      return;
    }

    handleFinishDesktopAudioRecording();
  };

  useEffect(() => {
    resizeMessageTextarea(mobileInputRef.current);
    resizeMessageTextarea(desktopInputRef.current);
  }, [messageDraft]);

  useEffect(() => {
    return () => {
      clearDesktopRecordingTimer();
      stopDesktopRecordingStream();
      recordedAudioUrlsRef.current.forEach((audioUrl) => {
        URL.revokeObjectURL(audioUrl);
      });
      recordedAudioUrlsRef.current = [];
      sentAttachmentUrlsRef.current.forEach((objectUrl) => {
        URL.revokeObjectURL(objectUrl);
      });
      sentAttachmentUrlsRef.current = [];
    };
  }, []);

  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments;
  }, [pendingAttachments]);

  useEffect(() => {
    return () => {
      pendingAttachmentsRef.current.forEach((attachment) => {
        URL.revokeObjectURL(attachment.objectUrl);
      });
    };
  }, []);

  useEffect(() => {
    const syncDraftFromDom = () => {
      const activeInput = window.matchMedia("(max-width: 767px)").matches
        ? mobileInputRef.current
        : desktopInputRef.current;
      const nextDraft = activeInput?.value ?? "";

      setMessageDraft((current) => (current === nextDraft ? current : nextDraft));
    };

    const inputs = [mobileInputRef.current, desktopInputRef.current].filter(
      (input): input is HTMLTextAreaElement => Boolean(input),
    );
    const events = ["input", "change", "keyup", "compositionend"];

    inputs.forEach((input) => {
      events.forEach((eventName) => {
        input.addEventListener(eventName, syncDraftFromDom);
      });
    });

    const interval = window.setInterval(() => {
      if (
        document.activeElement === mobileInputRef.current ||
        document.activeElement === desktopInputRef.current
      ) {
        syncDraftFromDom();
      }
    }, 150);

    return () => {
      window.clearInterval(interval);
      inputs.forEach((input) => {
        events.forEach((eventName) => {
          input.removeEventListener(eventName, syncDraftFromDom);
        });
      });
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("crm:chat-mobile-view", {
        detail: { conversationOpen: mobileView === "conversation" },
      }),
    );

    return () => {
      window.dispatchEvent(
        new CustomEvent("crm:chat-mobile-view", {
          detail: { conversationOpen: false },
        }),
      );
    };
  }, [mobileView]);

  useEffect(() => {
    if (!emojiPickerOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (
        mobileEmojiPanelRef.current?.contains(target) ||
        desktopEmojiPanelRef.current?.contains(target) ||
        mobileEmojiButtonRef.current?.contains(target) ||
        desktopEmojiButtonRef.current?.contains(target)
      ) {
        return;
      }

      setEmojiPickerOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEmojiPickerOpen(false);
        const activeInput = window.matchMedia("(max-width: 767px)").matches
          ? mobileInputRef.current
          : desktopInputRef.current;
        activeInput?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [emojiPickerOpen]);

  const handleEmojiToggle = () => {
    if (isMobileViewport()) {
      mobileInputRef.current?.blur();
    }

    setEmojiPickerOpen((current) => !current);
  };

  const handleMobileEmojiTouchStart = (
    event: ReactTouchEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    handleEmojiToggle();
  };

  const handleMobileEmojiMouseDown = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    handleEmojiToggle();
  };

  const handleMobileEmojiClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.detail === 0) {
      handleEmojiToggle();
    }
  };

  const insertEmoji = (emoji: string, options?: { insertAtEnd?: boolean }) => {
    const input = getActiveMessageInput();
    const currentValue = input?.value ?? messageDraft;
    const shouldInsertAtEnd = options?.insertAtEnd ?? false;
    const selectionStart = shouldInsertAtEnd
      ? currentValue.length
      : input?.selectionStart ?? currentValue.length;
    const selectionEnd = shouldInsertAtEnd
      ? currentValue.length
      : input?.selectionEnd ?? currentValue.length;
    const nextMessage = `${currentValue.slice(0, selectionStart)}${emoji}${currentValue.slice(
      selectionEnd,
    )}`;
    const nextCursorPosition = selectionStart + emoji.length;

    pendingCursorPositionRef.current = nextCursorPosition;
    setMessageDraft(nextMessage);

    if (input) {
      input.value = nextMessage;
      input.setSelectionRange(nextCursorPosition, nextCursorPosition);
      resizeMessageTextarea(input);
    }

    if (isMobileViewport()) {
      mobileInputRef.current?.blur();
      return;
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const input = getActiveMessageInput();
        if (!input) {
          return;
        }

        input.focus();
        input.setSelectionRange(nextCursorPosition, nextCursorPosition);
        pendingCursorPositionRef.current = null;
      });
    });
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    insertEmoji(emojiData.emoji);
    setEmojiPickerOpen(true);
  };

  const handleMobileEmojiSelect = (emoji: string) => {
    insertEmoji(emoji, { insertAtEnd: true });
    setEmojiPickerOpen(true);
  };

  const handleMobileEmojiBackspace = () => {
    const input = getActiveMessageInput();
    const currentValue = input?.value ?? messageDraft;

    if (!currentValue) {
      return;
    }

    const nextMessage =
      "Segmenter" in Intl
        ? Array.from(
            new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
              currentValue,
            ),
            (segment) => segment.segment,
          )
            .slice(0, -1)
            .join("")
        : Array.from(currentValue).slice(0, -1).join("");

    setMessageDraft(nextMessage);

    if (input) {
      input.value = nextMessage;
      resizeMessageTextarea(input);
    }
  };

  const quickCommandMatch = messageDraft.match(/^\/([a-z0-9_-]*)$/i);
  const quickCommandQuery = quickCommandMatch?.[1]?.toLowerCase() ?? null;
  const matchingQuickMessages = quickCommandQuery == null
    ? []
    : quickMessages
        .filter((command) => command.keyword.toLowerCase().includes(quickCommandQuery));
  const showQuickCommandMenu = quickCommandQuery != null
    && !quickCommandMenuDismissed;

  const updateMessageDraft = (value: string) => {
    setMessageDraft(value);
    setQuickCommandIndex(0);
    setQuickCommandMenuDismissed(false);
  };

  const handleDraftChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    updateMessageDraft(event.currentTarget.value);
    resizeMessageTextarea(event.currentTarget);
  };

  const handleDraftInput = (event: FormEvent<HTMLTextAreaElement>) => {
    updateMessageDraft(event.currentTarget.value);
    resizeMessageTextarea(event.currentTarget);
  };

  const handleMobileInputFocus = () => {
    if (isMobileViewport()) {
      setEmojiPickerOpen(false);
    }
  };

  const isNearMessagesBottom = (element: HTMLDivElement | null) => {
    if (!element) return true;
    return element.scrollHeight - element.scrollTop - element.clientHeight < 120;
  };

  const isLoadingOlderMessagesRef = useRef(false);
  const handleLoadOlderMessages = async () => {
    if (!activeConversationId || isLoadingOlderMessagesRef.current) return;
    const meta = messageCacheMetaRef.current[activeConversationId];
    if (!meta?.oldestId || !meta.hasMoreBefore) return;
    isLoadingOlderMessagesRef.current = true;
    const scrollElement = messageScrollRef.current;
    const previousHeight = scrollElement?.scrollHeight ?? 0;
    const previousTop = scrollElement?.scrollTop ?? 0;
    shouldStickToBottomRef.current = false;
    try {
      await loadMessages(activeConversationId, { beforeId: meta.oldestId });
      window.requestAnimationFrame(() => {
        if (!scrollElement) return;
        scrollElement.scrollTop = previousTop + (scrollElement.scrollHeight - previousHeight);
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar el historial anterior");
    } finally {
      isLoadingOlderMessagesRef.current = false;
    }
  };

  const handleMessagesScroll = () => {
    const scrollElement = messageScrollRef.current;
    shouldStickToBottomRef.current = isNearMessagesBottom(scrollElement);
    if (scrollElement && scrollElement.scrollTop <= 80) {
      void handleLoadOlderMessages();
    }
  };

  const handleConversationListScroll = (event: ReactUIEvent<HTMLDivElement>) => {
    const scrollElement = event.currentTarget;
    const distanceFromBottom = scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight;
    if (distanceFromBottom <= 120 && hasMoreConversations && !isLoadingMoreConversationsRef.current) {
      void loadConversations({ append: true }).catch(() => undefined);
    }
  };

  const handleMessageKeyDown = (
    event: ReactKeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (showQuickCommandMenu && matchingQuickMessages.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setQuickCommandIndex((current) => (current + 1) % matchingQuickMessages.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setQuickCommandIndex((current) => (current - 1 + matchingQuickMessages.length) % matchingQuickMessages.length);
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        const command = matchingQuickMessages[Math.min(quickCommandIndex, matchingQuickMessages.length - 1)];
        if (command) {
          void sendQuickMessage(command);
        }
        return;
      }
    }
    if (event.key === "Escape" && showQuickCommandMenu) {
      event.preventDefault();
      setQuickCommandMenuDismissed(true);
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const sendTextMessageTo = async (
    conversationId: string | null,
    text: string,
    replyToMessageId?: string | null,
  ) => {
    if (!conversationId) {
      throw new Error("Selecciona una conversacion para enviar el mensaje");
    }

    const response = await authFetch(`/api/crm/whatsapp/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        replyToMessageId: replyToMessageId ? Number(replyToMessageId) : null,
      }),
    });

    if (!response.ok) {
      throw new Error(await readApiMessage(response, "No se pudo enviar el mensaje"));
    }

    const sent = (await response.json()) as CrmMessageResponse;
    return mapMessage(sent);
  };

  const sendSaleReceipt = async (saleId: number, format: "PDF" | "TICKET") => {
    if (!activeConversationId) throw new Error("Selecciona una conversacion");
    const response = await authFetch(
      `/api/crm/whatsapp/conversations/${activeConversationId}/sales/${saleId}/receipt`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      },
    );
    if (!response.ok) throw new Error(await readApiMessage(response, `No se pudo enviar el ${format}`));
    const sent = mapMessage((await response.json()) as CrmMessageResponse);
    setMessages((current) => dedupeMessages([...current, sent]));
    toast.success(`${format} enviado por WhatsApp`);
  };

  const sendTextMessage = (text: string, replyToMessageId?: string | null) =>
    sendTextMessageTo(activeConversationId, text, replyToMessageId);

  const sendQuickMessage = async (command: QuickMessage) => {
    if (!activeConversationId || !canOperateActiveConversation || quickMessageSendingRef.current) return;
    const conversationId = activeConversationId;
    quickMessageSendingRef.current = true;
    setIsQuickMessageSending(true);
    setQuickCommandMenuDismissed(true);
    const sentMessages: ChatMessage[] = [];
    try {
      for (let index = 0; index < command.blocks.length; index++) {
        const block = command.blocks[index];
        const response = await authFetch(
          `/api/crm/whatsapp/quick-messages/${command.id}/blocks/${block.id}/send`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversationId: Number(conversationId) }),
          },
        );
        if (!response.ok) throw new Error(await readQuickMessageApiError(response, `No se pudo enviar el bloque ${index + 1}`));
        sentMessages.push(mapMessage((await response.json()) as CrmMessageResponse));
      }
      if (activeConversationIdRef.current === conversationId) {
        setMessages((current) => dedupeMessages([...current, ...sentMessages]));
      }
      allMessagesRef.current = {
        ...allMessagesRef.current,
        [conversationId]: dedupeMessages([...(allMessagesRef.current[conversationId] ?? []), ...sentMessages]),
      };
      setMessageDraft("");
      const input = getActiveMessageInput();
      if (input) {
        input.value = "";
        resizeMessageTextarea(input);
      }
      toast.success(`/${command.keyword} enviado`);
    } catch (error) {
      if (sentMessages.length > 0) {
        if (activeConversationIdRef.current === conversationId) {
          setMessages((current) => dedupeMessages([...current, ...sentMessages]));
        }
        allMessagesRef.current = {
          ...allMessagesRef.current,
          [conversationId]: dedupeMessages([...(allMessagesRef.current[conversationId] ?? []), ...sentMessages]),
        };
      }
      const detail = error instanceof Error ? error.message : "No se pudo enviar el comando";
      toast.error(`${sentMessages.length} de ${command.blocks.length} bloques enviados. ${detail}`);
    } finally {
      quickMessageSendingRef.current = false;
      setIsQuickMessageSending(false);
      window.requestAnimationFrame(() => getActiveMessageInput()?.focus());
    }
  };

  const sendMediaAttachment = async (
    conversationId: string,
    attachment: PendingAttachment,
    caption = "",
    replyToMessageId?: string | null,
  ) => {
    if (!attachment.file) {
      throw new Error("No se encontro el archivo para enviar");
    }
    if (attachment.file.size > CRM_WHATSAPP_MEDIA_MAX_BYTES) {
      throw new Error(`El archivo pesa ${formatFileSize(attachment.file.size)}. El maximo permitido es ${CRM_WHATSAPP_MEDIA_MAX_LABEL}.`);
    }
    const formData = new FormData();
    formData.append("file", attachment.file, attachment.name);
    if (caption.trim()) {
      formData.append("caption", caption.trim());
    }
    if (replyToMessageId) {
      formData.append("replyToMessageId", replyToMessageId);
    }

    const response = await authFetch(`/api/crm/whatsapp/conversations/${conversationId}/media`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await readApiMessage(response, "No se pudo enviar el archivo"));
    }

    const sent = (await response.json()) as CrmMessageResponse;
    return {
      ...mapMessage(sent, attachment.objectUrl),
      fileSize: attachment.size,
      pageCount: pdfPageCounts[attachment.id],
    };
  };

  const sendRecordedAudio = (
    blob: Blob,
    audioUrl: string,
    duration: number,
  ) => {
    if (!activeConversationId || !canOperateActiveConversation) {
      setChatError("Selecciona una conversacion para enviar el audio");
      return;
    }

    const conversationId = activeConversationId;
    const currentReply = replyTarget;
    const pendingId = `pending-audio-${getTimestamp()}`;
    const pendingCreatedAt = new Date().toISOString();
    const audioType = blob.type || "audio/ogg;codecs=opus";
    const file = new File([blob], `audio-${getTimestamp()}.${getAudioFileExtension(audioType)}`, {
      type: audioType,
    });
    const attachment: PendingAttachment = {
      id: pendingId,
      file,
      name: file.name,
      objectUrl: audioUrl,
      size: file.size,
      type: file.type,
    };

    setChatError("");
    const pendingAudioMessage: ChatMessage = {
        id: pendingId,
        type: "outgoing-audio",
        text: "Audio",
        time: getMessageTime(),
        createdAt: pendingCreatedAt,
        status: "accepted",
        audioUrl,
        duration,
        retryFile: file,
        replyTo: currentReply ? buildReplyQuote(currentReply) : null,
    };

    setMessages((current) => [...current, pendingAudioMessage]);
    allMessagesRef.current = {
      ...allMessagesRef.current,
      [conversationId]: [
        ...(allMessagesRef.current[conversationId] ?? []),
        pendingAudioMessage,
      ],
    };
    setReplyTarget(null);

    void sendMediaAttachment(conversationId, attachment, "", currentReply?.id)
      .then(async (sentMessage) => {
        const finalMessage: ChatMessage = {
          ...sentMessage,
          type: "outgoing-audio",
          text: "Audio",
          audioUrl,
          duration,
        };
        setMessages((current) => replaceMessageAndDedupe(current, pendingId, finalMessage));
        allMessagesRef.current = {
          ...allMessagesRef.current,
          [conversationId]: replaceMessageAndDedupe(
            allMessagesRef.current[conversationId] ?? [],
            pendingId,
            finalMessage,
          ),
        };
      })
      .catch((error) => {
        setMessages((current) =>
          current.map((message) =>
            message.id === pendingId
              ? { ...message, status: "failed", time: getMessageTime() }
              : message,
          ),
        );
        setChatError(error instanceof Error ? error.message : "No se pudo enviar el audio. Intenta de nuevo.");
        allMessagesRef.current = {
          ...allMessagesRef.current,
          [conversationId]: (allMessagesRef.current[conversationId] ?? []).map((message) =>
            message.id === pendingId ? { ...message, status: "failed", time: getMessageTime() } : message,
          ),
        };
      });
  };

  const handleComposerSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleSendMessage();
  };

  const handleMobileComposerAction = () => {
    if (messageDraft.trim()) {
      handleSendMessage();
      return;
    }

    void handleStartMobileAudioRecording();
  };

  const handleMobileSendClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    handleMobileComposerAction();
  };

  const handleSendMessage = () => {
    const activeInput = getActiveMessageInput();
    const text = (activeInput?.value ?? messageDraft).trim();

    if (!text || !activeConversationId || !canOperateActiveConversation) {
      return;
    }

    const currentReply = replyTarget;
    const pendingId = `pending-${getTimestamp()}`;
    const pendingCreatedAt = new Date().toISOString();
    const pendingMessage: ChatMessage = {
      id: pendingId,
      type: "outgoing",
      text,
      time: getMessageTime(),
      createdAt: pendingCreatedAt,
      status: "accepted",
      retryText: text,
      replyTo: currentReply ? buildReplyQuote(currentReply) : null,
    };

    setChatError("");
    setMessages((current) => [...current, pendingMessage]);
    allMessagesRef.current = {
      ...allMessagesRef.current,
      [activeConversationId]: dedupeMessages([
        ...(allMessagesRef.current[activeConversationId] ?? []),
        pendingMessage,
      ]),
    };
    setMessageDraft("");
    setReplyTarget(null);
    if (activeInput) {
      activeInput.value = "";
      resizeMessageTextarea(activeInput);
    }
    sendTextMessage(text, currentReply?.id)
      .then(async (sentMessage) => {
        setMessages((current) => replaceMessageAndDedupe(current, pendingId, sentMessage));
        allMessagesRef.current = {
          ...allMessagesRef.current,
          [activeConversationId]: replaceMessageAndDedupe(
            allMessagesRef.current[activeConversationId] ?? [],
            pendingId,
            sentMessage,
          ),
        };
      })
      .catch((error) => {
        setMessages((current) =>
          current.map((message) =>
            message.id === pendingId
              ? { ...message, status: "failed", time: getMessageTime() }
              : message,
          ),
        );
        setChatError(error instanceof Error ? error.message : "No se pudo enviar. Puedes mandar de nuevo.");
      });
    window.requestAnimationFrame(() => getActiveMessageInput()?.focus());
  };

  const retryMessage = (message: ChatMessage) => {
    if ((message.type === "outgoing-file" || message.type === "outgoing-audio") && message.retryFile && activeConversationId) {
      const retryAttachment: PendingAttachment = {
        id: `retry-${getTimestamp()}`,
        file: message.retryFile,
        name: message.retryFile.name,
        objectUrl: message.fileUrl ?? message.audioUrl ?? URL.createObjectURL(message.retryFile),
        size: message.fileSize ?? message.retryFile.size,
        type: message.fileType ?? message.retryFile.type,
      };

      setChatError("");
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id
            ? { ...item, status: "accepted", time: getMessageTime() }
            : item,
        ),
      );

      sendMediaAttachment(activeConversationId, retryAttachment, "", message.replyTo?.id)
        .then(async (sentMessage) => {
          const finalMessage: ChatMessage = message.type === "outgoing-audio"
            ? {
                ...sentMessage,
                type: "outgoing-audio",
                text: "Audio",
                audioUrl: retryAttachment.objectUrl,
                duration: message.duration,
              }
            : sentMessage;
          setMessages((current) => replaceMessageAndDedupe(current, message.id, finalMessage));
          allMessagesRef.current = {
            ...allMessagesRef.current,
            [activeConversationId]: replaceMessageAndDedupe(
              allMessagesRef.current[activeConversationId] ?? [],
              message.id,
              finalMessage,
            ),
          };
        })
        .catch((error) => {
          setMessages((current) =>
            current.map((item) =>
              item.id === message.id
                ? { ...item, status: "failed", time: getMessageTime() }
                : item,
            ),
          );
          setChatError(error instanceof Error ? error.message : "No se pudo enviar el archivo. Intenta mandar de nuevo.");
        });
      return;
    }

    const text = (message.retryText || message.text).trim();
    if (!text || !activeConversationId) return;

    setChatError("");
    setMessages((current) =>
      current.map((item) =>
        item.id === message.id
          ? { ...item, status: "accepted", time: getMessageTime() }
          : item,
      ),
    );

    sendTextMessage(text, message.replyTo?.id)
      .then(async (sentMessage) => {
        setMessages((current) => replaceMessageAndDedupe(current, message.id, sentMessage));
        allMessagesRef.current = {
          ...allMessagesRef.current,
          [activeConversationId]: replaceMessageAndDedupe(
            allMessagesRef.current[activeConversationId] ?? [],
            message.id,
            sentMessage,
          ),
        };
      })
      .catch((error) => {
        setMessages((current) =>
          current.map((item) =>
            item.id === message.id
              ? { ...item, status: "failed", time: getMessageTime() }
              : item,
          ),
        );
        setChatError(error instanceof Error ? error.message : "No se pudo enviar. Intenta mandar de nuevo.");
      });
  };

  const handleReplyToMessage = (message: ChatMessage) => {
    setReplyTarget(message);
    window.requestAnimationFrame(() => getActiveMessageInput()?.focus());
  };

  const handleDeleteMessage = (message: ChatMessage) => {
    if (!activeConversationId || deletingMessageId) return;
    setDeleteMessageTarget(message);
  };

  const confirmDeleteMessage = async () => {
    const message = deleteMessageTarget;
    if (!activeConversationId || !message || deletingMessageId) return;

    setDeletingMessageId(message.id);
    setChatError("");
    try {
      const response = await authFetch(
        `/api/crm/whatsapp/conversations/${activeConversationId}/messages/${message.id}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        throw new Error(await readApiMessage(response, "No se pudo eliminar el mensaje"));
      }
      const deletedMessage = mapMessage((await response.json()) as CrmMessageResponse);
      setMessages((current) =>
        current.map((item) => item.id === message.id ? deletedMessage : item),
      );
      allMessagesRef.current = {
        ...allMessagesRef.current,
        [activeConversationId]: (allMessagesRef.current[activeConversationId] ?? []).map((item) =>
          item.id === message.id ? deletedMessage : item,
        ),
      };
      setDeleteMessageTarget(null);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "No se pudo eliminar el mensaje");
    } finally {
      setDeletingMessageId(null);
    }
  };

  const confirmDeleteConversation = async () => {
    const conversationId = activeConversationId;
    if (!conversationId || isDeletingConversation) return;
    setIsDeletingConversation(true);
    try {
      const response = await authFetch(`/api/crm/whatsapp/conversations/${conversationId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(await readApiMessage(response, "No se pudo eliminar el chat"));
      }
      setConversations((current) => {
        const next = current.filter((item) => item.id !== conversationId);
        conversationsRef.current = next;
        return next;
      });
      for (const entry of Object.values(conversationCacheRef.current)) {
        entry.items = entry.items.filter((item) => item.id !== conversationId);
        entry.totalElements = Math.max(0, entry.totalElements - 1);
      }
      delete allMessagesRef.current[conversationId];
      delete messageCacheMetaRef.current[conversationId];
      activeConversationIdRef.current = null;
      setActiveConversationId(null);
      setMessages([]);
      setReplyTarget(null);
      setIsSidebarOpen(false);
      setIsActionMenuOpen(false);
      setIsDeleteConversationOpen(false);
      refreshConversationCountsRef.current();
      toast.success("Chat eliminado correctamente");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar el chat");
    } finally {
      setIsDeletingConversation(false);
    }
  };

  const handleAttachFileClick = () => {
    if (!canOperateActiveConversation) return;
    fileInputRef.current?.click();
  };

  const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);

    if (selectedFiles.length === 0) {
      return;
    }

    addPendingAttachments(selectedFiles);
    event.target.value = "";
  };

  const addPendingAttachments = (selectedFiles: File[]) => {
    const allowedFiles = selectedFiles.filter((file) => {
      if (file.size <= CRM_WHATSAPP_MEDIA_MAX_BYTES) {
        return true;
      }
      const message = `No se puede adjuntar "${file.name}" porque pesa ${formatFileSize(file.size)}. El maximo permitido es ${CRM_WHATSAPP_MEDIA_MAX_LABEL}.`;
      toast.error(message);
      return false;
    });

    if (allowedFiles.length === 0) {
      return;
    }

    const nextAttachments = allowedFiles.map((file, index) => ({
      id: `attachment-${getTimestamp()}-${index}`,
      file,
      name: file.name,
      objectUrl: URL.createObjectURL(file),
      size: file.size,
      type: file.type,
    }));

    setPendingAttachments((current) => {
      if (current.length === 0) {
        setActiveAttachmentId(nextAttachments[0]?.id ?? null);
      }

      return [...current, ...nextAttachments];
    });
  };

  const closeAttachmentPreview = () => {
    pendingAttachments.forEach((attachment) => {
      URL.revokeObjectURL(attachment.objectUrl);
    });
    setPendingAttachments([]);
    setActiveAttachmentId(null);
    setAttachmentCaption("");
    setPdfPageCounts({});
  };

  const removePendingAttachment = (attachmentId: string) => {
    setPendingAttachments((current) => {
      const removedAttachment = current.find(
        (attachment) => attachment.id === attachmentId,
      );
      const nextAttachments = current.filter(
        (attachment) => attachment.id !== attachmentId,
      );

      if (removedAttachment) {
        URL.revokeObjectURL(removedAttachment.objectUrl);
      }

      if (activeAttachmentId === attachmentId) {
        setActiveAttachmentId(nextAttachments[0]?.id ?? null);
      }

      if (nextAttachments.length === 0) {
        setAttachmentCaption("");
        setPdfPageCounts({});
      }

      return nextAttachments;
    });
  };

  const handleSendPendingAttachments = () => {
    if (pendingAttachments.length === 0 || !activeConversationId || !canOperateActiveConversation) {
      return;
    }

    const sentAt = getMessageTime();
    const sentCreatedAt = new Date().toISOString();
    const caption = attachmentCaption.trim();
    const sentAttachments = pendingAttachments;
    const conversationId = activeConversationId;
    const currentReply = replyTarget;

    sentAttachmentUrlsRef.current.push(
      ...sentAttachments.map((attachment) => attachment.objectUrl),
    );

    const pendingMessages = sentAttachments.map((attachment) => ({
      id: `file-pending-${getTimestamp()}-${attachment.id}`,
      type: "outgoing-file" as const,
      text: attachment.name,
      time: sentAt,
      createdAt: sentCreatedAt,
      status: "accepted" as const,
      fileSize: attachment.size,
      fileType: attachment.type,
      fileUrl: attachment.objectUrl,
      pageCount: pdfPageCounts[attachment.id],
      retryFile: attachment.file,
      replyTo: currentReply ? buildReplyQuote(currentReply) : null,
    }));

    setMessages((current) => dedupeMessages([...current, ...pendingMessages]));
    allMessagesRef.current = {
      ...allMessagesRef.current,
      [conversationId]: dedupeMessages([
        ...(allMessagesRef.current[conversationId] ?? []),
        ...pendingMessages,
      ]),
    };

    setPendingAttachments([]);
    setActiveAttachmentId(null);
    setAttachmentCaption("");
    setPdfPageCounts({});
    setReplyTarget(null);

    void (async () => {
      let successfulFiles = 0;
      for (const attachment of sentAttachments) {
        const pendingId = pendingMessages.find((message) => message.retryFile === attachment.file)?.id;
        if (!pendingId) {
          continue;
        }
        try {
          const sentMessage = await sendMediaAttachment(conversationId, attachment, "", currentReply?.id);
          successfulFiles += 1;
          setMessages((current) => replaceMessageAndDedupe(current, pendingId, sentMessage));
          allMessagesRef.current = {
            ...allMessagesRef.current,
            [conversationId]: replaceMessageAndDedupe(
              allMessagesRef.current[conversationId] ?? [],
              pendingId,
              sentMessage,
            ),
          };
        } catch (error) {
          setMessages((current) =>
            current.map((message) =>
              message.id === pendingId
                ? { ...message, status: "failed", time: getMessageTime() }
                : message,
            ),
          );
          allMessagesRef.current = {
            ...allMessagesRef.current,
            [conversationId]: (allMessagesRef.current[conversationId] ?? []).map((message) =>
              message.id === pendingId ? { ...message, status: "failed", time: getMessageTime() } : message,
            ),
          };
          setChatError(error instanceof Error ? error.message : "No se pudo enviar el archivo. Puedes mandar de nuevo.");
        }
      }

      if (caption && successfulFiles > 0) {
        sendTextMessageTo(conversationId, caption, currentReply?.id).then((sentMessage) => {
          setMessages((current) => dedupeMessages([...current, sentMessage]));
          allMessagesRef.current = {
            ...allMessagesRef.current,
            [conversationId]: dedupeMessages([
              ...(allMessagesRef.current[conversationId] ?? []),
              sentMessage,
            ]),
          };
        }).catch(() => undefined);
      }

    })();
  };

  const hasDraggedFiles = (event: ReactDragEvent<HTMLElement>) =>
    Array.from(event.dataTransfer.types).includes("Files");

  const handleChatDragEnter = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!canOperateActiveConversation || !hasDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
  };

  const handleChatDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!canOperateActiveConversation || !hasDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleChatDragLeave = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!canOperateActiveConversation || !hasDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
  };

  const handleChatDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!canOperateActiveConversation || !hasDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingFiles(false);
    addPendingAttachments(Array.from(event.dataTransfer.files));
  };

  const handleDesktopComposerAction = () => {
    if (messageDraft.trim()) {
      handleSendMessage();
      return;
    }

    void handleStartDesktopAudioRecording();
  };

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = previousMessagesMetaRef.current;
    const lastMessage = messages[messages.length - 1] ?? null;
    const conversationChanged = previous.conversationId !== activeConversationId;
    const appendedMessage = messages.length > previous.length || lastMessage?.id !== previous.lastId;
    const localOutgoingAppend =
      appendedMessage &&
      Boolean(lastMessage) &&
      (lastMessage.id.startsWith("pending-") ||
        lastMessage.id.startsWith("file-pending-") ||
        lastMessage.type.startsWith("outgoing"));

    if (conversationChanged || shouldStickToBottomRef.current || localOutgoingAppend) {
      messagesEndRef.current?.scrollIntoView({ behavior: conversationChanged ? "auto" : "smooth" });
      shouldStickToBottomRef.current = true;
    }

    previousMessagesMetaRef.current = {
      conversationId: activeConversationId,
      length: messages.length,
      lastId: lastMessage?.id ?? null,
    };
  }, [activeConversationId, messages])

  const activeAttachment =
    pendingAttachments.find((attachment) => attachment.id === activeAttachmentId) ??
    pendingAttachments[0] ??
    null;
  const attachmentPdfPreviewBounds = getAttachmentPdfPreviewBounds();
  const replyComposer = replyTarget ? (
    <div className="relative z-10 flex items-center gap-3 rounded-t-[24px] bg-background/95 px-3 py-2 text-xs md:rounded-t-[28px]">
      <ArrowUturnLeftIcon className="h-4 w-4 shrink-0 text-emerald-600" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-emerald-700 dark:text-emerald-300">
          Respondiendo a {replyTarget.type.startsWith("outgoing") ? "KIMETS" : "Cliente"}
        </p>
        <p className="truncate text-muted-foreground">
          {replyTarget.deleted ? "Mensaje eliminado" : replyTarget.text || "Mensaje"}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setReplyTarget(null)}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Cancelar respuesta"
      >
        <XMarkIcon className="h-4 w-4" />
      </button>
    </div>
  ) : null;
  const whatsappBlocked = Boolean(whatsappConnection)
    && (whatsappConnection?.status !== "CONNECTED" || whatsappConnection.phoneChanged);

  return (
    <>
    <section className="relative flex h-full min-h-0 flex-col bg-background text-foreground">
      {whatsappBlocked && whatsappConnection && (
        <div
          role="alert"
          className="z-30 flex shrink-0 items-center gap-3 border-b border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm dark:border-amber-500/30 dark:bg-amber-950 dark:text-amber-50 md:px-6"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-200/70 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
            <ExclamationTriangleIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold md:text-base">
              {whatsappConnection.phoneChanged ? "WhatsApp cambió de número" : "WhatsApp está desconectado"}
            </p>
            <p className="mt-0.5 hidden text-xs text-amber-800 dark:text-amber-200 sm:block">
              {whatsappConnection.phoneChanged
                ? "Un administrador debe confirmar el nuevo número antes de responder mensajes."
                : "Vuelve a conectar la sesión para recibir y responder mensajes desde el CRM."}
            </p>
          </div>
          <Link
            href="/conexiones"
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-amber-900 px-3 text-xs font-bold text-white transition hover:bg-amber-950 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300 md:px-4 md:text-sm"
          >
            Ir a Conexiones
          </Link>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
      <aside
        className={`w-full shrink-0 flex-col border-r border-border bg-background md:flex md:w-[360px] xl:w-[380px] ${
          mobileView === "list" ? "flex" : "hidden"
        }`}
      >
        <div className="border-b border-border px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="relative flex h-10 flex-1 items-center">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-4 h-4 w-4 text-muted-foreground" />
              <input
                type="search"
                value={conversationSearchInput}
                onChange={(event) => setConversationSearchInput(event.target.value)}
                placeholder="Buscar por numero de celular o nombre ..."
                className="h-10 w-full rounded-full border-0 bg-muted pl-11 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-muted-foreground/30"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void loadAvailableTags()}
                  className={cn(
                    "relative h-9 w-9 rounded-full hover:bg-muted",
                    selectedTagFilterId ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300" : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-label="Filtrar chats por etiqueta"
                  title="Filtrar por etiqueta"
                >
                  <FunnelIcon className="h-4 w-4" />
                  {selectedTagFilterId && (
                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={() => setSelectedTagFilterId(null)}
                  className="flex items-center justify-between text-xs"
                >
                  Todas las etiquetas
                  {!selectedTagFilterId && <CheckIcon className="h-4 w-4 text-blue-600" />}
                </DropdownMenuItem>
                {tagsLoading ? (
                  <div className="px-2 py-3 text-center text-xs text-muted-foreground">Cargando etiquetas...</div>
                ) : availableTags.length === 0 ? (
                  <div className="px-2 py-3 text-center text-xs text-muted-foreground">No hay etiquetas registradas.</div>
                ) : (
                  availableTags.map((tag) => (
                    <DropdownMenuItem
                      key={tag.id}
                      onClick={() => setSelectedTagFilterId(tag.id)}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                        <span className="truncate">{tag.label}</span>
                      </span>
                      {selectedTagFilterId === tag.id && <CheckIcon className="h-4 w-4 shrink-0 text-blue-600" />}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={isConversationListLoading}
              onClick={() => void loadConversations({ reset: true, force: true }).catch(() => undefined)}
              className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Recargar chats"
              title="Recargar chats"
            >
              <ArrowPathIcon className={cn("h-4 w-4", isConversationListLoading && "animate-spin")} />
            </Button>
          </div>

          {selectedTagFilter && (
            <div className="mt-2 flex items-center">
              <button
                type="button"
                onClick={() => setSelectedTagFilterId(null)}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground"
                title="Quitar filtro de etiqueta"
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: selectedTagFilter.color }} />
                <span className="truncate">{selectedTagFilter.label}</span>
                <XMarkIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            </div>
          )}

          <div className="mt-3">
            <div className="tag-filter-scroll flex w-full items-center gap-1.5 overflow-x-auto rounded-2xl border border-border/70 bg-muted/35 p-1.5 pb-2.5">
              <button
                  type="button"
                  aria-pressed={activeFilter === "all"}
                  onClick={() => changeFilter("all")}
                  className={cn(
                    "group inline-flex min-h-9 w-[126px] shrink-0 items-center gap-2 rounded-xl border px-2.5 text-left text-xs font-semibold transition-all",
                    activeFilter === "all"
                      ? "border-border bg-background text-foreground shadow-sm"
                      : "border-transparent text-muted-foreground hover:bg-background/70 hover:text-foreground",
                  )}
                >
                  <ChatBubbleLeftRightIcon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">Todos</span>
                  <span className={cn(
                    "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums",
                    activeFilter === "all" ? "bg-foreground text-background" : "bg-background text-muted-foreground",
                  )}>
                    {allConversationCount}
                  </span>
              </button>

              <button
                type="button"
                aria-pressed={activeFilter === "agent"}
                onClick={() => changeFilter("agent")}
                className={cn(
                  "group inline-flex min-h-9 w-[126px] shrink-0 items-center gap-2 rounded-xl border px-2.5 text-left text-xs font-semibold transition-all",
                  activeFilter === "agent"
                    ? "border-sky-200 bg-sky-50 text-sky-800 shadow-sm dark:border-sky-800 dark:bg-sky-950/70 dark:text-sky-200"
                    : "border-transparent text-muted-foreground hover:bg-background/70 hover:text-foreground",
                )}
              >
                <SparklesIcon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">IA Kiments</span>
                <span className={cn(
                  "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums",
                  activeFilter === "agent" ? "bg-sky-600 text-white" : "bg-background text-muted-foreground",
                )}>
                  {agentConversationCount}
                </span>
              </button>

              <button
                type="button"
                aria-pressed={activeFilter === "mine"}
                onClick={() => changeFilter("mine")}
                className={cn(
                  "group inline-flex min-h-9 w-[126px] shrink-0 items-center gap-2 rounded-xl border px-2.5 text-left text-xs font-semibold transition-all",
                  activeFilter === "mine"
                    ? "border-violet-200 bg-violet-50 text-violet-800 shadow-sm dark:border-violet-800 dark:bg-violet-950/70 dark:text-violet-200"
                    : "border-transparent text-muted-foreground hover:bg-background/70 hover:text-foreground",
                )}
              >
                <UserIconSolid className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">Tus chats</span>
                <span className={cn(
                  "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums",
                  activeFilter === "mine" ? "bg-violet-600 text-white" : "bg-background text-muted-foreground",
                )}>
                  {mineConversationCount}
                </span>
              </button>

              <button
                type="button"
                aria-pressed={activeFilter === "waiting"}
                onClick={() => changeFilter("waiting")}
                className={cn(
                  "group inline-flex min-h-9 w-[126px] shrink-0 items-center gap-2 rounded-xl border px-2.5 text-left text-xs font-semibold transition-all",
                  activeFilter === "waiting"
                    ? "border-amber-200 bg-amber-50 text-amber-800 shadow-sm dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-200"
                    : "border-transparent text-muted-foreground hover:bg-background/70 hover:text-foreground",
                )}
              >
                <HandRaisedIcon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">Espera</span>
                <span className={cn(
                  "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums",
                  activeFilter === "waiting" ? "bg-amber-500 text-white" : "bg-background text-muted-foreground",
                )}>
                  {waitingCount}
                </span>
              </button>

              <button
                type="button"
                aria-pressed={activeFilter === "resolved"}
                onClick={() => changeFilter("resolved")}
                className={cn(
                  "group inline-flex min-h-9 w-[126px] shrink-0 items-center gap-2 rounded-xl border px-2.5 text-left text-xs font-semibold transition-all",
                  activeFilter === "resolved"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200"
                    : "border-transparent text-muted-foreground hover:bg-background/70 hover:text-foreground",
                )}
              >
                <CheckIcon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">Resueltos</span>
                <span className={cn(
                  "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums",
                  activeFilter === "resolved" ? "bg-emerald-600 text-white" : "bg-background text-muted-foreground",
                )}>
                  {conversationCounts.resolved}
                </span>
              </button>
            </div>

            <div className="mt-2 flex items-center">
              <button
                type="button"
                aria-pressed={unreadOnly}
                onClick={toggleUnreadOnly}
                className={cn(
                  "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[11px] font-semibold transition-colors",
                  unreadOnly
                    ? "border-blue-500 bg-blue-500 text-white shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <EnvelopeIcon className="h-4 w-4" />
                No leídos
              </button>
            </div>

            {realtimeStatus !== "live" && (
              <span className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-medium text-amber-600 dark:text-amber-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                Reconectando
              </span>
            )}
          </div>
        </div>

        <div
          className="sidebar-scroll min-h-0 flex-1 overflow-y-auto"
          onScroll={handleConversationListScroll}
        >
          {isConversationListLoading ? (
            <ChatConversationSkeletons />
          ) : conversationListError && filteredConversations.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-semibold text-foreground">No se pudieron cargar los chats</p>
              <p className="mt-1 text-xs text-muted-foreground">{conversationListError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => void loadConversations({ reset: true, force: true }).catch(() => undefined)}
              >
                Reintentar
              </Button>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <ChatBubbleLeftRightIcon className="mx-auto h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm font-semibold text-muted-foreground">
                {conversationSearch || selectedTagFilterId || unreadOnly ? "Sin resultados" : "Sin chats"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                {unreadOnly
                  ? "No hay chats no leídos en este filtro."
                  : conversationSearch || selectedTagFilterId
                  ? "Prueba con otro nombre, numero o etiqueta."
                  : "Los mensajes nuevos de WhatsApp apareceran aqui."}
              </p>
            </div>
          ) : (
            <>
              {filteredConversations.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={{ ...conversation, active: conversation.id === activeConversationId }}
                  accepting={acceptingConversationId === conversation.id}
                  markingUnread={readStatePendingIds.has(conversation.id)}
                  onAccept={
                    conversation.status !== "RESUELTO"
                      && !conversation.assignedUserId
                      ? () => void handleAcceptCurrent(conversation.id)
                      : undefined
                  }
                  onMarkUnread={() => void updateConversationReadState(conversation.id, true)}
                  onSelect={() => { void switchConversation(conversation.id); setMobileView("conversation"); }}
                  tags={conversation.tags ?? []}
                />
              ))}
              {conversationListError && (
                <p className="px-4 py-2 text-center text-xs text-destructive">{conversationListError}</p>
              )}
              {isLoadingMoreConversations && (
                <p className="px-4 py-4 text-center text-xs text-muted-foreground">Cargando chats...</p>
              )}
            </>
          )}
        </div>
      </aside>

      <div
        className={`relative min-w-0 flex-1 flex-col bg-muted/60 md:flex ${
          mobileView === "conversation" ? "flex" : "hidden"
        }`}
        onDragEnter={handleChatDragEnter}
        onDragOver={handleChatDragOver}
        onDragLeave={handleChatDragLeave}
        onDrop={handleChatDrop}
      >
        {!activeConversationId ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
            <ChatBubbleLeftRightIcon className="h-16 w-16 text-muted-foreground/40" />
            <p className="text-lg font-semibold text-muted-foreground">Busca un nuevo chat</p>
            <p className="text-sm text-muted-foreground/70">Selecciona una conversacion para empezar</p>
          </div>
        ) : (
          <>
        <header className="shrink-0 border-b border-border bg-background">
          <div className="flex min-h-[64px] flex-wrap items-center justify-between gap-2 border-l-4 border-muted-foreground px-3 py-2 md:min-h-[84px] md:flex-nowrap md:gap-4 md:px-4 md:py-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileView("list")}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
                aria-label="Volver a chats"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <ChatAvatar />
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold text-foreground">
                  {activeConversation?.displayName || activeConversationId}
                </h2>
                <p className="mt-1 text-xs text-foreground">
                  Asignado: {activeConversation?.assignedUserName || "Sin asignar"}
                </p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">
                  Control: {activeConversation?.attentionQueue === "AGENT_ACTIVE"
                    ? "IA Kiments"
                    : activeConversation?.attentionQueue === "HUMAN_ACTIVE"
                      ? "Asesora"
                      : activeConversation?.attentionQueue === "ADVISOR_REQUIRED"
                        ? "En espera"
                        : "Resuelto"}
                </p>
                <p className="mt-1 text-xs text-foreground">
                  {getConversationContactLabel(activeConversation)}: {activeConversation?.phone || "Numero no disponible"}
                </p>
              </div>
            </div>

            <div className="flex w-full items-center justify-center gap-1.5 md:w-auto md:justify-start md:gap-2">
              {canManageActiveConversation && !isUnassignedWaitingActive && !isAgentActive && <div className="relative flex rounded-full bg-muted text-foreground shadow-sm">
                {resolvedIds.has(activeConversationId) ? (
                  <Button
                    onClick={() => void handleReopenCurrent()}
                    disabled={isConversationActionPending}
                    className={cn(
                      "h-8 rounded-l-full px-3 text-[10px] font-bold md:h-10 md:px-9 md:text-xs",
                      isConversationActionPending
                        ? "bg-muted/50 text-muted-foreground"
                        : "bg-muted text-foreground hover:bg-muted/80",
                    )}
                  >
                    REHACER
                  </Button>
                ) : (
                  <Button
                    onClick={() => void handleResolveCurrent()}
                    disabled={isConversationActionPending}
                    className={cn(
                      "h-8 rounded-l-full px-3 text-[10px] font-bold md:h-10 md:px-9 md:text-xs",
                      isConversationActionPending
                        ? "bg-muted/50 text-muted-foreground"
                        : "bg-muted text-foreground hover:bg-muted/80",
                    )}
                  >
                    RESOLVER
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={() => setIsActionMenuOpen((open) => !open)}
                  disabled={!activeConversationId || isUnassignedWaitingActive}
                  className="h-8 w-8 rounded-r-full border-l border-border bg-muted px-0 text-foreground hover:bg-muted/80 disabled:opacity-50 md:h-10 md:w-11"
                  aria-label="Mas acciones del chat"
                >
                  <ChevronDownIcon className="h-3.5 w-3.5 md:h-4 md:w-4" />
                </Button>
                {isActionMenuOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-lg border border-border bg-background py-1 text-sm shadow-lg">
                    <button
                      type="button"
                      onClick={() => void openTransferModal()}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-foreground transition-colors hover:bg-muted"
                    >
                      <UserPlusIcon className="h-4 w-4" />
                      Transferir chat
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionMenuOpen(false);
                        setIsDeleteConversationOpen(true);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
                    >
                      <TrashIcon className="h-4 w-4" />
                      Eliminar chat
                    </button>
                  </div>
                )}
              </div>}
              {canManageActiveConversation && activeConversation?.attentionQueue === "HUMAN_ACTIVE" && (
                <Button
                  type="button"
                  onClick={() => void handleEnableAgentCurrent()}
                  disabled={isConversationActionPending}
                  className="h-8 rounded-full bg-sky-600 px-3 text-[10px] font-bold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60 md:h-10 md:px-5 md:text-xs"
                  aria-label="Habilitar IA Kiments"
                  title="Habilitar IA Kiments"
                >
                  {isConversationActionPending ? "HABILITANDO..." : "HABILITAR IA"}
                </Button>
              )}
              {(isUnassignedWaitingActive || isAgentActive) && (
                <Button
                  type="button"
                  onClick={() => void handleAcceptCurrent()}
                  disabled={acceptingConversationId === activeConversationId}
                  className="h-8 rounded-full bg-muted px-3 text-[10px] font-bold text-foreground shadow-sm hover:bg-muted/80 disabled:opacity-60 md:h-10 md:px-9 md:text-xs"
                  aria-label="Aceptar chat y cambiar a atencion humana"
                  title="Aceptar chat"
                >
                  {acceptingConversationId === activeConversationId ? "ACEPTANDO..." : "ACEPTAR"}
                </Button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (activeConversationId) void loadMessages(activeConversationId, { preserveLocal: true }).catch(() => undefined)
                }}
                disabled={isMessagesLoading}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                aria-label="Recargar mensajes"
                title="Recargar mensajes"
              >
                <ArrowPathIcon className={cn("h-5 w-5", isMessagesLoading && "animate-spin")} />
              </button>
              <span
                title="Venta rápida"
              >
                <button
                  type="button"
                  onClick={openQuickSaleSidebar}
                  disabled={!canOperateActiveConversation}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    isSidebarOpen && sidebarPanel === "sale"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  aria-label="Abrir panel de venta"
                >
                  <ShoppingBagIcon className="h-5 w-5" />
                </button>
              </span>
              <span title="Galería">
                <button
                  type="button"
                  onClick={openGallerySidebar}
                  disabled={!activeConversationId}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    isSidebarOpen && sidebarPanel === "gallery"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  aria-label="Abrir galería multimedia"
                >
                  <PhotoIcon className="h-5 w-5" />
                </button>
              </span>
            </div>
          </div>

          <button
              type="button"
              onClick={() => { if (canManageActiveConversation) openTagModal(); }}
              disabled={!canManageActiveConversation}
              className="flex h-10 w-full items-center justify-between px-4 text-left text-sm text-muted-foreground transition-colors enabled:hover:text-foreground disabled:cursor-default"
            >
              <span className="flex items-center gap-2">
                Etiquetas
                {activeConversationTags.length > 0 && (
                  <span className="flex items-center gap-1">
                    {activeConversationTags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                        style={{ backgroundColor: tag.color }}
                      >
                        {tag.label}
                      </span>
                    ))}
                  </span>
                )}
              </span>
              {canManageActiveConversation && <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />}
            </button>
        </header>

        <div className="relative min-h-0 flex-1 overflow-hidden bg-muted/60">
          <ChatWallpaperLayer />
          <div
            ref={messageScrollRef}
            onScroll={handleMessagesScroll}
            className="sidebar-scroll relative z-10 h-full overflow-y-auto px-3 py-3 md:px-8"
          >
            <div className="flex min-h-full flex-col justify-end gap-3">
              {isMessagesLoading && messages.length === 0 ? (
                <ChatMessageSkeletons />
              ) : (
                <>
                  {isOlderMessagesLoading && <ChatMessageSkeletons compact />}
                  {dedupeMessages(messages).map((item, index, visibleMessages) => {
                    const previousMessage = index > 0 ? visibleMessages[index - 1] : null;
                    const showDateSeparator = Boolean(
                      item.createdAt
                      && conversationDayKey(item.createdAt) !== conversationDayKey(previousMessage?.createdAt),
                    );

                    return (
                      <Fragment key={item.id}>
                        {showDateSeparator && (
                          <ChatDateSeparator label={formatConversationDayLabel(item.createdAt)} />
                        )}
                        <MessageBubble
                          item={item}
                          onOpenImagePreview={setImagePreview}
                          onRetry={retryMessage}
                          onReply={handleReplyToMessage}
                          onDelete={handleDeleteMessage}
                          canDelete={canManageActiveConversation || item.sentByUserId === user?.idUsuario}
                          deleting={deletingMessageId === item.id}
                          onSendReceipt={sendSaleReceipt}
                        />
                      </Fragment>
                    );
                  })}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {canOperateActiveConversation ? (
        <footer className="relative z-20 shrink-0 bg-muted/60 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:px-3 md:pb-3">
          <ChatWallpaperLayer />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelection}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
          {showQuickCommandMenu && (
            <div className="absolute bottom-full left-2 right-2 z-40 mb-2 overflow-hidden rounded-2xl border border-border bg-background shadow-2xl md:left-3 md:right-auto md:w-[440px]">
              <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                <BoltIcon className="h-4 w-4 text-blue-500" />
                Mensajes rapidos
              </div>
              {quickMessagesLoading ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">Cargando comandos...</p>
              ) : matchingQuickMessages.length === 0 ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">No hay comandos para “/{quickCommandQuery}”.</p>
              ) : (
                <div className="max-h-[min(55vh,480px)] overflow-y-auto p-1.5">
                  {matchingQuickMessages.map((command, index) => {
                    const commandText = command.blocks
                      .map((block) => block.body?.trim())
                      .filter(Boolean)
                      .join("\n\n");
                    const commandImages = command.blocks.filter(
                      (block) => block.type === "IMAGE" && block.mediaUrl,
                    );

                    return (
                      <button
                        key={command.id}
                        type="button"
                        disabled={isQuickMessageSending}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => void sendQuickMessage(command)}
                        className={cn(
                          "mb-1 flex w-full flex-col rounded-xl px-3 py-3 text-left transition-colors last:mb-0 disabled:cursor-wait disabled:opacity-60",
                          index === quickCommandIndex ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-muted",
                        )}
                      >
                        <span className="flex w-full items-center justify-between gap-3">
                          <span className="font-mono text-sm font-bold text-foreground">/{command.keyword}</span>
                          <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">
                            {command.blocks.length} bloque{command.blocks.length === 1 ? "" : "s"}
                          </span>
                        </span>
                        {commandText && (
                          <span className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">
                            {commandText}
                          </span>
                        )}
                        {commandImages.length > 0 && (
                          <span className="mt-2 flex w-full flex-wrap gap-2">
                            {commandImages.map((block) => (
                              <AuthenticatedImageThumbnail
                                key={block.id}
                                src={block.mediaUrl}
                                alt={block.fileName || "Imagen del comando"}
                                className="h-12 w-12 rounded-lg border border-border bg-muted bg-cover bg-center bg-no-repeat shadow-sm"
                              />
                            ))}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {replyComposer}
          <div className="relative z-10 md:hidden">
            {isMobileRecording ? (
              <div className="flex min-h-12 items-center gap-2 rounded-[24px] bg-background/95 px-3 py-2 shadow-sm">
                <button
                  type="button"
                  onClick={() => handleStopMobileAudioRecording("cancel")}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-red-500 transition-colors active:bg-red-500/10"
                  aria-label="Cancelar grabación"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-muted/60 px-3 py-2">
                  <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
                  <span className="w-11 shrink-0 text-sm font-semibold tabular-nums text-red-500">
                    {formatAudioDuration(mobileRecordingSeconds)}
                  </span>
                  <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
                    {AUDIO_WAVEFORM_BARS.map((height, index) => (
                      <span
                        key={`mobile-rec-${height}-${index}`}
                        className="mobile-recording-wave w-1 shrink-0 rounded-full bg-muted-foreground/60"
                        style={{ height: Math.max(6, height - 6) }}
                      />
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleStopMobileAudioRecording("preview")}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-red-500 transition-colors active:bg-red-500/10"
                  aria-label="Detener grabacion"
                >
                  <PauseIcon className="h-5 w-5 fill-current" />
                </button>
                <button
                  type="button"
                  onClick={() => handleStopMobileAudioRecording("send")}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition-colors active:bg-emerald-600"
                  aria-label="Enviar audio"
                >
                  <PaperAirplaneIcon className="h-5 w-5" />
                </button>
              </div>
            ) : mobileAudioPreview ? (
              <div className="flex min-h-12 items-center gap-2 rounded-[24px] bg-background/95 px-3 py-2 shadow-sm">
                <audio
                  ref={mobileAudioPreviewRef}
                  src={mobileAudioPreview.audioUrl}
                  onEnded={() => {
                    setIsMobileAudioPreviewPlaying(false);
                    setMobileAudioProgress(0);
                  }}
                  onPause={() => setIsMobileAudioPreviewPlaying(false)}
                  onPlay={() => setIsMobileAudioPreviewPlaying(true)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={handleDeleteMobileAudioPreview}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted"
                  aria-label="Eliminar audio"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={handleToggleMobileAudioPreview}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition-colors active:bg-emerald-600"
                  aria-label={
                    isMobileAudioPreviewPlaying ? "Pausar audio" : "Reproducir audio"
                  }
                >
                  {isMobileAudioPreviewPlaying ? (
                    <PauseIcon className="h-5 w-5 fill-current" />
                  ) : (
                    <PlayIcon className="h-5 w-5 fill-current" />
                  )}
                </button>
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-muted/60 px-3 py-2">
                  <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
                    {AUDIO_WAVEFORM_BARS.map((height, index) => {
                      const barPosition = (index / AUDIO_WAVEFORM_BARS.length) * 100;
                      const isPlayed = barPosition <= mobileAudioProgress;
                      return (
                        <span
                          key={`mobile-preview-${height}-${index}`}
                          className={`w-1 shrink-0 rounded-full transition-colors ${
                            isMobileAudioPreviewPlaying
                              ? "mobile-recording-wave"
                              : ""
                          }`}
                          style={{
                            height: Math.max(6, height - 6),
                            backgroundColor: isPlayed
                              ? "rgb(34, 197, 94)"
                              : "rgb(156, 163, 175)",
                          }}
                        />
                      );
                    })}
                  </div>
                  <span className="w-11 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
                    {formatAudioDuration(mobileAudioPreview.duration)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSendMobileAudioPreview}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition-colors active:bg-emerald-600"
                  aria-label="Enviar audio"
                >
                  <PaperAirplaneIcon className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <form className="flex items-end gap-2" onSubmit={handleComposerSubmit}>
                <div className={`flex min-h-12 flex-1 items-end gap-2 bg-background/95 px-3 py-1 shadow-sm transition-[border-radius,height] ${
                  replyTarget ? "rounded-b-[24px] rounded-t-none" : "rounded-[24px]"
                }`}>
                  <div className="relative">
                    <button
                      ref={mobileEmojiButtonRef}
                      type="button"
                      onTouchStart={handleMobileEmojiTouchStart}
                      onMouseDown={handleMobileEmojiMouseDown}
                      onClick={handleMobileEmojiClick}
                      data-testid="mobile-emoji-button"
                       className="mb-1 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Abrir selector de emojis"
                      aria-expanded={emojiPickerOpen}
                    >
                      {emojiPickerOpen ? (
                        <Keyboard className="h-5 w-5" />
                      ) : (
                        <FaceSmileIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                                    <button
                    type="button"
                    onClick={handleAttachFileClick}
                    className="mb-1 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Adjuntar archivo"
                  >
                    <DocumentPlusIcon className="h-5 w-5" />
                  </button>
                  <textarea
                    ref={mobileInputRef}
                    inputMode="text"
                    autoComplete="off"
                    rows={1}
                    value={messageDraft}
                    onChange={handleDraftChange}
                    onInput={handleDraftInput}
                    onFocus={handleMobileInputFocus}
                    onKeyDown={handleMessageKeyDown}
                    placeholder="Mensaje"
                    data-testid="mobile-message-input"
                    className="sidebar-scroll max-h-[136px] min-h-10 min-w-0 flex-1 resize-none border-0 bg-transparent py-2 text-base leading-6 text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleMobileSendClick}
                  data-testid="mobile-send-button"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition-colors hover:bg-emerald-600"
                  aria-label={messageDraft.trim() ? "Enviar mensaje" : "Grabar audio"}
                >
                  {messageDraft.trim() ? (
                    <PaperAirplaneIcon className="h-5 w-5" />
                  ) : (
                    <MicrophoneIcon className="h-6 w-6" />
                  )}
                </button>
              </form>
            )}
            {emojiPickerOpen && !mobileAudioPreview && !isMobileRecording && (
              <MobileEmojiPanel
                activeCategory={activeMobileEmojiCategory}
                onBackspace={handleMobileEmojiBackspace}
                onCategoryChange={setActiveMobileEmojiCategory}
                onEmojiSelect={handleMobileEmojiSelect}
                panelRef={mobileEmojiPanelRef}
              />
            )}
          </div>

          {desktopRecorderError && (
            <div className="relative z-10 hidden pb-2 text-xs font-medium text-red-500 md:block">
              {desktopRecorderError}
            </div>
          )}

          <form
            className={`relative z-10 hidden min-h-14 items-end gap-3 bg-background px-4 py-2 shadow-sm md:flex md:border md:border-border/70 md:bg-background/95 md:shadow-[0_1px_2px_rgba(11,20,26,0.12)] xl:gap-4 xl:px-5 ${
              replyTarget ? "rounded-b-[28px] rounded-t-none" : "rounded-[28px]"
            }`}
            onSubmit={handleComposerSubmit}
          >
            {isDesktopRecording ? (
              <>
                <button
                  type="button"
                  onClick={() => handleStopDesktopAudioRecording("cancel")}
                  className="mb-1 flex h-10 w-10 items-center justify-center rounded-full text-red-500 transition-colors hover:bg-red-500/10"
                  aria-label="Cancelar grabacion"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
                <div
                  data-testid="desktop-recording-composer"
                  className="desktop-recording-strip mb-1 flex min-h-10 flex-1 items-center gap-3 rounded-full bg-muted/70 px-4"
                >
                  <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
                  <span className="hidden text-sm font-semibold text-red-500 lg:inline">
                    Grabando
                  </span>
                  <span className="w-12 text-sm font-semibold tabular-nums text-red-500">
                    {formatAudioDuration(desktopRecordingSeconds)}
                  </span>
                  <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
                    {AUDIO_WAVEFORM_BARS.map((height, index) => (
                      <span
                        key={`recording-${height}-${index}`}
                        className="desktop-recording-wave w-1 shrink-0 rounded-full bg-muted-foreground/70"
                        style={{ height: Math.max(8, height - 4) }}
                      />
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleStopDesktopAudioRecording("preview")}
                  className="mb-1 flex h-10 w-10 items-center justify-center rounded-full text-red-500 transition-colors hover:bg-red-500/10"
                  aria-label="Detener grabacion"
                >
                  <PauseIcon className="h-5 w-5 fill-current" />
                </button>
                <button
                  type="button"
                  onClick={() => handleStopDesktopAudioRecording("send")}
                  className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition-colors hover:bg-emerald-600"
                  aria-label="Enviar audio"
                >
                  <PaperAirplaneIcon className="h-5 w-5" />
                </button>
              </>
            ) : desktopAudioPreview ? (
              <>
                <button
                  type="button"
                  onClick={handleDeleteDesktopAudioPreview}
                  className="mb-1 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-red-500"
                  aria-label="Eliminar audio"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={handleToggleDesktopAudioPreview}
                  className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition-colors hover:bg-emerald-600"
                  aria-label={
                    isDesktopAudioPreviewPlaying
                      ? "Pausar audio"
                      : "Reproducir audio"
                  }
                >
                  {isDesktopAudioPreviewPlaying ? (
                    <PauseIcon className="h-5 w-5 fill-current" />
                  ) : (
                    <PlayIcon className="h-5 w-5 fill-current" />
                  )}
                </button>
                <div
                  data-testid="desktop-audio-preview-composer"
                  className="desktop-preview-strip mb-1 flex min-h-10 flex-1 items-center gap-3 rounded-full bg-muted/70 px-4"
                >
                  <audio
                    ref={desktopAudioPreviewRef}
                    src={desktopAudioPreview.audioUrl}
                    onEnded={() => setIsDesktopAudioPreviewPlaying(false)}
                    onPause={() => setIsDesktopAudioPreviewPlaying(false)}
                    onPlay={() => setIsDesktopAudioPreviewPlaying(true)}
                    className="hidden"
                  />
                  <span className="hidden text-sm font-semibold text-foreground lg:inline">
                    Vista previa
                  </span>
                  <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
                    {AUDIO_WAVEFORM_BARS.map((height, index) => {
                      const barPosition =
                        (index / (AUDIO_WAVEFORM_BARS.length - 1)) * 100;
                      const isPlayed = barPosition <= desktopAudioProgress;

                      return (
                        <span
                          key={`preview-${height}-${index}`}
                          className={`desktop-preview-wave w-1 shrink-0 rounded-full ${
                            isDesktopAudioPreviewPlaying
                              ? "desktop-preview-wave-playing"
                              : ""
                          }`}
                          style={{
                            height: Math.max(6, height - 8),
                            backgroundColor: isPlayed
                              ? "var(--desktop-preview-wave-played)"
                              : "var(--desktop-preview-wave-idle)",
                          }}
                        />
                      );
                    })}
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {formatAudioDuration(desktopAudioPreview.duration)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleStartDesktopAudioRecording()}
                  className="mb-1 flex h-10 w-10 items-center justify-center rounded-full text-red-500 transition-colors hover:bg-red-500/10"
                  aria-label="Grabar de nuevo"
                >
                  <MicrophoneIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={handleSendDesktopAudioPreview}
                  className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition-colors hover:bg-emerald-600"
                  aria-label="Enviar audio"
                >
                  <PaperAirplaneIcon className="h-5 w-5" />
                </button>
              </>
            ) : (
              <>
                <div className="relative">
                  <button
                    ref={desktopEmojiButtonRef}
                    type="button"
                    onClick={handleEmojiToggle}
                    className="mb-1 flex h-9 w-7 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Abrir selector de emojis"
                    aria-expanded={emojiPickerOpen}
                  >
                    <FaceSmileIcon className="h-5 w-5" />
                  </button>
                  {emojiPickerOpen && (
                    <div
                      ref={desktopEmojiPanelRef}
                      className="absolute bottom-full left-0 z-50 mb-4 w-[352px] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl"
                    >
                      <EmojiPicker
                        onEmojiClick={handleEmojiClick}
                        width="100%"
                        height={390}
                        theme={emojiPickerTheme}
                        emojiStyle={EmojiStyle.NATIVE}
                        lazyLoadEmojis
                        searchPlaceholder="Buscar emoji"
                        previewConfig={{ showPreview: false }}
                        suggestedEmojisMode={SuggestionMode.RECENT}
                        className="!border-0"
                      />
                    </div>
                  )}
                </div>
                                <button
                  type="button"
                  onClick={handleAttachFileClick}
                  className="mb-1 flex h-9 w-7 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Adjuntar archivo"
                >
                  <DocumentPlusIcon className="h-5 w-5" />
                </button>
                <textarea
                  ref={desktopInputRef}
                  autoComplete="off"
                  rows={1}
                  value={messageDraft}
                  onChange={handleDraftChange}
                  onInput={handleDraftInput}
                  onKeyDown={handleMessageKeyDown}
                  placeholder="Escribe un mensaje"
                  className="sidebar-scroll max-h-[136px] min-h-10 min-w-0 flex-1 resize-none border-0 bg-transparent py-2 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="button"
                  onClick={handleDesktopComposerAction}
                  data-testid="desktop-composer-action"
                  className="mb-1 flex h-9 w-7 items-center justify-center text-foreground"
                  aria-label={messageDraft.trim() ? "Enviar mensaje" : "Grabar audio"}
                >
                  {messageDraft.trim() ? (
                    <PaperAirplaneIcon className="h-5 w-5 text-foreground" />
                  ) : (
                    <MicrophoneIcon className="h-5 w-5" />
                  )}
                </button>
              </>
            )}
          </form>
        </footer>
        ) : (
          <div className="relative z-20 shrink-0 bg-muted/60 px-3 pb-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/95 px-4 py-2.5 text-xs text-muted-foreground shadow-sm">
              <span>Acepta el chat para habilitar la respuesta.</span>
              <Button
                type="button"
                size="sm"
                onClick={() => void handleAcceptCurrent()}
                disabled={acceptingConversationId === activeConversationId}
                className="h-8 shrink-0 rounded-full bg-muted px-4 text-[10px] font-bold text-foreground shadow-sm hover:bg-muted/80 disabled:opacity-60 md:text-xs"
              >
                {acceptingConversationId === activeConversationId ? "ACEPTANDO..." : "ACEPTAR CHAT"}
              </Button>
            </div>
          </div>
        )}
        {activeAttachment && (
        <div className="absolute inset-0 z-50 flex flex-col bg-[#f7f5f2] text-slate-900 dark:bg-[#111b21] dark:text-white">
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200/80 px-4 dark:border-white/10">
            <button
              type="button"
              onClick={closeAttachmentPreview}
              className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-black/5 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="Cerrar vista previa"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate text-sm font-semibold">{activeAttachment.name}</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {pendingAttachments.length} archivo
                {pendingAttachments.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="h-10 w-10" />
          </header>

          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 py-3">
            {activeAttachment.type.startsWith("image/") ? (
              <div
                role="img"
                aria-label={activeAttachment.name}
                className="h-full max-h-[72vh] w-full max-w-4xl rounded-lg bg-contain bg-center bg-no-repeat shadow-2xl"
                style={{ backgroundImage: `url("${activeAttachment.objectUrl}")` }}
              />
            ) : isVideoFile(activeAttachment.type, activeAttachment.name) ? (
              <video
                src={activeAttachment.objectUrl}
                controls
                playsInline
                preload="metadata"
                className="max-h-[72vh] w-full max-w-4xl rounded-lg bg-black shadow-2xl"
              />
            ) : isPdfAttachment(activeAttachment) ? (
              <div className="flex h-full w-full min-h-0 items-center justify-center overflow-hidden">
                <PdfFirstPagePreview
                  attachment={activeAttachment}
                  className="flex h-full w-full min-h-0 items-center justify-center overflow-hidden"
                  maxHeight={attachmentPdfPreviewBounds.maxHeight}
                  maxWidth={attachmentPdfPreviewBounds.maxWidth}
                  onPageCount={(pageCount) =>
                    setPdfPageCounts((current) => ({
                      ...current,
                      [activeAttachment.id]: pageCount,
                    }))
                  }
                />
              </div>
            ) : (
              <div className="mx-auto flex w-full max-w-sm flex-col items-center rounded-lg bg-white p-8 text-center text-slate-900 shadow-2xl">
                <DocumentIcon className="mb-4 h-16 w-16 text-emerald-600" />
                <p className="break-words text-sm font-semibold">
                  {activeAttachment.name}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {formatFileSize(activeAttachment.size)}
                </p>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-slate-200/80 bg-[#f7f5f2] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 dark:border-white/10 dark:bg-[#111b21]">
            <div className="mx-auto mb-4 flex max-w-2xl items-center gap-2 rounded-lg bg-white px-4 py-2 text-slate-900 shadow-sm dark:bg-[#2a3942] dark:text-slate-100 dark:shadow-none">
              <input
                value={attachmentCaption}
                onChange={(event) => setAttachmentCaption(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSendPendingAttachments();
                  }
                }}
                placeholder="Escribe un mensaje"
                className="h-9 min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-500 dark:text-white dark:placeholder:text-slate-400"
              />
              <FaceSmileIcon className="h-5 w-5 shrink-0 text-slate-500 dark:text-slate-300" />
            </div>

            <div className="flex items-center justify-center gap-2">
              <div className="sidebar-scroll flex max-w-[70vw] items-center gap-2 overflow-x-auto px-1 pb-1">
                {pendingAttachments.map((attachment) => {
                  const selected = attachment.id === activeAttachment.id;

                  return (
                    <button
                      key={attachment.id}
                      type="button"
                      onClick={() => setActiveAttachmentId(attachment.id)}
                      className={`relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border-2 bg-white text-slate-900 ${
                        selected ? "border-emerald-500" : "border-transparent"
                      }`}
                      aria-label={`Ver ${attachment.name}`}
                    >
                      {attachment.type.startsWith("image/") ? (
                        <span
                          className="h-full w-full bg-cover bg-center"
                          style={{
                            backgroundImage: `url("${attachment.objectUrl}")`,
                          }}
                        />
                      ) : isVideoFile(attachment.type, attachment.name) ? (
                        <video
                          src={attachment.objectUrl}
                          muted
                          playsInline
                          preload="metadata"
                          className="h-full w-full object-cover"
                        />
                      ) : isPdfAttachment(attachment) ? (
                        <PdfFirstPagePreview
                          attachment={attachment}
                          className="flex h-full w-full items-center justify-center overflow-hidden"
                          maxHeight={60}
                          maxWidth={48}
                          onPageCount={(pageCount) =>
                            setPdfPageCounts((current) => ({
                              ...current,
                              [attachment.id]: pageCount,
                            }))
                          }
                        />
                      ) : (
                        <DocumentIcon className="h-7 w-7 text-emerald-600" />
                      )}
                      <span className="absolute bottom-0 left-0 right-0 truncate bg-black/55 px-1 py-0.5 text-[9px] text-white">
                        {attachment.name}
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          removePendingAttachment(attachment.id);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            removePendingAttachment(attachment.id);
                          }
                        }}
                        className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
                        aria-label={`Quitar ${attachment.name}`}
                      >
                        <XMarkIcon className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={handleAttachFileClick}
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-700 transition-colors hover:bg-black/5 dark:border-white/30 dark:text-white dark:hover:bg-white/10"
                  aria-label="Agregar otro archivo"
                >
                  <PlusIcon className="h-7 w-7" />
                </button>
              </div>
              <button
                type="button"
                onClick={handleSendPendingAttachments}
                className="ml-2 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition-colors hover:bg-emerald-600 dark:text-[#111b21] dark:hover:bg-emerald-400"
                aria-label="Enviar archivos"
              >
                <PaperAirplaneIcon className="h-7 w-7 fill-current" />
              </button>
            </div>
          </div>
        </div>
        )}
        {imagePreview && (
          <div className="fixed inset-0 z-[80] flex flex-col bg-[#f7f5f2] text-slate-900 dark:bg-black dark:text-white">
            <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200/80 px-4 dark:border-white/10">
              <button
                type="button"
                onClick={() => setImagePreview(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-black/5 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Cerrar imagen"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
              <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold">
                {imagePreview.alt}
              </p>
              <a
                href={imagePreview.url}
                download={imagePreview.alt}
                className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-black/5 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label={`Descargar ${imagePreview.alt}`}
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
              </a>
            </header>
            <div
              role="img"
              aria-label={imagePreview.alt}
              className="min-h-0 flex-1 bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: `url("${imagePreview.url}")` }}
            />
          </div>
        )}
        {isDraggingFiles && !activeAttachment && !imagePreview && (
          <div className="pointer-events-none absolute inset-0 z-[45] flex items-center justify-center bg-emerald-500/10 p-6 backdrop-blur-[2px]">
            <div className="rounded-2xl border-2 border-dashed border-emerald-500 bg-white/95 px-8 py-6 text-center text-slate-900 shadow-2xl dark:bg-slate-950/95 dark:text-white">
              <DocumentPlusIcon className="mx-auto h-12 w-12 text-emerald-500" />
              <p className="mt-3 text-base font-semibold">Suelta tus archivos aqui</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Se abriran en la vista previa antes de enviar
              </p>
            </div>
          </div>
        )}
          </>
        )}
      </div>
      {isSidebarOpen && activeConversationId && (
        <div className="hidden w-[340px] shrink-0 md:block">
          <ChatSidebar
            conversationId={activeConversationId}
            isAdmin={isAdmin}
            clientPhone={activeConversation?.phone || ""}
            contactName={activeConversation?.contactName}
            onClientUpdated={() => {
              void loadConversations();
            }}
            onSaleCompleted={() => undefined}
            onClose={() => setIsSidebarOpen(false)}
            activePanel={sidebarPanel}
            onActivePanelChange={setSidebarPanel}
            realtimeMedia={galleryRealtimeMedia}
          />
        </div>
      )}

    {/* Mobile sidebar overlay - fullscreen */}
    {isSidebarOpen && activeConversationId && (
      <div className="fixed inset-0 z-50 flex flex-col bg-background md:hidden">
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-3 py-2.5">
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Volver al chat
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <ChatSidebar
            conversationId={activeConversationId}
            isAdmin={isAdmin}
            clientPhone={activeConversation?.phone || ""}
            contactName={activeConversation?.contactName}
            onClientUpdated={() => {
              void loadConversations();
            }}
            onSaleCompleted={() => {
              setIsSidebarOpen(false);
              void loadConversations();
            }}
            onClose={() => setIsSidebarOpen(false)}
            activePanel={sidebarPanel}
            onActivePanelChange={setSidebarPanel}
            realtimeMedia={galleryRealtimeMedia}
          />
        </div>
      </div>
    )}
      </div>
    </section>

    <Dialog open={isTransferModalOpen} onOpenChange={setIsTransferModalOpen}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <div className="relative border-b border-border bg-background px-6 pb-4 pt-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <ArrowPathRoundedSquareIcon className="h-6 w-6" />
            </span>
            <div className="min-w-0 pr-6 text-left">
              <DialogHeader className="text-left">
                <DialogTitle>Transferir chat</DialogTitle>
              </DialogHeader>
              <p className="mt-1 text-xs text-muted-foreground">
                Elige el usuario que continuara la conversacion.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background text-sm font-bold text-foreground shadow-sm ring-1 ring-border">
              {getInitials(activeConversation?.displayName ?? null, activeConversation?.phone ?? "")}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {activeConversation?.displayName || "Chat seleccionado"}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                Asignado actual: {activeConversation?.assignedUserName || "Sin asignar"}
              </p>
            </div>
          </div>

          <div className="relative">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={transferSearch}
              onChange={(event) => setTransferSearch(event.target.value)}
              placeholder="Buscar usuario"
              className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div className="sidebar-scroll -mx-1 max-h-72 space-y-1 overflow-y-auto px-1">
            {isLoadingTransferUsers ? (
              <div className="flex flex-col items-center gap-3 px-4 py-8 text-center text-sm text-muted-foreground">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Cargando usuarios...
              </div>
            ) : filteredTransferUsers.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No hay usuarios disponibles.
              </div>
            ) : (
              filteredTransferUsers.map((transferUser) => {
                const selected = selectedTransferUserId === transferUser.id;

                return (
                  <button
                    key={transferUser.id}
                    type="button"
                    onClick={() => setSelectedTransferUserId(transferUser.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all",
                      selected
                        ? "border-emerald-500/40 bg-emerald-500/5 ring-1 ring-emerald-500/30"
                        : "border-transparent hover:bg-muted/60",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                        selected ? "bg-emerald-500 text-white" : "bg-muted text-foreground",
                      )}
                    >
                      {getInitials(transferUser.name, transferUser.email)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {transferUser.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {transferUser.role} · {transferUser.email}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                        selected ? "border-emerald-500 bg-emerald-500 text-white" : "border-border",
                      )}
                    >
                      {selected && <CheckIcon className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {transferError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
              {transferError}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border bg-muted/30 px-6 py-4">
          <Button
            variant="outline"
            onClick={() => setIsTransferModalOpen(false)}
            size="sm"
            className="rounded-full"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => void handleTransferCurrent()}
            size="sm"
            disabled={!selectedTransferUserId || isTransferring}
            className="rounded-full bg-emerald-600 text-white hover:bg-emerald-600/90"
          >
            {isTransferring ? "Transfiriendo..." : "Transferir"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog
      open={Boolean(deleteMessageTarget)}
      onOpenChange={(open) => {
        if (!open && !deletingMessageId) setDeleteMessageTarget(null);
      }}
    >
      <DialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-sm"
      >
        <div className="flex flex-col items-center gap-3 px-6 pt-7 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
            <TrashIcon className="h-6 w-6" />
          </span>
          <DialogHeader className="text-center">
            <DialogTitle>Eliminar mensaje</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se eliminara el mensaje para todos. Esta accion no se puede deshacer.
          </p>
        </div>
        <div className="mt-6 flex justify-end gap-2 border-t border-border bg-muted/30 px-6 py-4">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={Boolean(deletingMessageId)}
            onClick={() => setDeleteMessageTarget(null)}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            className="rounded-full bg-red-600 text-white hover:bg-red-600/90"
            disabled={Boolean(deletingMessageId)}
            onClick={() => void confirmDeleteMessage()}
          >
            {deletingMessageId ? "Eliminando..." : "Eliminar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog
      open={isDeleteConversationOpen}
      onOpenChange={(open) => {
        if (!isDeletingConversation) setIsDeleteConversationOpen(open);
      }}
    >
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-sm">
        <div className="flex flex-col items-center gap-3 px-6 pt-7 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
            <TrashIcon className="h-6 w-6" />
          </span>
          <DialogHeader className="text-center">
            <DialogTitle>Eliminar chat</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se eliminará esta conversación completa, incluidos sus mensajes, imágenes, audios y archivos. Esta acción no se puede deshacer.
          </p>
        </div>
        <div className="mt-6 flex justify-end gap-2 border-t border-border bg-muted/30 px-6 py-4">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={isDeletingConversation}
            onClick={() => setIsDeleteConversationOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            className="rounded-full bg-red-600 text-white hover:bg-red-600/90"
            disabled={isDeletingConversation}
            onClick={() => void confirmDeleteConversation()}
          >
            {isDeletingConversation ? "Eliminando..." : "Eliminar chat"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isTagModalOpen} onOpenChange={setIsTagModalOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar etiqueta</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Nombre de la etiqueta
            </label>
            <input
              type="text"
              value={newTagLabel}
              onChange={(e) => setNewTagLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void addTag(); }}
              placeholder="Ej: Pendiente, Urgente, VIP..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-muted-foreground/30"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {TAG_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setNewTagColor(color.value)}
                  className={`h-8 w-8 rounded-full ${color.bg} transition-all ${
                    newTagColor === color.value
                      ? "ring-2 ring-foreground ring-offset-2 scale-110"
                      : "hover:scale-105"
                  }`}
                  title={color.label}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Etiquetas disponibles
            </label>
            {tagsLoading ? (
              <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Cargando etiquetas...
              </p>
            ) : (
              <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-border bg-muted/20 p-2">
                {availableTags
                  .filter((tag) => !activeConversationTags.some((activeTag) => activeTag.id === tag.id))
                  .map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => void assignTag(tag.id)}
                      disabled={tagSaving}
                      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.label}
                    </button>
                  ))}
                {!availableTags.some((tag) => !activeConversationTags.some((activeTag) => activeTag.id === tag.id)) && (
                  <span className="px-1 py-1 text-xs text-muted-foreground">
                    No hay etiquetas disponibles para asignar.
                  </span>
                )}
              </div>
            )}
          </div>
          {activeConversationTags.length > 0 && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Etiquetas actuales
              </label>
              <div className="flex flex-wrap gap-1.5">
                {activeConversationTags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.label}
                    <button
                      type="button"
                      onClick={() => void removeTag(tag.id)}
                      disabled={tagSaving}
                      className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white/30 hover:bg-white/50 transition-colors"
                    >
                      <XMarkIcon className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setIsTagModalOpen(false)}
              size="sm"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void addTag()}
              size="sm"
              disabled={tagSaving || !newTagLabel.trim()}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              {tagSaving ? "Guardando..." : "Crear y asignar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    </>
  );
}

export default function ChatPage() {
  const { user } = useAuth();
  const isAdmin = isCrmAdmin(user?.rol);
  const isWarehouse = isWarehouseUser(user?.rol);
  const isWarehouseOnly = isWarehouseOnlyUser(user?.rol);
  const searchParams = useSearchParams();
  const area = isWarehouseOnly
    ? "shipping"
    : (isAdmin || isWarehouse) && searchParams.get("area") === "shipping"
      ? "shipping"
      : "sales";

  if (!isAdmin && !isWarehouse) return <SalesChatPage />;

  return (
    <div className="h-full min-h-0 bg-background">
      {area === "sales" ? <SalesChatPage key="sales" /> : <ShippingChatPanel key="shipping" />}
    </div>
  );
}
