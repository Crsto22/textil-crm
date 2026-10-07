"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowPathIcon,
  BookOpenIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { authFetch } from "@/lib/auth/auth-fetch"

const CATEGORIES = [
  ["ENVIOS", "Envios"],
  ["TIENDAS", "Tiendas"],
  ["HORARIOS", "Horarios"],
  ["UBICACION", "Ubicacion"],
  ["POLITICAS", "Politicas"],
  ["CUIDADOS", "Cuidados"],
  ["FAQ", "Preguntas frecuentes"],
  ["INSTITUCIONAL", "Institucional"],
  ["OTROS", "Otros"],
] as const

type KnowledgeCategory = (typeof CATEGORIES)[number][0]
type KnowledgeStatus = "BORRADOR" | "INDEXANDO" | "ACTIVO" | "ERROR"

interface KnowledgeArticle {
  id: number
  title: string
  category: KnowledgeCategory
  content: string
  keywords: string
  status: KnowledgeStatus
  activeVersion: number
  pendingVersion: number
  lastError: string
  indexedAt: string | null
  updatedAt: string
}

interface KnowledgeSource {
  articleId: number
  chunkId: number
  title: string
  category: KnowledgeCategory
  content: string
  score: number
}

interface ArticleForm {
  title: string
  category: KnowledgeCategory
  content: string
  keywords: string
  active: boolean
}

const EMPTY_FORM: ArticleForm = {
  title: "",
  category: "FAQ",
  content: "",
  keywords: "",
  active: true,
}

async function responseMessage(response: Response, fallback: string) {
  try {
    const payload = await response.json()
    return typeof payload.message === "string" ? payload.message : fallback
  } catch {
    return fallback
  }
}

