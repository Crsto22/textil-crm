export interface QuickMessageBlock {
  id: number
  type: "TEXT" | "IMAGE"
  position: number
  body: string
  fileName: string | null
  mimeType: string | null
  mediaUrl: string | null
}

export interface QuickMessage {
  id: number
  keyword: string
  blocks: QuickMessageBlock[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface QuickMessageSendResponse<Message> {
  status: "COMPLETED" | "PARTIAL" | "FAILED"
  total: number
  sentCount: number
  failedPosition: number | null
  error: string | null
  messages: Message[]
}

export async function readQuickMessageApiError(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { message?: string; detail?: string }
    return data.message || data.detail || fallback
  } catch {
    return fallback
  }
}
