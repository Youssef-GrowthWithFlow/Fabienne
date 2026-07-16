import {
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronLeft,
  Copy,
  EllipsisVertical,
  Handshake,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  PencilLine,
  Phone,
  Send,
  Sparkles,
  Star,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { ActionDialog, type ActionDialogKind } from '@/components/action-dialog'
import { FicheHtml } from '@/components/fiche-html'
import { InlineText } from '@/components/inline-text'
import { RichTextEditor } from '@/components/rich-text-editor'
import { QuickLogDrawer } from '@/components/quick-log-drawer'
import { SignalBadge } from '@/components/signal-badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useEntreprises } from '@/hooks/use-entreprises'
import { useProspects } from '@/hooks/use-prospects'
import {
  getEntreprise,
  regenerateEntrepriseFiche,
} from '@/lib/entreprises-api'
import { getProspect as apiGetProspect } from '@/lib/prospects-api'
import {
  STATUSES,
  formatDate,
  relanceLabel,
  sortComments,
  statusVariant,
  type ActivityKind,
  type Comment,
  type Prospect,
  type ProspectStatus,
} from '@/lib/prospects'
import { cn } from '@/lib/utils'

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M20.451 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.447-2.136 2.94v5.666H9.355V9h3.414v1.561h.049c.476-.9 1.637-1.852 3.37-1.852 3.6 0 4.266 2.37 4.266 5.455v6.288zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.114 20.452H3.558V9h3.556v11.452zM22.225 0H1.771C.792 0 0 .771 0 1.723v20.554C0 23.229.792 24 1.771 24h20.451C23.2 24 24 23.229 24 22.277V1.723C24 .771 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

const INLINE_DISPLAY = 'hover:bg-muted/50 block w-full rounded px-2 py-1'

function AiSpark() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="inline-flex cursor-default" aria-label="Trouvé par l'IA" />
        }
      >
        <Sparkles className="size-3 text-violet-500" />
      </TooltipTrigger>
      <TooltipContent>Trouvé par l'IA</TooltipContent>
    </Tooltip>
  )
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation()
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        } catch {
          // ignore
        }
      }}
      title="Copier"
      aria-label="Copier"
      className="text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  )
}

function CoordRow({
  icon: Icon,
  label,
  copyValue,
  ai,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  copyValue?: string | null
  ai?: boolean
  children: ReactNode
}) {
  return (
    <div className="group flex items-center gap-2">
      <div className="text-muted-foreground flex w-28 shrink-0 items-center gap-2 text-sm">
        <Icon className="size-3.5" />
        <span>{label}</span>
        {ai ? <AiSpark /> : null}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
      {copyValue ? <CopyButton value={copyValue} /> : null}
    </div>
  )
}

function isAiFilled(
  sources: Record<string, string> | undefined,
  field: string,
  value: string | null | undefined,
): boolean {
  if (!value) return false
  const src = sources?.[field]
  return !!src && src !== 'manual'
}

function StatusSelect({
  value,
  onChange,
}: {
  value: ProspectStatus
  onChange: (v: ProspectStatus) => void
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) =>
        typeof v === 'string' && onChange(v as ProspectStatus)
      }
    >
      <SelectTrigger className="hover:bg-transparent h-auto w-fit gap-1.5 rounded-full border-0 bg-transparent px-0 py-0 shadow-none focus:ring-0 [&>svg]:size-3">
        <Badge variant={statusVariant[value]} className="cursor-pointer">
          {value}
        </Badge>
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function Card({
  title,
  children,
  className,
}: {
  title?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('bg-card rounded-xl border p-4 shadow-xs sm:p-5', className)}>
      {title ? (
        <div className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
          {title}
        </div>
      ) : null}
      {children}
    </section>
  )
}

function ContactBigButton({
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <Button
      variant="outline"
      disabled={disabled}
      onClick={onClick}
      className="h-auto flex-1 flex-col gap-1.5 py-3"
    >
      <Icon className="size-5 text-sky-500" />
      <span className="text-xs">{label}</span>
    </Button>
  )
}

function CommentComposer({ onAdd }: { onAdd: (texte: string) => void }) {
  const [draft, setDraft] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  function submit() {
    const t = draft.trim()
    if (!t) return
    onAdd(t)
    setDraft('')
    ref.current?.focus()
  }

  return (
    <div className="space-y-2">
      <Textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            submit()
          }
        }}
        rows={2}
        placeholder="Ajouter une note…"
        className="!text-sm field-sizing-content"
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={submit} disabled={!draft.trim()}>
          Ajouter
        </Button>
      </div>
    </div>
  )
}