export function AiKnowledgeBasePanel({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false)
  const [articles, setArticles] = useState<KnowledgeArticle[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<ArticleForm>(EMPTY_FORM)
  const [testQuestion, setTestQuestion] = useState("")
  const [testing, setTesting] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [testAnswer, setTestAnswer] = useState("")
  const [testSources, setTestSources] = useState<KnowledgeSource[]>([])

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set("q", query.trim())
      if (category) params.set("category", category)
      const response = await authFetch(`/api/crm/whatsapp/connection/ai-knowledge?${params}`, { cache: "no-store" })
      if (!response.ok) throw new Error(await responseMessage(response, "No se pudo cargar la base de conocimiento"))
      setArticles((await response.json()) as KnowledgeArticle[])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar la base de conocimiento")
    } finally {
      setLoading(false)
    }
  }, [category, enabled, query])

  useEffect(() => {
    if (!open) return
    const timeout = window.setTimeout(() => void load(), 250)
    return () => window.clearTimeout(timeout)
  }, [load, open])

  useEffect(() => {
    if (!open || !articles.some((article) => article.status === "INDEXANDO")) return
    const interval = window.setInterval(() => void load(), 5000)
    return () => window.clearInterval(interval)
  }, [articles, load, open])

  const activeCount = useMemo(
    () => articles.filter((article) => article.status === "ACTIVO").length,
    [articles],
  )

  const startCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const startEdit = (article: KnowledgeArticle) => {
    setEditingId(article.id)
    setForm({
      title: article.title,
      category: article.category,
      content: article.content,
      keywords: article.keywords,
      active: article.status !== "BORRADOR",
    })
    setShowForm(true)
  }

  const save = async () => {
    if (form.title.trim().length < 3 || form.content.trim().length < 20) {
      toast.error("Completa un titulo y contenido suficientemente descriptivo")
      return
    }
    setSaving(true)
    try {
      const path = editingId
        ? `/api/crm/whatsapp/connection/ai-knowledge/${editingId}`
        : "/api/crm/whatsapp/connection/ai-knowledge"
      const response = await authFetch(path, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, title: form.title.trim(), content: form.content.trim(), keywords: form.keywords.trim() }),
      })
      if (!response.ok) throw new Error(await responseMessage(response, "No se pudo guardar el articulo"))
      toast.success(form.active ? "Articulo guardado e indexando" : "Borrador guardado")
      setShowForm(false)
      setEditingId(null)
      setForm(EMPTY_FORM)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el articulo")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (article: KnowledgeArticle) => {
    if (!window.confirm(`Eliminar "${article.title}" de la base de conocimiento?`)) return
    setDeletingId(article.id)
    try {
      const response = await authFetch(`/api/crm/whatsapp/connection/ai-knowledge/${article.id}`, { method: "DELETE" })
      if (!response.ok) throw new Error(await responseMessage(response, "No se pudo eliminar el articulo"))
      setArticles((current) => current.filter((item) => item.id !== article.id))
      if (editingId === article.id) {
        setEditingId(null)
        setShowForm(false)
        setForm(EMPTY_FORM)
      }
      toast.success("Articulo eliminado")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar el articulo")
      await load()
    } finally {
      setDeletingId(null)
    }
  }

  const reindex = async (article: KnowledgeArticle) => {
    const response = await authFetch(`/api/crm/whatsapp/connection/ai-knowledge/${article.id}/reindex`, { method: "POST" })
    if (!response.ok) {
      toast.error(await responseMessage(response, "No se pudo reindexar el articulo"))
      return
    }
    toast.success("Reindexacion programada")
    await load()
  }

  const testKnowledge = async () => {
    if (testQuestion.trim().length < 3) {
      toast.error("Escribe una pregunta de prueba")
      return
    }
    setTesting(true)
    setTestAnswer("")
    setTestSources([])
    try {
      const response = await authFetch("/api/crm/whatsapp/connection/ai-knowledge/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: testQuestion.trim() }),
      })
      if (!response.ok) throw new Error(await responseMessage(response, "No se pudo probar el conocimiento"))
      const payload = (await response.json()) as { answer: string; sources: KnowledgeSource[] }
      setTestAnswer(payload.answer)
      setTestSources(payload.sources)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo probar el conocimiento")
    } finally {
      setTesting(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="ai-knowledge-content"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-muted/30"
      >
        <BookOpenIcon className="h-5 w-5 text-blue-600" />
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold">Base de conocimiento</h4>
          <p className="text-xs text-muted-foreground">{activeCount} articulos activos para respuestas RAG.</p>
        </div>
        <ChevronDownIcon className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div id="ai-knowledge-content" className="space-y-4 border-t border-border p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative min-w-0 flex-1">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar articulos..." className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-xs" />
            </label>
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-9 rounded-lg border border-input bg-background px-3 text-xs">
              <option value="">Todas las categorias</option>
              {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <Button type="button" size="sm" onClick={startCreate} disabled={!enabled} className="h-9 rounded-lg text-xs"><PlusIcon className="h-4 w-4" />Articulo</Button>
          </div>

          {showForm && (
            <div className="space-y-3 border-y border-border py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs font-medium">Titulo<input value={form.title} maxLength={160} onChange={(event) => setForm({ ...form, title: event.target.value })} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs" /></label>
                <label className="space-y-1 text-xs font-medium">Categoria<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as KnowledgeCategory })} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs">{CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              </div>
              <label className="block space-y-1 text-xs font-medium">Contenido<textarea value={form.content} maxLength={20000} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="Informacion exacta que IA Kiments puede comunicar..." className="min-h-32 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-xs" /></label>
              <label className="block space-y-1 text-xs font-medium">Palabras clave<input value={form.keywords} maxLength={500} onChange={(event) => setForm({ ...form, keywords: event.target.value })} placeholder="envio, delivery, provincia..." className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs" /></label>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} className="h-4 w-4 accent-primary" />Activar e indexar este articulo</label>
              <div className="flex justify-end gap-2"><Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button><Button type="button" size="sm" onClick={() => void save()} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button></div>
            </div>
          )}

          <div className="space-y-2">
            {loading && articles.length === 0 && <div className="space-y-2">{[0, 1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-lg bg-muted" />)}</div>}
            {!loading && articles.length === 0 && <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">No hay articulos para este filtro.</p>}
            {articles.map((article) => (
              <article key={article.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h5 className="truncate text-xs font-semibold">{article.title}</h5><StatusBadge status={article.status} /></div><p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{article.content}</p><p className="mt-1 text-[10px] text-muted-foreground">{CATEGORIES.find(([value]) => value === article.category)?.[1]}{article.keywords ? ` · ${article.keywords}` : ""}</p>{article.status === "ERROR" && article.lastError && <p className="mt-1 text-[10px] text-red-600">{article.lastError}</p>}</div>
                  <button type="button" title="Editar" onClick={() => startEdit(article)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><PencilSquareIcon className="h-4 w-4" /></button>
                  <button type="button" title="Eliminar" disabled={deletingId === article.id} onClick={() => void remove(article)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50 disabled:cursor-wait disabled:opacity-40">{deletingId === article.id ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <TrashIcon className="h-4 w-4" />}</button>
                </div>
                {article.status === "ERROR" && <Button type="button" size="sm" variant="outline" onClick={() => void reindex(article)} className="mt-2 h-7 rounded-md text-[10px]"><ArrowPathIcon className="h-3.5 w-3.5" />Reintentar indexacion</Button>}
              </article>
            ))}
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <div><h5 className="text-xs font-semibold">Probar conocimiento</h5><p className="text-[10px] text-muted-foreground">Muestra los fragmentos recuperados y la respuesta que recibiria el cliente.</p></div>
            <div className="flex gap-2"><input value={testQuestion} onChange={(event) => setTestQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void testKnowledge() }} placeholder="Ej. Cuanto cuesta el envio?" className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-xs" /><Button type="button" size="sm" onClick={() => void testKnowledge()} disabled={testing} className="h-9 rounded-lg text-xs">{testing ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <CheckCircleIcon className="h-4 w-4" />}Probar</Button></div>
            {testAnswer && <div className="rounded-lg bg-muted/50 p-3"><p className="whitespace-pre-wrap text-xs">{testAnswer}</p>{testSources.length > 0 && <div className="mt-3 space-y-1 border-t border-border pt-2">{testSources.map((source) => <p key={source.chunkId} className="text-[10px] text-muted-foreground"><b>{source.title}</b> · {source.category} · coincidencia {Math.round(source.score * 100)}%</p>)}</div>}</div>}
          </div>
        </div>
      )}
    </section>
  )
}

function StatusBadge({ status }: { status: KnowledgeStatus }) {
  const style = status === "ACTIVO" ? "bg-emerald-100 text-emerald-700" : status === "INDEXANDO" ? "bg-blue-100 text-blue-700" : status === "ERROR" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
  const label = status === "ACTIVO" ? "Activo" : status === "INDEXANDO" ? "Indexando" : status === "ERROR" ? "Error" : "Borrador"
  return <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${style}`}>{label}</span>
}
