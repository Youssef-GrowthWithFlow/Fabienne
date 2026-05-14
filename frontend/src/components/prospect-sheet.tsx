import {
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleDot,
  Globe,
  Handshake,
  Link2,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  Send,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useProspects } from '@/hooks/use-prospects'
import { useSegments } from '@/hooks/use-segments'
import { cn } from '@/lib/utils'
import {
  STATUS_RANK,
  STATUSES,
  formatDate,
  newId,
  sortComments,
  statusVariant,
  todayIso,
  type Comment,
  type Prospect,
  type ProspectStatus,
} from '@/lib/prospects'

const MESSAGE_CHANNELS = ['LinkedIn', 'Email', 'Téléphone', 'SMS', 'Autre'] as const
type MessageChannel = (typeof MESSAGE_CHANNELS)[number]


type InlineProps = {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: 'text' | 'email' | 'tel' | 'url'
  className?: string
  displayClassName?: string
}

function InlineText({
  value,
  onChange,
  placeholder,
  type = 'text',
  className,
  displayClassName,
}: InlineProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function commit() {
    if (draft !== value) onChange(draft)
    setEditing(false)
  }

  if (editing) {
    return (
      <Input
        autoFocus
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          else if (e.key === 'Escape') setEditing(false)
        }}
        className={cn('h-8 !text-sm', className)}
        placeholder={placeholder}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value)
        setEditing(true)
      }}
      className={cn(
        'hover:bg-muted/50 block w-full rounded px-2.5 py-1 text-left text-sm',
        !value && 'text-muted-foreground italic',
        displayClassName,
      )}
    >
      {value || placeholder || 'Vide'}
    </button>
  )
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: ReactNode
}) {
  return (
    <div className="group flex flex-col gap-0 rounded-md py-1.5 sm:flex-row sm:items-start sm:gap-2 sm:py-0.5">
      <div className="text-muted-foreground flex shrink-0 items-center gap-2 px-2 py-1 text-xs sm:w-32 sm:py-1.5 sm:text-sm">
        <Icon className="size-3.5" />
        <span>{label}</span>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}


function SegmentSelector({
  value,
  onChange,
}: {
  value: Prospect['segment']
  onChange: (v: Prospect['segment']) => void
}) {
  const { segments, briefs } = useSegments()
  const label = (id: string) => briefs[id]?.nom ?? id
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-2 py-1">
      {segments.map((s) => {
        const active = value === s
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(active ? null : s)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
              active
                ? 'bg-violet-100 text-violet-900 dark:bg-violet-900/30 dark:text-violet-200'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground border border-dashed',
            )}
          >
            <CircleDot className="size-2.5" />
            {label(s)}
          </button>
        )
      })}
    </div>
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


