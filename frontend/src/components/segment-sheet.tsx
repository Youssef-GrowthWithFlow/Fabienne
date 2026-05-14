import { Check, ChevronLeft, Pencil, Trash2, X } from 'lucide-react'
import { useState, type KeyboardEvent, type ReactNode } from 'react'

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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/components/rich-text-editor'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useSegments } from '@/hooks/use-segments'
import { cn } from '@/lib/utils'
import type { Segment } from '@/lib/prospects'
import { type SegmentBrief } from '@/lib/segments'

type InlineTextProps = {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
  className?: string
  displayClassName?: string
}

function InlineText({
  value,
  onChange,
  placeholder,
  multiline = false,
  className,
  displayClassName,
}: InlineTextProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function commit() {
    if (draft !== value) onChange(draft)
    setEditing(false)
  }

  if (editing) {
    if (multiline) {
      return (
        <Textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(false)
          }}
          rows={3}
          className={cn('resize-y text-sm', className)}
          placeholder={placeholder}
        />
      )
    }
    return (
      <Input
        autoFocus
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
        'rounded-sm text-left text-sm hover:bg-muted/60',
        !value && 'italic text-muted-foreground',
        displayClassName,
      )}
    >
      {value || placeholder || 'Ajouter…'}
    </button>
  )
}

type TagsFieldProps = {
  values: string[]
  onChange: (next: string[]) => void
  placeholder?: string
}

