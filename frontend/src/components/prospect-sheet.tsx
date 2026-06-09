import {
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleDot,
  Copy,
  Handshake,
  Link2,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Send,
  Sparkles,
  Target,
  Trash2,
  Users,
} from 'lucide-react'

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M20.451 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.447-2.136 2.94v5.666H9.355V9h3.414v1.561h.049c.476-.9 1.637-1.852 3.37-1.852 3.6 0 4.266 2.37 4.266 5.455v6.288zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.114 20.452H3.558V9h3.556v11.452zM22.225 0H1.771C.792 0 0 .771 0 1.723v20.554C0 23.229.792 24 1.771 24h20.451C23.2 24 24 23.229 24 22.277V1.723C24 .771 23.2 0 22.222 0h.003z" />
    </svg>
  )
}
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { RichTextEditor } from '@/components/rich-text-editor'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ActionDialog, type ActionDialogKind } from '@/components/action-dialog'
import { InlineText } from '@/components/inline-text'
import { SignalBadge } from '@/components/signal-badge'
import { SourceBadge } from '@/components/source-badge'
import { useActions } from '@/hooks/use-actions'
import { useEntreprises } from '@/hooks/use-entreprises'
import { useProspects } from '@/hooks/use-prospects'
import { regenerateEntrepriseFiche } from '@/lib/entreprises-api'
import { toast } from 'sonner'
import {
  STATUSES,
  formatDate,
  sortComments,
  statusVariant,
  type ActivityKind,
  type Comment,
  type Prospect,
  type ProspectStatus,
} from '@/lib/prospects'

const INLINE_DISPLAY = 'hover:bg-muted/50 block w-full rounded px-2.5 py-1'