function QuickAction({
  icon: Icon,
  label,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  href: string | null
}) {
  const base =
    'inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors'
  if (!href) {
    return (
      <span
        aria-disabled
        title={`${label} indisponible`}
        aria-label={label}
        className={cn(base, 'text-muted-foreground/50 cursor-not-allowed')}
      >
        <Icon className="size-4" />
        <span className="hidden sm:inline">{label}</span>
      </span>
    )
  }
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noreferrer' : undefined}
      title={label}
      aria-label={label}
      className={cn(base, 'text-foreground hover:bg-muted')}
    >
      <Icon className="size-4" />
      <span className="hidden sm:inline">{label}</span>
    </a>
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

function CommentCard({
  comment,
  editing,
  onStartEdit,
  onSave,
  onCancel,
  onDelete,
}: {
  comment: Comment
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

  return (
    <div className="py-2.5 first:pt-0">
      <div className="text-muted-foreground mb-0.5 text-xs tabular-nums">
        {formatDate(comment.date)}
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


function MessageSentDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onSubmit: (channel: MessageChannel, texte: string) => void
}) {
  const [channel, setChannel] = useState<MessageChannel>('LinkedIn')
  const [texte, setTexte] = useState('')

  useEffect(() => {
    if (open) {
      setChannel('LinkedIn')
      setTexte('')
    }
  }, [open])

  const canSubmit = texte.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Message envoyé</DialogTitle>
          <DialogDescription>
            Sur quel canal et quel était le message ?
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-xs">Canal</span>
            <div className="flex flex-wrap gap-1.5">
              {MESSAGE_CHANNELS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setChannel(c)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    channel === c
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-input text-muted-foreground hover:bg-muted',
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-xs">
              Description (une ligne)
            </span>
            <Input
              autoFocus
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              placeholder="Ex. prise de contact, proposition de démo…"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSubmit) {
                  e.preventDefault()
                  onSubmit(channel, texte.trim())
                }
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            disabled={!canSubmit}
            onClick={() => onSubmit(channel, texte.trim())}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const { deleteProspect } = useProspects()
  const [editingFiche, setEditingFiche] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [messageOpen, setMessageOpen] = useState(false)

  useEffect(() => {
    setEditingFiche(false)
    setEditingCommentId(null)
  }, [prospect.id])

  const update = <K extends keyof Prospect>(key: K, value: Prospect[K]) => {
    onChange({ ...prospect, [key]: value })
  }

  const addComment = (texte: string) => {
    const next: Comment = {
      id: newId('c'),
      date: new Date().toISOString(),
      texte,
    }
    update('comments', [next, ...prospect.comments])
  }

  const updateComment = (id: string, texte: string) => {
    update(
      'comments',
      prospect.comments.map((c) => (c.id === id ? { ...c, texte } : c)),
    )
  }

  const deleteComment = (id: string) => {
    update(
      'comments',
      prospect.comments.filter((c) => c.id !== id),
    )
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

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="flex !w-full flex-col gap-0 p-0 sm:!max-w-none lg:!w-[60vw]"
      >
        {/* Top bar mobile : retour */}
        <div className="flex shrink-0 items-center border-b px-2 py-2 sm:hidden">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ChevronLeft className="size-4" />
            Retour
          </Button>
        </div>

        {/* Tabs */}
        <Tabs
          defaultValue="coordonnees"
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <div className="border-b px-4 sm:px-6 pt-4 pr-14 pb-2">
            <TabsList>
              <TabsTrigger value="coordonnees">Coordonnées</TabsTrigger>
              <TabsTrigger value="fiche-client">Fiche client</TabsTrigger>
              <TabsTrigger value="activite">Activité</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="coordonnees"
            className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6 py-4"
          >
            <Row icon={Users} label="Nom">
              <InlineText
                value={prospect.nom}
                onChange={(v) => update('nom', v)}
                placeholder="Nom du prospect"
              />
            </Row>
            <Row icon={Users} label="Entreprise">
              <InlineText
                value={prospect.entreprise}
                onChange={(v) => update('entreprise', v)}
                placeholder="Nom de l'entreprise"
              />
            </Row>
            <Row icon={Users} label="Rôle">
              <InlineText
                value={prospect.role}
                onChange={(v) => update('role', v)}
                placeholder="Pharmacien titulaire…"
              />
            </Row>
            <Row icon={CircleDot} label="Segment">
              <SegmentSelector
                value={prospect.segment}
                onChange={(v) => update('segment', v)}
              />
            </Row>
            <Row icon={CircleDot} label="Statut">
              <div className="px-2 py-1">
                <StatusBadge
                  value={prospect.status}
                  onChange={(v) => update('status', v)}
                />
              </div>
            </Row>
            <Row icon={CalendarClock} label="Relance">
              <div className="px-2 py-1">
                <Input
                  type="date"
                  value={prospect.relanceDate ?? ''}
                  onChange={(e) =>
                    update('relanceDate', e.target.value ? e.target.value : null)
                  }
                  className="h-8 w-fit !text-sm"
                />
              </div>
            </Row>
            <Row icon={Mail} label="Email">
              <InlineText
                type="email"
                value={prospect.email}
                onChange={(v) => update('email', v)}
                placeholder="contact@exemple.com"
              />
            </Row>
            <Row icon={Phone} label="Téléphone">
              <InlineText
                type="tel"
                value={prospect.telephone}
                onChange={(v) => update('telephone', v)}
                placeholder="06 12 34 56 78"
              />
            </Row>
            <Row icon={Link2} label="LinkedIn">
              <InlineText
                type="url"
                value={prospect.linkedin ?? ''}
                onChange={(v) => update('linkedin', v ? v : null)}
                placeholder="https://linkedin.com/in/…"
              />
            </Row>
            <Row icon={Globe} label="Site web">
              <InlineText
                type="url"
                value={prospect.website ?? ''}
                onChange={(v) => update('website', v ? v : null)}
                placeholder="https://exemple.com"
              />
            </Row>
          </TabsContent>

          <TabsContent
            value="fiche-client"
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex shrink-0 items-center gap-1.5 px-4 sm:px-6 pt-3 pb-2">
              {editingFiche ? (
                <Button
                  onClick={() => setEditingFiche(false)}
                  className="ml-auto sm:ml-0 sm:h-7 sm:text-[0.8rem]"
                >
                  <Check className="size-3.5" />
                  Terminé
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setEditingFiche(true)}
                  className="ml-auto sm:ml-0 sm:h-7 sm:text-[0.8rem]"
                >
                  <Pencil className="size-3.5" />
                  Modifier
                </Button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6 pb-3">
              <RichTextEditor
                value={prospect.ficheClient}
                onChange={(html) => update('ficheClient', html)}
                editable={editingFiche}
              />
            </div>
          </TabsContent>

          <TabsContent
            value="activite"
            className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 sm:px-6 py-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground text-xs">Statut</span>
              <StatusBadge
                value={prospect.status}
                onChange={(v) => update('status', v)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-muted-foreground text-xs">
                Enregistrer une action
              </span>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMessageOpen(true)}
                >
                  <Send className="size-3.5" />
                  Message envoyé
                </Button>
                {(
                  [
                    {
                      icon: MessageSquare,
                      label: 'Réponse reçue',
                      status: 'Répondu',
                    },
                    {
                      icon: Handshake,
                      label: 'RDV pris',
                      status: 'RDV',
                    },
                    {
                      icon: CheckCircle2,
                      label: 'Client gagné',
                      status: 'Client',
                    },
                  ] as const
                ).map((a) => (
                  <Button
                    key={a.label}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      addComment(a.label)
                      const nextRank = STATUS_RANK[a.status]
                      const curRank = STATUS_RANK[prospect.status]
                      if (nextRank > curRank) {
                        onChange({ ...prospect, status: a.status })
                      }
                    }}
                  >
                    <a.icon className="size-3.5" />
                    {a.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <CalendarClock className="size-3.5" />
                Prochaine relance
              </span>
              <Input
                type="date"
                value={prospect.relanceDate ?? ''}
                onChange={(e) =>
                  update('relanceDate', e.target.value ? e.target.value : null)
                }
                className="h-8 w-fit !text-sm"
              />
            </div>

            <CommentComposer onAdd={addComment} />
            {comments.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-xs italic">
                Aucun commentaire pour le moment.
              </p>
            ) : (
              <div className="divide-border divide-y">
                {comments.map((c) => (
                  <CommentCard
                    key={c.id}
                    comment={c}
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
        </Tabs>

        {/* Footer : quick actions + delete */}
        <div
          className={cn(
            'shrink-0 space-y-2 border-t px-4 py-3 sm:px-6',
            editingFiche && 'hidden sm:block',
          )}
        >
          <div className="flex items-center gap-2">
            <QuickAction
              icon={Phone}
              label="Appeler"
              href={
                prospect.telephone
                  ? `tel:${prospect.telephone.replace(/\s/g, '')}`
                  : null
              }
            />
            <QuickAction
              icon={Mail}
              label="Email"
              href={prospect.email ? `mailto:${prospect.email}` : null}
            />
            <QuickAction
              icon={LinkedinIcon}
              label="LinkedIn"
              href={prospect.linkedin}
            />
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
        <MessageSentDialog
          open={messageOpen}
          onOpenChange={setMessageOpen}
          onSubmit={(channel, texte) => {
            addComment(`Message ${channel} — ${texte}`)
            const patch: Partial<Prospect> = {}
            if (STATUS_RANK[prospect.status] < STATUS_RANK['Contacté']) {
              patch.status = 'Contacté'
            }
            if (!prospect.contactedAt) {
              patch.contactedAt = todayIso()
            }
            if (Object.keys(patch).length > 0) {
              onChange({ ...prospect, ...patch })
            }
            setMessageOpen(false)
          }}
        />
      </SheetContent>
    </Sheet>
  )
}