const ACTION_KIND_LABEL: Record<ActivityKind, string> = {
  created: 'Contact ajouté',
  message: 'Message envoyé',
  reply: 'Réponse reçue',
  discussion: 'En discussion',
  meeting: 'RDV pris',
  won: 'Client gagné',
  lost: 'Refus',
  no_reply: 'Sans réponse',
}

const ACTION_KIND_COLOR: Partial<Record<ActivityKind, string>> = {
  message: 'border-sky-200 text-sky-700 dark:border-sky-900 dark:text-sky-300',
  reply: 'border-violet-200 text-violet-700 dark:border-violet-900 dark:text-violet-300',
  meeting: 'border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-300',
  won: 'border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300',
  lost: 'border-rose-200 text-rose-600 dark:border-rose-900 dark:text-rose-300',
}

function CommentCard({
  comment,
  actionKind,
  editing,
  onStartEdit,
  onSave,
  onCancel,
  onDelete,
}: {
  comment: Comment
  actionKind?: ActivityKind | null
  editing: boolean
  onStartEdit: () => void
  onSave: (text: string) => void
  onCancel: () => void
  onDelete: () => void
}) {
  const [draft, setDraft] = useState(comment.texte)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (editing) setDraft(comment.texte)
  }, [editing, comment.texte])

  function commit() {
    const t = draft.trim()
    if (!t || t === comment.texte) {
      onCancel()
      return
    }
    onSave(t)
  }

  const actionLabel = actionKind ? ACTION_KIND_LABEL[actionKind] ?? null : null

  return (
    <div className="py-2.5 first:pt-0">
      <div className="text-muted-foreground mb-0.5 flex items-center gap-2 text-xs tabular-nums">
        <span>{formatDate(comment.date)}</span>
        {actionLabel ? (
          <span
            className={cn(
              'rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
              (actionKind && ACTION_KIND_COLOR[actionKind]) ??
                'border-input bg-muted/40 text-muted-foreground',
            )}
          >
            {actionLabel}
          </span>
        ) : null}
      </div>
      {editing ? (
        <>
          <Textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onCancel()
              } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                commit()
              }
            }}
            className="field-sizing-content !text-sm leading-relaxed min-h-0 py-0 px-0 border-0 bg-transparent shadow-none focus-visible:ring-0 resize-none"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="text-muted-foreground hover:text-destructive text-xs"
            >
              Supprimer
            </button>
            <div className="flex gap-1">
              <Button variant="ghost" size="xs" onClick={onCancel}>
                Annuler
              </Button>
              <Button size="xs" onClick={commit}>
                Enregistrer
              </Button>
            </div>
          </div>
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer cette note&nbsp;?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => {
                    setConfirmOpen(false)
                    onDelete()
                  }}
                >
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={onStartEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onStartEdit()
            }
          }}
          className="cursor-text text-sm leading-relaxed break-words whitespace-pre-wrap outline-none"
        >
          {comment.texte}
        </div>
      )}
    </div>
  )
}

/** Company card: signaux, coordonnées enrichies, and the AI fiche with
 *  hoverable sources. */