function Row({
  icon: Icon,
  label,
  children,
  copyValue,
  source,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: ReactNode
  copyValue?: string | null
  source?: string | null
}) {
  return (
    <div className="group flex flex-col gap-0 rounded-md py-1.5 sm:flex-row sm:items-start sm:gap-2 sm:py-0.5">
      <div className="text-muted-foreground flex shrink-0 items-center gap-2 px-2 py-1 text-xs sm:w-32 sm:py-1.5 sm:text-sm">
        <Icon className="size-3.5" />
        <span>{label}</span>
        {source ? <SourceBadge source={source} /> : null}
      </div>
      <div className="flex min-w-0 flex-1 items-start gap-1">
        <div className="min-w-0 flex-1">{children}</div>
        {copyValue ? <CopyButton value={copyValue} /> : null}
      </div>
    </div>
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
      {copied ? (
        <Check className="size-3.5" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  )
}


function StatusBadge({
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


function CommentComposer({
  onAdd,
}: {
  onAdd: (texte: string) => void
}) {
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
        placeholder="Ajouter un commentaire…"
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
  created: 'Prospect créé',
  message: 'Message envoyé',
  reply: 'Message reçu',
  discussion: 'En discussion',
  meeting: 'RDV pris',
  won: 'Client gagné',
  lost: 'Refus',
  no_reply: 'Sans réponse',
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
          <span className="border-input bg-muted/40 text-muted-foreground rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
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
                <AlertDialogTitle>Supprimer ce commentaire&nbsp;?</AlertDialogTitle>
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


export function ProspectSheet({
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
    addComment: hookAddComment,
    updateComment: hookUpdateComment,
    deleteComment: hookDeleteComment,
    logAction,
  } = useProspects()
  const { ingestMany: ingestEntreprises } = useEntreprises()
  const { actions: allActions } = useActions()
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [actionDialog, setActionDialog] = useState<ActionDialogKind | null>(null)
  const [regeneratingFiche, setRegeneratingFiche] = useState(false)

  useEffect(() => {
    setEditingCommentId(null)
    setRegeneratingFiche(false)
  }, [prospect.id])

  const handleRegenerateFiche = async () => {
    const entrepriseId = prospect.entreprise?.id
    if (!entrepriseId) return
    setRegeneratingFiche(true)
    try {
      const updated = await regenerateEntrepriseFiche(entrepriseId)
      ingestEntreprises([updated])
      // Mirror the new fiche into the prospect's nested entreprise summary so
      // the tab reflects immediately without a full prospect re-fetch.
      onChange({
        ...prospect,
        entreprise: prospect.entreprise
          ? {
              ...prospect.entreprise,
              ficheClient: updated.ficheClient,
              signaux: updated.signaux,
            }
          : prospect.entreprise,
      })
      toast.success('Fiche régénérée.')
    } catch {
      toast.error('Échec de la régénération.')
    } finally {
      setRegeneratingFiche(false)
    }
  }

  const update = <K extends keyof Prospect>(key: K, value: Prospect[K]) => {
    onChange({ ...prospect, [key]: value })
  }

  const addComment = (texte: string) => {
    hookAddComment(prospect.id, texte)
  }

  const updateComment = (id: string, texte: string) => {
    hookUpdateComment(prospect.id, id, texte)
  }

  const deleteComment = (id: string) => {
    hookDeleteComment(prospect.id, id)
  }

  const confirmDelete = () => {
    setDeleteOpen(false)
    deleteProspect(prospect.id)
    onClose()
  }

  const comments = useMemo(
    () => sortComments(prospect.comments),
    [prospect.comments],
  )

  const actionsById = useMemo(
    () => new Map(allActions.map((a) => [a.id, a])),
    [allActions],
  )


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
        className="flex !w-full flex-col gap-0 p-0 sm:!max-w-none lg:!w-[60vw]"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b px-2 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="gap-1.5"
          >
            <ChevronLeft className="size-4" />
            Retour
          </Button>
          <span className="truncate px-2 text-sm font-medium text-muted-foreground">
            {prospect.nom || prospect.entreprise?.entreprise || 'Prospect'}
          </span>
        </div>
        <Tabs
          defaultValue="coordonnees"
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <div className="border-b px-4 sm:px-6 pt-3 pb-2">
            <TabsList>
              <TabsTrigger value="coordonnees">Coordonnées</TabsTrigger>
              <TabsTrigger value="fiche-client">Fiche entreprise</TabsTrigger>
              <TabsTrigger value="activite">Activité</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="coordonnees"
            className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6 py-4"
          >
            <Row
              icon={Users}
              label="Nom"
              source={prospect.fieldSources?.nom}
            >
              <InlineText
                value={prospect.nom}
                onChange={(v) => update('nom', v)}
                placeholder="Nom du prospect"
                displayClassName={INLINE_DISPLAY}
                emptyLabel="Vide"
              />
            </Row>
            <Row
              icon={Users}
              label="Rôle"
              source={prospect.fieldSources?.role}
            >
              <InlineText
                value={prospect.role}
                onChange={(v) => update('role', v)}
                placeholder="Pharmacien titulaire…"
                displayClassName={INLINE_DISPLAY}
                emptyLabel="Vide"
              />
            </Row>
            <Row icon={Building2} label="Entreprise">
              <div className="px-2 py-1 text-sm">
                {prospect.entreprise ? (
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">
                      {prospect.entreprise.entreprise || (
                        <span className="italic text-muted-foreground">
                          Sans nom
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {[prospect.entreprise.ville, prospect.entreprise.siteWeb]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                ) : (
                  <span className="italic text-muted-foreground">
                    Aucune entreprise rattachée
                  </span>
                )}
              </div>
            </Row>
            <Row icon={CircleDot} label="Statut">
              <div className="px-2 py-1">
                <StatusBadge
                  value={prospect.status}
                  onChange={(v) => update('status', v)}
                />
              </div>
            </Row>
            <Row icon={Mail} label="Email" copyValue={prospect.email || null}>
              <InlineText
                type="email"
                value={prospect.email}
                onChange={(v) => update('email', v)}
                placeholder="contact@exemple.com"
                displayClassName={INLINE_DISPLAY}
                emptyLabel="Vide"
              />
            </Row>
            <Row
              icon={Phone}
              label="Téléphone"
              copyValue={prospect.telephone || null}
            >
              <InlineText
                type="tel"
                value={prospect.telephone}
                onChange={(v) => update('telephone', v)}
                placeholder="06 12 34 56 78"
                displayClassName={INLINE_DISPLAY}
                emptyLabel="Vide"
              />
            </Row>
            <Row
              icon={Link2}
              label="LinkedIn"
              copyValue={prospect.linkedin}
              source={prospect.fieldSources?.linkedin}
            >
              <InlineText
                type="url"
                value={prospect.linkedin ?? ''}
                onChange={(v) => update('linkedin', v ? v : null)}
                placeholder="https://linkedin.com/in/…"
                displayClassName={INLINE_DISPLAY}
                emptyLabel="Vide"
              />
            </Row>
            {prospect.entreprise?.signaux &&
              prospect.entreprise.signaux.length > 0 && (
                <Row icon={Target} label="Signaux entreprise">
                  <div className="flex flex-wrap gap-1.5 px-1 py-1">
                    {prospect.entreprise.signaux.map((s, i) => (
                      <SignalBadge key={i}>{s}</SignalBadge>
                    ))}
                  </div>
                </Row>
              )}
          </TabsContent>

          <TabsContent
            value="activite"
            className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 sm:px-6 py-4"
          >
            <div className="bg-muted/30 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
              <div className="flex items-center gap-2">
                <CalendarClock className="text-muted-foreground size-3.5" />
                <span className="text-sm">Prochaine relance</span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={prospect.relanceDate ?? ''}
                  onChange={(e) =>
                    update('relanceDate', e.target.value ? e.target.value : null)
                  }
                  className="h-8 w-fit !text-sm"
                />
                <span className="text-muted-foreground text-[11px]">
                  Auto à J+7 après chaque action
                </span>
              </div>
            </div>
            <CommentComposer onAdd={addComment} />
            {comments.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-xs italic">
                Aucune activité pour le moment.
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
                      updateComment(c.id, text)
                      setEditingCommentId(null)
                    }}
                    onCancel={() => setEditingCommentId(null)}
                    onDelete={() => {
                      deleteComment(c.id)
                      setEditingCommentId(null)
                    }}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent
            value="fiche-client"
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex min-h-0 flex-col">
              <div className="flex shrink-0 items-center px-4 sm:px-6 pt-3 pb-2">
                <span className="text-[11px] text-muted-foreground">
                  Fiche de l'entreprise — partagée avec tous les contacts de
                  cette entreprise.
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6 pb-3">
                {prospect.entreprise?.ficheClient ? (
                  <RichTextEditor
                    value={prospect.entreprise.ficheClient}
                    onChange={() => {}}
                    editable={false}
                  />
                ) : prospect.entreprise ? (
                  <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-muted/20 py-10 text-center text-sm text-muted-foreground">
                    <p>Aucune fiche générée pour cette entreprise.</p>
                    <Button
                      size="sm"
                      onClick={handleRegenerateFiche}
                      disabled={regeneratingFiche}
                      className="gap-1.5"
                    >
                      {regeneratingFiche ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="size-3.5" />
                      )}
                      Générer la fiche
                    </Button>
                  </div>
                ) : (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Pas d'entreprise rattachée — pas de fiche.
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

        </Tabs>

        <div className="shrink-0 space-y-2 border-t px-4 py-3 sm:px-6">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" className="w-full justify-center" />
                }
              >
                <Send className="size-4" />
                Contacter
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[--anchor-width] min-w-64">
                <DropdownMenuItem
                  disabled={!prospect.email}
                  onClick={() => {
                    if (prospect.email)
                      window.open(`mailto:${prospect.email}`, '_blank')
                  }}
                >
                  <Mail className="size-4" />
                  Email
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!prospect.telephone}
                  onClick={() => {
                    if (prospect.telephone)
                      window.open(
                        `tel:${prospect.telephone.replace(/\s/g, '')}`,
                        '_blank',
                      )
                  }}
                >
                  <Phone className="size-4" />
                  Téléphone
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!prospect.linkedin}
                  onClick={() => {
                    if (prospect.linkedin)
                      window.open(prospect.linkedin, '_blank')
                  }}
                >
                  <LinkedinIcon className="size-4" />
                  LinkedIn
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button className="w-full justify-center" />}
              >
                <Plus className="size-4" />
                Enregistrer une action
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[--anchor-width] min-w-64">
                <DropdownMenuItem
                  onClick={() => setActionDialog('message_sent')}
                >
                  <Send className="size-4" />
                  Message envoyé
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setActionDialog('message_received')}
                >
                  <MessageSquare className="size-4" />
                  Message reçu
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setActionDialog('meeting')}
                >
                  <Handshake className="size-4" />
                  RDV pris
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActionDialog('won')}>
                  <CheckCircle2 className="size-4" />
                  Client gagné
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            className="text-muted-foreground hover:text-destructive w-full justify-center"
          >
            <Trash2 className="size-4" />
            Supprimer le prospect
          </Button>
        </div>
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Supprimer {prospect.nom || 'ce prospect'}&nbsp;?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={confirmDelete}
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <ActionDialog
          open={actionDialog}
          onOpenChange={setActionDialog}
          onSubmit={async (payload) => {
            await logAction(
              prospect.id,
              payload.kind,
              payload.metadata,
              payload.at,
            )
          }}
        />
      </SheetContent>
    </Sheet>
  )
}
