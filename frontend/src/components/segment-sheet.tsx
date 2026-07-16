import { Check, ChevronLeft, Pencil, Trash2, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'

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
import { Button } from '@/components/ui/button'
import { FormRow } from '@/components/form-row'
import { InlineText } from '@/components/inline-text'
import { Input } from '@/components/ui/input'
import { RichTextEditor } from '@/components/rich-text-editor'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { TagsField } from '@/components/tags-field'
import { useSegments } from '@/hooks/use-segments'
import type { Segment } from '@/lib/prospects'
import {
  DATA_SOURCE_OPTIONS,
  type AISource,
  type SegmentBrief,
} from '@/lib/segments'

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
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Notes libres</span>
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
    </div>
  )
}

/** Section = plain-French question + one line saying why it matters. */
function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-4 border-t pt-6 first:border-t-0 first:pt-0">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        {hint ? (
          <p className="text-muted-foreground mt-0.5 text-sm">{hint}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

function AISourcesField({
  values,
  onChange,
}: {
  values: AISource[]
  onChange: (next: AISource[]) => void
}) {
  function update(index: number, patch: Partial<AISource>) {
    onChange(values.map((v, i) => (i === index ? { ...v, ...patch } : v)))
  }
  function remove(index: number) {
    onChange(values.filter((_, i) => i !== index))
  }
  function add() {
    onChange([...values, { url: '', description: '' }])
  }
  function pruneEmptyOnBlur() {
    const cleaned = values.filter(
      (v) => v.url.trim().length > 0 || v.description.trim().length > 0,
    )
    if (cleaned.length !== values.length) onChange(cleaned)
  }

  return (
    <div className="flex flex-col gap-2">
      {values.map((src, i) => (
        <div key={i} className="flex items-start gap-2">
          <Input
            value={src.url}
            placeholder="https://…"
            onChange={(e) => update(i, { url: e.target.value })}
            onBlur={pruneEmptyOnBlur}
            className="flex-1"
          />
          <Input
            value={src.description}
            placeholder="C'est quoi ce site ?"
            onChange={(e) => update(i, { description: e.target.value })}
            onBlur={pruneEmptyOnBlur}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => remove(i)}
            aria-label="Retirer cette source"
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={add}
      >
        + Ajouter un site
      </Button>
    </div>
  )
}

function DataSourcesField({
  values,
  onChange,
}: {
  values: string[]
  onChange: (next: string[]) => void
}) {
  function toggle(value: string, checked: boolean) {
    if (checked) {
      if (values.includes(value)) return
      onChange([...values, value])
    } else {
      onChange(values.filter((v) => v !== value))
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {DATA_SOURCE_OPTIONS.map((opt) => {
        const checked = values.includes(opt.value)
        return (
          <label
            key={opt.value}
            className="flex cursor-pointer items-start gap-3 rounded-md border bg-card p-3 hover:bg-muted/40"
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => toggle(opt.value, e.target.checked)}
              className="mt-0.5 size-4 cursor-pointer accent-foreground"
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{opt.label}</div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {opt.description}
              </p>
            </div>
          </label>
        )
      })}
    </div>
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
            {brief.nom || segment}
          </span>
        </div>

        {/* One scrollable form — nothing behind tabs, each section is a plain
            question with a hint explaining what the AI does with it. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-10">
          <div className="flex flex-col gap-8">
            <Section
              title="Ce segment"
              hint="Un segment = un type de client que tu vises. Tout ce que tu remplis ici guide la recherche de prospects."
            >
              <FormRow label="Nom">
                <InlineText
                  value={brief.nom}
                  onChange={(v) => set('nom', v)}
                  placeholder={segment}
                />
              </FormRow>
              <FormRow label="Description">
                <InlineText
                  value={brief.description}
                  onChange={(v) => set('description', v)}
                  placeholder="En une phrase : qui c'est, et pourquoi c'est intéressant pour toi."
                  multiline
                />
              </FormRow>
            </Section>

            <Section
              title="Qui veux-tu viser ?"
              hint="C'est le portrait-robot : l'IA cherche des établissements qui ressemblent à ça."
            >
              <FormRow label="Leur métier / rôle">
                <TagsField
                  values={brief.postes}
                  onChange={(v) => set('postes', v)}
                  placeholder="Ex : Pharmacien titulaire"
                />
              </FormRow>
              <FormRow label="Taille de la structure">
                <InlineText
                  value={brief.tailleStructure}
                  onChange={(v) => set('tailleStructure', v)}
                  placeholder="Ex : 2 à 5 salariés"
                />
              </FormRow>
              <FormRow label="Type d'activité">
                <TagsField
                  values={brief.activiteCiblee}
                  onChange={(v) => set('activiteCiblee', v)}
                  placeholder="Ex : Officine indépendante"
                />
              </FormRow>
              <FormRow label="Où ?">
                <TagsField
                  values={brief.zoneGeographique}
                  onChange={(v) => set('zoneGeographique', v)}
                  placeholder="Ex : Agglomération toulousaine"
                />
              </FormRow>
            </Section>

            <Section
              title="À quoi reconnaît-on un bon prospect ?"
              hint="L'IA privilégie ceux qui montrent ces signes, et écarte ceux qui montrent les mauvais."
            >
              <FormRow label="Les signes qui donnent envie">
                <TagsField
                  values={brief.mustHave}
                  onChange={(v) => set('mustHave', v)}
                  placeholder="Ex : Reprise récente de l'officine"
                />
              </FormRow>
              <FormRow label="Un plus, sans être obligatoire">
                <TagsField
                  values={brief.shouldHave}
                  onChange={(v) => set('shouldHave', v)}
                  placeholder="Ex : Présent sur les réseaux"
                />
              </FormRow>
              <FormRow label="À éviter absolument">
                <TagsField
                  values={brief.redFlags}
                  onChange={(v) => set('redFlags', v)}
                  placeholder="Ex : Grande chaîne nationale"
                />
              </FormRow>
              <FormRow label="Leurs problèmes du quotidien">
                <TagsField
                  values={brief.painPoints}
                  onChange={(v) => set('painPoints', v)}
                  placeholder="Ex : Manque de temps pour recruter"
                />
              </FormRow>
            </Section>

            <Section
              title="Où l'IA doit chercher"
              hint="Donne-lui tes meilleurs annuaires et sites : elle s'en sert pour trouver et vérifier les prospects."
            >
              <FormRow label="Sites web de confiance">
                <AISourcesField
                  values={brief.aiSources}
                  onChange={(v) => set('aiSources', v)}
                />
              </FormRow>
              <FormRow label="Annuaires officiels">
                <DataSourcesField
                  values={brief.dataSources}
                  onChange={(v) => set('dataSources', v)}
                />
              </FormRow>
              <FormRow label="Autres pistes (pour toi)">
                <TagsField
                  values={brief.sources}
                  onChange={(v) => set('sources', v)}
                  placeholder="Ex : LinkedIn, salon professionnel…"
                />
              </FormRow>
            </Section>

            <Section
              title="Ton offre pour eux"
              hint="Sert à préparer les fiches et tes messages : ce que tu leur apportes, avec quelles preuves."
            >
              <FormRow label="En une phrase">
                <InlineText
                  value={brief.pitch}
                  onChange={(v) => set('pitch', v)}
                  placeholder="Ce qu'on leur apporte, sans jargon"
                  multiline
                />
              </FormRow>
              <FormRow label="Bénéfices concrets">
                <TagsField
                  values={brief.benefices}
                  onChange={(v) => set('benefices', v)}
                  placeholder="Un bénéfice concret"
                />
              </FormRow>
              <FormRow label="Preuves">
                <TagsField
                  values={brief.preuves}
                  onChange={(v) => set('preuves', v)}
                  placeholder="Chiffre, cas client, logo"
                />
              </FormRow>
              <NotesSection
                value={brief.notes}
                onChange={(html) => set('notes', html)}
                placeholder="Écris tout ce qui peut décrire ton offre…"
              />
            </Section>
          </div>
        </div>

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