function EntrepriseCard({ prospect }: { prospect: Prospect }) {
  const { getById, updateEntreprise, ingestMany } = useEntreprises()
  const [regenerating, setRegenerating] = useState(false)
  const [editingFiche, setEditingFiche] = useState(false)
  const [ficheDraft, setFicheDraft] = useState('')

  const record = prospect.entrepriseId ? getById(prospect.entrepriseId) : undefined
  const summary = prospect.entreprise

  const nom = record?.entreprise ?? summary?.entreprise ?? ''
  const fiche = record?.ficheClient ?? summary?.ficheClient ?? ''
  const signaux = record?.signaux ?? summary?.signaux ?? []
  const ficheStatus = record?.ficheStatus ?? summary?.ficheStatus ?? 'none'
  const ficheGenerating = !fiche && ficheStatus === 'generating'
  const entrepriseId = prospect.entrepriseId

  // While the background generation runs, poll so the fiche appears on its
  // own the moment it's ready — no manual refresh.
  useEffect(() => {
    if (!ficheGenerating || !entrepriseId) return
    const id = window.setInterval(async () => {
      try {
        ingestMany([await getEntreprise(entrepriseId)])
      } catch {
        /* keep polling */
      }
    }, 5_000)
    return () => window.clearInterval(id)
  }, [ficheGenerating, entrepriseId, ingestMany])

  if (!prospect.entrepriseId && !summary) return null

  const handleRegenerate = async () => {
    if (!prospect.entrepriseId) return
    setRegenerating(true)
    try {
      const updated = await regenerateEntrepriseFiche(prospect.entrepriseId)
      ingestMany([updated])
      toast.success('Fiche mise à jour.')
    } catch (err) {
      // Surface the backend's French explanation when it has one
      // (e.g. « le modèle n'a effectué aucune recherche Google »).
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail
      toast.error(detail || "Je n'ai pas réussi à générer la fiche — réessaie.")
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <Card
      title={
        <>
          <Building2 className="size-3.5" />
          {nom || 'Son entreprise'}
        </>
      }
    >
      <div className="space-y-6">
        <div className="space-y-4">
          {signaux.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <AiSpark />
              {signaux.map((s, i) => (
                <SignalBadge key={i}>{s}</SignalBadge>
              ))}
            </div>
          ) : null}

          {record ? (
            <div className="space-y-1.5">
              <CoordRow icon={Building2} label="Nom">
                <InlineText
                  value={record.entreprise}
                  onChange={(v) => updateEntreprise(record.id, { entreprise: v })}
                  placeholder="Nom de l'entreprise"
                  displayClassName={INLINE_DISPLAY}
                  emptyLabel="Vide"
                />
              </CoordRow>
              <CoordRow icon={MapPin} label="Ville">
                <InlineText
                  value={record.ville}
                  onChange={(v) => updateEntreprise(record.id, { ville: v })}
                  placeholder="Toulouse"
                  displayClassName={INLINE_DISPLAY}
                  emptyLabel="Vide"
                />
              </CoordRow>
              <CoordRow
                icon={Send}
                label="Site web"
                copyValue={record.siteWeb || null}
              >
                <InlineText
                  type="url"
                  value={record.siteWeb}
                  onChange={(v) => updateEntreprise(record.id, { siteWeb: v })}
                  placeholder="https://…"
                  displayClassName={INLINE_DISPLAY}
                  emptyLabel="Vide"
                />
              </CoordRow>
              <CoordRow
                icon={Mail}
                label="Email"
                copyValue={record.email || null}
                ai={isAiFilled(record.fieldSources, 'email', record.email)}
              >
                <InlineText
                  type="email"
                  value={record.email}
                  onChange={(v) => updateEntreprise(record.id, { email: v })}
                  placeholder="contact@exemple.fr"
                  displayClassName={INLINE_DISPLAY}
                  emptyLabel="Vide"
                />
              </CoordRow>
              <CoordRow
                icon={Phone}
                label="Téléphone"
                copyValue={record.telephone || null}
              >
                <InlineText
                  type="tel"
                  value={record.telephone}
                  onChange={(v) => updateEntreprise(record.id, { telephone: v })}
                  placeholder="05 61 …"
                  displayClassName={INLINE_DISPLAY}
                  emptyLabel="Vide"
                />
              </CoordRow>
              {record.adresse ? (
                <CoordRow icon={MapPin} label="Adresse">
                  <span className="block px-2 py-1 text-sm">{record.adresse}</span>
                </CoordRow>
              ) : null}
              {record.googleRating != null || record.googleMapsUrl ? (
                <CoordRow icon={Star} label="Google">
                  <span className="flex items-center gap-2 px-2 py-1 text-sm">
                    {record.googleRating != null ? (
                      <span className="flex items-center gap-1">
                        <Star className="size-3.5 fill-amber-400 text-amber-400" />
                        {record.googleRating.toFixed(1)}
                        {record.googleRatingCount != null ? (
                          <span className="text-muted-foreground text-xs">
                            ({record.googleRatingCount} avis)
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                    {record.googleMapsUrl ? (
                      <a
                        href={record.googleMapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground underline-offset-2 hover:underline"
                      >
                        Voir sur Maps
                      </a>
                    ) : null}
                  </span>
                </CoordRow>
              ) : null}
              {record.dirigeants && record.dirigeants.length > 0 ? (
                <CoordRow icon={Handshake} label="Dirigeants">
                  <span className="block px-2 py-1 text-sm">
                    {record.dirigeants
                      .map((d) => (d.qualite ? `${d.nom} (${d.qualite})` : d.nom))
                      .join(', ')}
                  </span>
                </CoordRow>
              ) : null}
            </div>
          ) : null}
        </div>

        <div>
          <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
            <Sparkles className="size-3.5 text-violet-500" />
            Fiche préparée par l'IA
            <span className="text-muted-foreground/70 ml-1 font-normal normal-case tracking-normal">
              — survole une phrase soulignée pour voir ses sources
            </span>
          </div>
          {editingFiche ? (
            <RichTextEditor
              value={ficheDraft}
              onChange={setFicheDraft}
              editable
            />
          ) : fiche ? (
            <FicheHtml html={fiche} />
          ) : ficheGenerating ? (
            <div className="flex flex-col gap-3 rounded-lg border border-violet-200/70 bg-violet-50/40 p-4 dark:border-violet-900/60 dark:bg-violet-950/20">
              <div className="flex items-center gap-2 text-sm font-medium text-violet-700 dark:text-violet-300">
                <Loader2 className="size-4 animate-spin" />
                Je prépare la fiche complète…
              </div>
              <p className="text-muted-foreground text-xs">
                Activité, actualité, décideurs, coordonnées — j'analyse le web
                en ce moment. Elle s'affichera ici toute seule dans un instant.
              </p>
              <div className="space-y-2">
                <div className="bg-violet-100 dark:bg-violet-950/60 h-3 w-full animate-pulse rounded" />
                <div className="bg-violet-100 dark:bg-violet-950/60 h-3 w-4/5 animate-pulse rounded" />
                <div className="bg-violet-100 dark:bg-violet-950/60 h-3 w-3/5 animate-pulse rounded" />
              </div>
            </div>
          ) : (
            <div className="bg-muted/20 flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
              <p>
                {ficheStatus === 'error'
                  ? 'La préparation de la fiche a échoué — on retente ?'
                  : 'Pas encore de fiche — je peux en préparer une complète (activité, actualité, décideurs, coordonnées).'}
              </p>
              <Button
                size="sm"
                onClick={handleRegenerate}
                disabled={regenerating || !prospect.entrepriseId}
                className="gap-1.5 bg-violet-600 text-white hover:bg-violet-700"
              >
                {regenerating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                {regenerating ? 'Je prépare la fiche…' : 'Préparer la fiche'}
              </Button>
            </div>
          )}
          {editingFiche ? (
            <div className="mt-2 flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  if (prospect.entrepriseId) {
                    void updateEntreprise(prospect.entrepriseId, {
                      ficheClient: ficheDraft,
                    })
                  }
                  setEditingFiche(false)
                }}
                className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Check className="size-3.5" />
                Enregistrer la fiche
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingFiche(false)}
              >
                Annuler
              </Button>
            </div>
          ) : fiche ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRegenerate}
                disabled={regenerating || !prospect.entrepriseId}
                className="text-muted-foreground gap-1.5"
              >
                {regenerating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                {regenerating ? 'Mise à jour…' : 'Mettre à jour la fiche'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFicheDraft(fiche)
                  setEditingFiche(true)
                }}
                className="text-muted-foreground gap-1.5"
              >
                <PencilLine className="size-3.5" />
                Modifier moi-même
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  )
}

export function ContactSheet({
  prospect,
  onClose,
  onChange,
}: {
  prospect: Prospect
  onClose: () => void
  onChange: (next: Prospect) => void
}) {
  const {
    deleteProspect,
    addComment,
    updateComment,
    deleteComment,
    logAction,
    replaceProspectLocal,
    actions: allActions,
  } = useProspects()

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [actionDialog, setActionDialog] = useState<ActionDialogKind | null>(null)
  const [quickLogOpen, setQuickLogOpen] = useState(false)

  useEffect(() => {
    setEditingCommentId(null)
    setQuickLogOpen(false)
  }, [prospect.id])

  // While the personal-info lookup (web + DropContact) runs in background,
  // poll the prospect so email / téléphone / LinkedIn land on their own.
  const enriching = prospect.enrichmentStatus === 'generating'
  useEffect(() => {
    if (!enriching) return
    const id = window.setInterval(async () => {
      try {
        replaceProspectLocal(await apiGetProspect(prospect.id))
      } catch {
        /* keep polling */
      }
    }, 5_000)
    return () => window.clearInterval(id)
  }, [enriching, prospect.id, replaceProspectLocal])

  const comments = useMemo(
    () => sortComments(prospect.comments),
    [prospect.comments],
  )

  const actionsById = useMemo(
    () => new Map(allActions.map((a) => [a.id, a])),
    [allActions],
  )

  const update = <K extends keyof Prospect>(key: K, value: Prospect[K]) => {
    onChange({ ...prospect, [key]: value })
  }

  const confirmDelete = () => {
    setDeleteOpen(false)
    deleteProspect(prospect.id)
    onClose()
  }

  const tel = prospect.telephone.replace(/\s/g, '')

  return (
    <Sheet
      open
      modal={false}
      onOpenChange={(o, details) => {
        if (o) return
        if (
          details?.reason === 'close-press' ||
          details?.reason === 'escape-key'
        ) {
          onClose()
        }
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex !w-full flex-col gap-0 p-0 sm:!max-w-none lg:!w-[46rem]"
      >
        {/* Barre du haut */}
        <div className="flex shrink-0 items-center gap-2 border-b px-2 py-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5">
            <ChevronLeft className="size-4" />
            Retour
          </Button>
          <span className="text-muted-foreground min-w-0 flex-1 truncate px-2 text-center text-sm font-medium">
            {prospect.nom || prospect.entreprise?.entreprise || 'Contact'}
          </span>
        </div>

        {/* Corps scrollable */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <InlineText
            value={prospect.nom}
            onChange={(v) => update('nom', v)}
            placeholder="Nom du contact"
            displayClassName="hover:bg-muted/50 -mx-2 block rounded px-2 py-0.5 text-2xl font-semibold tracking-tight"
            emptyLabel="Sans nom"
          />
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-1.5 text-sm">
            <InlineText
              value={prospect.role}
              onChange={(v) => update('role', v)}
              placeholder="Son rôle…"
              displayClassName="hover:bg-muted/50 rounded px-1 py-0.5"
              emptyLabel="Ajouter un rôle"
            />
            {prospect.entreprise?.entreprise ? (
              <span>· {prospect.entreprise.entreprise}</span>
            ) : null}
            {prospect.entreprise?.ville ? (
              <span className="text-xs">({prospect.entreprise.ville})</span>
            ) : null}
          </div>
          <div className="mt-2">
            <StatusSelect
              value={prospect.status}
              onChange={(v) => update('status', v)}
            />
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="Plus d'options" />
            }
          >
            <EllipsisVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuItem
              onClick={() => logAction(prospect.id, 'no_reply', {})}
            >
              <MessageSquare className="size-4" />
              Marquer « Sans réponse »
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => logAction(prospect.id, 'lost', {})}>
              <MessageSquare className="size-4" />
              Marquer « Refus »
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              Supprimer le contact
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Two clear columns: infos & actions | historique */}
      <div className="space-y-4">
        <div className="space-y-4">
          <Card title={<>Coordonnées</>}>
            <div className="space-y-3">
              {enriching ? (
                <div className="flex items-center gap-2 rounded-md bg-violet-50 px-3 py-2 text-xs text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                  <Loader2 className="size-3.5 shrink-0 animate-spin" />
                  Je cherche ses coordonnées — email, téléphone direct,
                  LinkedIn. Elles apparaîtront ici toutes seules.
                </div>
              ) : null}
              <div className="flex gap-2">
                <ContactBigButton
                  icon={Mail}
                  label="Email"
                  disabled={!prospect.email}
                  onClick={() => window.open(`mailto:${prospect.email}`, '_blank')}
                />
                <ContactBigButton
                  icon={Phone}
                  label="Appeler"
                  disabled={!prospect.telephone}
                  onClick={() => window.open(`tel:${tel}`, '_blank')}
                />
                <ContactBigButton
                  icon={LinkedinIcon}
                  label="LinkedIn"
                  disabled={!prospect.linkedin}
                  onClick={() => {
                    if (prospect.linkedin) window.open(prospect.linkedin, '_blank')
                  }}
                />
              </div>
              <div className="space-y-1">
                <CoordRow
                  icon={Mail}
                  label="Email"
                  copyValue={prospect.email || null}
                  ai={isAiFilled(prospect.fieldSources, 'email', prospect.email)}
                >
                  <InlineText
                    type="email"
                    value={prospect.email}
                    onChange={(v) => update('email', v)}
                    placeholder="contact@exemple.com"
                    displayClassName={INLINE_DISPLAY}
                    emptyLabel="Ajouter"
                  />
                </CoordRow>
                <CoordRow
                  icon={Phone}
                  label="Téléphone"
                  copyValue={prospect.telephone || null}
                  ai={isAiFilled(
                    prospect.fieldSources,
                    'telephone',
                    prospect.telephone,
                  )}
                >
                  <InlineText
                    type="tel"
                    value={prospect.telephone}
                    onChange={(v) => update('telephone', v)}
                    placeholder="06 12 34 56 78"
                    displayClassName={INLINE_DISPLAY}
                    emptyLabel="Ajouter"
                  />
                </CoordRow>
                <CoordRow
                  icon={LinkedinIcon}
                  label="LinkedIn"
                  copyValue={prospect.linkedin}
                  ai={isAiFilled(
                    prospect.fieldSources,
                    'linkedin',
                    prospect.linkedin,
                  )}
                >
                  <InlineText
                    type="url"
                    value={prospect.linkedin ?? ''}
                    onChange={(v) => update('linkedin', v ? v : null)}
                    placeholder="https://linkedin.com/in/…"
                    displayClassName={INLINE_DISPLAY}
                    emptyLabel="Ajouter"
                  />
                </CoordRow>
              </div>
            </div>
          </Card>

          <Card title={<>Prochaine relance</>}>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <CalendarClock className="text-muted-foreground size-4" />
                <Input
                  type="date"
                  value={prospect.relanceDate ?? ''}
                  onChange={(e) =>
                    update('relanceDate', e.target.value ? e.target.value : null)
                  }
                  className="h-8 w-fit !text-sm"
                />
                {prospect.relanceDate ? (
                  <span className="text-sm font-medium">
                    {relanceLabel(prospect.relanceDate)}
                  </span>
                ) : null}
                <span className="text-muted-foreground text-[11px]">
                  Se met à J+7 après chaque action
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground shrink-0 text-sm">
                  Je dois…
                </span>
                <InlineText
                  value={prospect.relanceNote}
                  onChange={(v) => update('relanceNote', v)}
                  placeholder="Ex : envoyer ma proposition de projet"
                  displayClassName={INLINE_DISPLAY}
                  emptyLabel="Dire quoi faire (optionnel)"
                />
              </div>
            </div>
          </Card>

          <Card title={<>Enregistrer une action</>}>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="justify-center gap-1.5"
                onClick={() => setQuickLogOpen(true)}
              >
                <Send className="size-4 text-sky-500" />
                Message envoyé
              </Button>
              <Button
                variant="outline"
                className="justify-center gap-1.5"
                onClick={() => setActionDialog('message_received')}
              >
                <MessageSquare className="size-4 text-violet-500" />
                Réponse reçue
              </Button>
              <Button
                variant="outline"
                className="justify-center gap-1.5"
                onClick={() => setActionDialog('meeting')}
              >
                <Handshake className="size-4 text-amber-500" />
                RDV pris
              </Button>
              <Button
                variant="outline"
                className="justify-center gap-1.5"
                onClick={() => setActionDialog('won')}
              >
                <CheckCircle2 className="size-4 text-emerald-500" />
                Gagné 🎉
              </Button>
            </div>
          </Card>
        </div>

        <Card title={<>Historique</>}>
          <div className="space-y-3">
            <CommentComposer onAdd={(t) => addComment(prospect.id, t)} />
            {comments.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-xs italic">
                Rien pour le moment — à toi de jouer.
              </p>
            ) : (
              <div className="divide-border divide-y">
                {comments.map((c) => (
                  <CommentCard
                    key={c.id}
                    comment={c}
                    actionKind={actionsById.get(c.actionId ?? '')?.kind ?? null}
                    editing={editingCommentId === c.id}
                    onStartEdit={() => setEditingCommentId(c.id)}
                    onSave={(text) => {
                      updateComment(prospect.id, c.id, text)
                      setEditingCommentId(null)
                    }}
                    onCancel={() => setEditingCommentId(null)}
                    onDelete={() => {
                      deleteComment(prospect.id, c.id)
                      setEditingCommentId(null)
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Entreprise + fiche IA, pleine largeur */}
      <EntrepriseCard prospect={prospect} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Supprimer {prospect.nom || 'ce contact'}&nbsp;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <QuickLogDrawer
        prospect={quickLogOpen ? prospect : null}
        onClose={() => setQuickLogOpen(false)}
      />

      <ActionDialog
        open={actionDialog}
        onOpenChange={setActionDialog}
        onSubmit={async (payload) => {
          await logAction(prospect.id, payload.kind, payload.metadata, payload.at)
        }}
      />
        </div>
      </SheetContent>
    </Sheet>
  )
}
