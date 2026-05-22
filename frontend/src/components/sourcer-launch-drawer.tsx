import { Check, Loader2, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { TagsField } from '@/components/tags-field'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { useSegments } from '@/hooks/use-segments'
import { useSourcerHistory } from '@/hooks/use-sourcer-history'
import { SEGMENT_NONE } from '@/lib/segment-constants'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Step = 1 | 2

const STEP_META: Record<Step, { title: string; description: string }> = {
  1: {
    title: 'Trouver de nouveaux leads',
    description:
      'Choisis le segment et combien tu en veux. Compte 1 à 2 minutes : je fouille pour de vrai.',
  },
  2: {
    title: 'Tes critères',
    description:
      'Affine la recherche pour cette session. Une fois lancé, ça prend 1 à 2 minutes.',
  },
}

const DEFAULT_COUNT = 3

export function SourcerLaunchDrawer({ open, onOpenChange }: Props) {
  const { segments, briefs } = useSegments()
  const { generate, generating } = useSourcerHistory()

  const [step, setStep] = useState<Step>(1)

  // Étape 1
  const [segmentId, setSegmentId] = useState<string>(SEGMENT_NONE)
  const [count, setCount] = useState(DEFAULT_COUNT)

  // Étape 2 — obligatoires (sauf instruction libre)
  const [postes, setPostes] = useState<string[]>([])
  const [taille, setTaille] = useState('')
  const [activite, setActivite] = useState<string[]>([])
  const [zone, setZone] = useState<string[]>([])
  const [signaux, setSignaux] = useState<string[]>([])
  const [instruction, setInstruction] = useState('')

  // Reset à l'ouverture
  useEffect(() => {
    if (open) {
      setStep(1)
      setSegmentId(SEGMENT_NONE)
      setCount(DEFAULT_COUNT)
      setPostes([])
      setTaille('')
      setActivite([])
      setZone([])
      setSignaux([])
      setInstruction('')
    }
  }, [open])

  // Pré-remplissage des critères quand le segment change
  useEffect(() => {
    if (segmentId === SEGMENT_NONE) {
      setPostes([])
      setTaille('')
      setActivite([])
      setZone([])
      setSignaux([])
      return
    }
    const b = briefs[segmentId]
    if (!b) return
    setPostes([...(b.postes ?? [])])
    setTaille(b.tailleStructure ?? '')
    setActivite([...(b.activiteCiblee ?? [])])
    setZone([...(b.zoneGeographique ?? [])])
    setSignaux([...(b.mustHave ?? [])])
  }, [segmentId, briefs])

  const hasSegment = segmentId !== SEGMENT_NONE
  const effectiveSegmentId = hasSegment ? segmentId : ''

  const finalInstruction = useMemo(() => {
    const overrides: string[] = []
    if (postes.length > 0) overrides.push(`Poste cible : ${postes.join(', ')}`)
    if (taille) overrides.push(`Taille : ${taille}`)
    if (activite.length > 0) overrides.push(`Activité ciblée : ${activite.join(', ')}`)
    if (zone.length > 0) overrides.push(`Zone géographique : ${zone.join(', ')}`)
    if (signaux.length > 0) overrides.push(`Signaux : ${signaux.join(', ')}`)
    const libre = instruction.trim()
    return [overrides.join(' — '), libre].filter(Boolean).join('. ')
  }, [postes, taille, activite, zone, signaux, instruction])

  const step2Valid =
    postes.length > 0 &&
    taille.trim() !== '' &&
    activite.length > 0 &&
    zone.length > 0 &&
    signaux.length > 0

  const meta = STEP_META[step]

  function handleLaunch() {
    if (!step2Valid || generating) return
    void generate({
      segmentId: effectiveSegmentId || null,
      count,
      instruction: finalInstruction,
    })
    onOpenChange(false)
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[80vh] max-h-[640px]">
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col overflow-hidden">
          <DrawerHeader>
            <DrawerTitle>{meta.title}</DrawerTitle>
            <DrawerDescription>{meta.description}</DrawerDescription>
            <StepDots current={step} />
          </DrawerHeader>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-2">
            {step === 1 ? (
              <Step1
                segmentId={segmentId}
                onSegmentIdChange={setSegmentId}
                segments={segments}
                briefs={briefs}
                count={count}
                onCountChange={setCount}
              />
            ) : (
              <Step2
                postes={postes}
                onPostesChange={setPostes}
                taille={taille}
                onTailleChange={setTaille}
                activite={activite}
                onActiviteChange={setActivite}
                zone={zone}
                onZoneChange={setZone}
                signaux={signaux}
                onSignauxChange={setSignaux}
                instruction={instruction}
                onInstructionChange={setInstruction}
              />
            )}
          </div>

          <DrawerFooter className="flex-row justify-between">
            {step === 1 ? (
              <DrawerClose asChild>
                <Button type="button" variant="ghost">
                  Annuler
                </Button>
              </DrawerClose>
            ) : (
              <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                Précédent
              </Button>
            )}
            {step === 1 ? (
              <Button type="button" onClick={() => setStep(2)}>
                Suivant
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleLaunch}
                disabled={!step2Valid || generating}
                className="gap-1.5"
              >
                {generating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                {generating ? 'En cours… (1-2 min)' : 'C’est parti'}
              </Button>
            )}
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

// ---------------------------------------------------------------------------
// Step indicator (2 dots)
// ---------------------------------------------------------------------------

function StepDots({ current }: { current: Step }) {
  return (
    <div className="mx-auto mt-2 flex w-16 items-center gap-1.5">
      {[1, 2].map((s) => (
        <span
          key={s}
          className={cn(
            'h-1 flex-1 rounded-full transition-colors',
            s <= current ? 'bg-primary' : 'bg-muted',
          )}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Row helper (label + content), pour cohérence avec segment-sheet
// ---------------------------------------------------------------------------

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

function SegmentRow({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors',
        selected
          ? 'border-primary/40 bg-primary/[0.04]'
          : 'border-border hover:bg-muted/40',
      )}
    >
      <span className={cn('truncate', selected && 'font-medium')}>{label}</span>
      {selected && <Check className="size-4 shrink-0 text-primary" />}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Step 1 — Segment + count
// ---------------------------------------------------------------------------

function Step1({
  segmentId,
  onSegmentIdChange,
  segments,
  briefs,
  count,
  onCountChange,
}: {
  segmentId: string
  onSegmentIdChange: (v: string) => void
  segments: string[]
  briefs: Record<string, { nom: string }>
  count: number
  onCountChange: (n: number) => void
}) {
  return (
    <>
      <Row label="Segment">
        <div className="flex flex-col gap-1">
          <SegmentRow
            label="Aucun (recherche libre)"
            selected={segmentId === SEGMENT_NONE}
            onClick={() => onSegmentIdChange(SEGMENT_NONE)}
          />
          {segments.map((s) => (
            <SegmentRow
              key={s}
              label={briefs[s]?.nom || s}
              selected={segmentId === s}
              onClick={() => onSegmentIdChange(s)}
            />
          ))}
        </div>
      </Row>

      <Row label="Nombre de leads">
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-end font-mono text-sm tabular-nums">
            {count}
          </div>
          <Slider
            value={[count]}
            onValueChange={(v) => {
              const n = Array.isArray(v) ? v[0] : v
              if (typeof n === 'number') onCountChange(n)
            }}
            min={1}
            max={10}
            step={1}
          />
        </div>
      </Row>
    </>
  )
}

// ---------------------------------------------------------------------------
// Step 2 — Critères (obligatoires) + instruction libre
// ---------------------------------------------------------------------------

function Step2({
  postes,
  onPostesChange,
  taille,
  onTailleChange,
  activite,
  onActiviteChange,
  zone,
  onZoneChange,
  signaux,
  onSignauxChange,
  instruction,
  onInstructionChange,
}: {
  postes: string[]
  onPostesChange: (v: string[]) => void
  taille: string
  onTailleChange: (v: string) => void
  activite: string[]
  onActiviteChange: (v: string[]) => void
  zone: string[]
  onZoneChange: (v: string[]) => void
  signaux: string[]
  onSignauxChange: (v: string[]) => void
  instruction: string
  onInstructionChange: (v: string) => void
}) {
  return (
    <>
      <Row label="Intitulé de poste">
        <TagsField
          values={postes}
          onChange={onPostesChange}
          placeholder="Ex : Pharmacien titulaire"
        />
      </Row>

      <Row label="Taille">
        <Input
          value={taille}
          onChange={(e) => onTailleChange(e.target.value)}
          placeholder="Ex : 2 à 5 salariés"
          className="h-9 text-sm"
        />
      </Row>

      <Row label="Activité ciblée">
        <TagsField
          values={activite}
          onChange={onActiviteChange}
          placeholder="Ex : Officine indépendante"
        />
      </Row>

      <Row label="Zone géographique">
        <TagsField
          values={zone}
          onChange={onZoneChange}
          placeholder="Ex : Agglomération toulousaine"
        />
      </Row>

      <Row label="Signaux recherchés">
        <TagsField
          values={signaux}
          onChange={onSignauxChange}
          placeholder="Ex : Reprise récente"
        />
      </Row>

      <Row label="Demandes en plus (optionnel)">
        <Textarea
          value={instruction}
          onChange={(e) => onInstructionChange(e.target.value)}
          placeholder="Précision libre : hors chaînes, indépendantes…"
          rows={3}
          className="!text-sm"
        />
      </Row>
    </>
  )
}