function TagsField({ values, onChange, placeholder }: TagsFieldProps) {
  const [draft, setDraft] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState('')

  function add() {
    const v = draft.trim()
    if (!v) return
    if (values.includes(v)) {
      setDraft('')
      return
    }
    onChange([...values, v])
    setDraft('')
  }

  function remove(index: number) {
    onChange(values.filter((_, i) => i !== index))
  }

  function startEdit(index: number) {
    setEditingIndex(index)
    setEditDraft(values[index])
  }

  function commitEdit() {
    if (editingIndex === null) return
    const v = editDraft.trim()
    const idx = editingIndex
    setEditingIndex(null)
    if (!v) {
      onChange(values.filter((_, i) => i !== idx))
      return
    }
    if (v === values[idx]) return
    if (values.some((t, i) => i !== idx && t === v)) {
      onChange(values.filter((_, i) => i !== idx))
      return
    }
    onChange(values.map((t, i) => (i === idx ? v : t)))
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add()
    } else if (e.key === 'Backspace' && draft === '' && values.length > 0) {
      onChange(values.slice(0, -1))
    }
  }

  function onEditKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setEditingIndex(null)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {values.map((tag, index) =>
        editingIndex === index ? (
          <Input
            key={index}
            autoFocus
            value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={onEditKeyDown}
            onFocus={(e) => e.currentTarget.select()}
            className="h-7 w-auto min-w-[8rem] text-sm"
          />
        ) : (
          <Badge
            key={index}
            variant="secondary"
            className="h-auto max-w-full items-start gap-1 whitespace-normal break-words py-1 font-normal leading-snug"
          >
            <button
              type="button"
              onClick={() => startEdit(index)}
              className="cursor-text rounded-sm text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label={`Modifier ${tag}`}
            >
              {tag}
            </button>
            <button
              type="button"
              onClick={() => remove(index)}
              className="-mr-1 mt-0.5 shrink-0 rounded-sm p-0.5 hover:bg-muted-foreground/20"
              aria-label={`Retirer ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ),
      )}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={add}
        placeholder={placeholder ?? 'Ajouter…'}
        className="h-7 w-auto min-w-[10rem] flex-1 text-sm"
      />
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}

function NotesSection({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (html: string) => void
  placeholder: string
}) {
  const [editing, setEditing] = useState(false)
  const isEmpty = !value.replace(/<[^>]*>/g, '').trim()
  const effectiveEditing = editing || isEmpty
  return (
    <section className="flex flex-col gap-3 border-t pt-5">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Notes libres</h3>
        {isEmpty ? null : effectiveEditing ? (
          <Button
            size="sm"
            onClick={() => setEditing(false)}
            className="ml-auto h-7 text-[0.8rem]"
          >
            <Check className="size-3.5" />
            Terminé
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditing(true)}
            className="ml-auto h-7 text-[0.8rem]"
          >
            <Pencil className="size-3.5" />
            Modifier
          </Button>
        )}
      </div>
      <RichTextEditor
        value={value}
        onChange={onChange}
        editable={effectiveEditing}
        placeholder={placeholder}
      />
    </section>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-4 border-t pt-5 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

type Props = {
  segment: Segment | null
  onClose: () => void
}

export function SegmentSheet({ segment, onClose }: Props) {
  const { getBrief, updateBrief, deleteSegment } = useSegments()
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (!segment) return null

  const brief = getBrief(segment)

  function set<K extends keyof SegmentBrief>(key: K, value: SegmentBrief[K]) {
    if (!segment) return
    updateBrief(segment, { ...brief, [key]: value })
  }

  function confirmDelete() {
    if (!segment) return
    setConfirmOpen(false)
    deleteSegment(segment)
    onClose()
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="flex !w-full flex-col gap-0 p-0 sm:!max-w-none lg:!w-[60vw]"
      >
        <div className="flex shrink-0 items-center border-b px-2 py-2 sm:hidden">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ChevronLeft className="size-4" />
            Retour
          </Button>
        </div>

        <Tabs
          defaultValue="cible"
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <div className="border-b px-6 sm:px-10 pt-4 pr-14 pb-2">
            <TabsList>
              <TabsTrigger value="cible">Cible</TabsTrigger>
              <TabsTrigger value="offre">Offre</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="cible"
            className="min-h-0 flex-1 overflow-y-auto px-6 sm:px-10 py-6"
          >
            <div className="flex flex-col gap-6">
              <Section title="Identité">
                <Row label="Nom">
                  <InlineText
                    value={brief.nom}
                    onChange={(v) => set('nom', v)}
                    placeholder={segment}
                  />
                </Row>
                <Row label="Description">
                  <InlineText
                    value={brief.description}
                    onChange={(v) => set('description', v)}
                    placeholder="Ajouter une description"
                    multiline
                  />
                </Row>
              </Section>

              <Section title="À qui on parle">
                <Row label="Intitulé de poste">
                  <TagsField
                    values={brief.postes}
                    onChange={(v) => set('postes', v)}
                    placeholder="Ex : Pharmacien titulaire"
                  />
                </Row>
                <Row label="Taille">
                  <InlineText
                    value={brief.tailleStructure}
                    onChange={(v) => set('tailleStructure', v)}
                    placeholder="Ex : 2 à 5 salariés"
                  />
                </Row>
                <Row label="Secteur & zone">
                  <InlineText
                    value={brief.sousSecteur}
                    onChange={(v) => set('sousSecteur', v)}
                    placeholder="Ex : Officines de quartier en France"
                  />
                </Row>
              </Section>

              <Section title="Le bon moment">
                <Row label="Signaux">
                  <TagsField
                    values={brief.triggers}
                    onChange={(v) => set('triggers', v)}
                    placeholder="Ex : Vient de prendre son poste"
                  />
                </Row>
              </Section>

              <Section title="Ce qui leur pose problème">
                <Row label="Problèmes">
                  <TagsField
                    values={brief.painPoints}
                    onChange={(v) => set('painPoints', v)}
                  />
                </Row>
              </Section>

              <Section title="On y va, ou pas">
                <Row label="Indispensable">
                  <TagsField
                    values={brief.mustHave}
                    onChange={(v) => set('mustHave', v)}
                  />
                </Row>
                <Row label="Un plus">
                  <TagsField
                    values={brief.niceToHave}
                    onChange={(v) => set('niceToHave', v)}
                  />
                </Row>
                <Row label="Alertes">
                  <TagsField
                    values={brief.redFlags}
                    onChange={(v) => set('redFlags', v)}
                  />
                </Row>
              </Section>

              <Section title="Pistes pour chercher">
                <Row label="Sources utiles">
                  <TagsField
                    values={brief.sources}
                    onChange={(v) => set('sources', v)}
                    placeholder="Ex : LinkedIn Sales Navigator"
                  />
                </Row>
              </Section>
            </div>
          </TabsContent>

          <TabsContent
            value="offre"
            className="min-h-0 flex-1 overflow-y-auto px-6 sm:px-10 py-6"
          >
            <div className="flex flex-col gap-6">
              <Section title="Notre promesse">
                <Row label="En une phrase">
                  <InlineText
                    value={brief.pitch}
                    onChange={(v) => set('pitch', v)}
                    placeholder="Ce qu’on leur apporte, sans jargon"
                    multiline
                  />
                </Row>
              </Section>

              <Section title="Pourquoi ça marche">
                <Row label="Bénéfices">
                  <TagsField
                    values={brief.benefices}
                    onChange={(v) => set('benefices', v)}
                    placeholder="Un bénéfice concret"
                  />
                </Row>
                <Row label="Preuves">
                  <TagsField
                    values={brief.preuves}
                    onChange={(v) => set('preuves', v)}
                    placeholder="Chiffre, cas client, logo"
                  />
                </Row>
              </Section>

              <NotesSection
                value={brief.notes}
                onChange={(html) => set('notes', html)}
                placeholder="Écris tout ce qui peut décrire ton offre…"
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex shrink-0 flex-col gap-2 border-t px-6 sm:px-10 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            className="text-muted-foreground hover:text-destructive w-full justify-center"
          >
            <Trash2 className="size-4" />
            Supprimer le segment
          </Button>
        </div>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Supprimer {brief.nom || 'ce segment'}&nbsp;?
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
      </SheetContent>
    </Sheet>
  )
}
