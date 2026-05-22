import { useEffect, useState } from 'react'

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
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { todayIso } from '@/lib/prospects'
import type { ActivityKind } from '@/lib/prospects'

const PLATFORMS = ['LinkedIn', 'Email', 'Téléphone', 'SMS', 'Autre'] as const
type Platform = (typeof PLATFORMS)[number]

export type ActionDialogKind = 'message_sent' | 'message_received' | 'meeting' | 'won'

export type ActionPayload = {
  kind: ActivityKind
  metadata: Record<string, unknown>
  at: string
}

type Props = {
  open: ActionDialogKind | null
  onOpenChange: (open: ActionDialogKind | null) => void
  onSubmit: (payload: ActionPayload) => void | Promise<void>
}

const TITLES: Record<ActionDialogKind, string> = {
  message_sent: 'Message envoyé',
  message_received: 'Message reçu',
  meeting: 'RDV pris',
  won: 'Client gagné',
}

const DESCRIPTIONS: Record<ActionDialogKind, string> = {
  message_sent: 'Sur quel canal et quel était le message ?',
  message_received: 'Sur quel canal et quel était le message ?',
  meeting: 'Quand a lieu le RDV, et de quoi va-t-on parler ?',
  won: 'Bravo. Pour faire quoi, et pourquoi ça a marché ?',
}

export function ActionDialog({ open, onOpenChange, onSubmit }: Props) {
  const [actionDate, setActionDate] = useState<string>(todayIso())
  const [platform, setPlatform] = useState<Platform>('LinkedIn')
  const [texte, setTexte] = useState('')
  const [meetingDate, setMeetingDate] = useState<string>(todayIso())
  const [meetingDescription, setMeetingDescription] = useState('')
  const [wonGoal, setWonGoal] = useState('')
  const [wonReason, setWonReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setActionDate(todayIso())
      setPlatform('LinkedIn')
      setTexte('')
      setMeetingDate(todayIso())
      setMeetingDescription('')
      setWonGoal('')
      setWonReason('')
      setSubmitting(false)
    }
  }, [open])

  const BUILDERS: Record<
    ActionDialogKind,
    () => { kind: ActivityKind; metadata: Record<string, unknown>; valid: boolean }
  > = {
    message_sent: () => ({
      kind: 'message',
      metadata: { platform, message: texte.trim() },
      valid: texte.trim().length > 0,
    }),
    message_received: () => ({
      kind: 'reply',
      metadata: { platform, message: texte.trim() },
      valid: texte.trim().length > 0,
    }),
    meeting: () => ({
      kind: 'meeting',
      metadata: { date: meetingDate, description: meetingDescription.trim() },
      valid:
        meetingDate.length > 0 && meetingDescription.trim().length > 0,
    }),
    won: () => ({
      kind: 'won',
      metadata: { goal: wonGoal.trim(), reason: wonReason.trim() },
      valid: wonGoal.trim().length > 0,
    }),
  }

  const draft = open ? BUILDERS[open]() : null
  const canSubmit = !!draft?.valid

  async function submit() {
    if (!canSubmit || !open || !draft) return
    const dateForAt = open === 'meeting' ? meetingDate : actionDate
    const at = new Date(`${dateForAt}T12:00:00`).toISOString()
    setSubmitting(true)
    try {
      await onSubmit({ kind: draft.kind, metadata: draft.metadata, at })
      onOpenChange(null)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={!!open} onOpenChange={(o) => !o && onOpenChange(null)}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-lg">
          <DrawerHeader>
            <DrawerTitle>{open ? TITLES[open] : ''}</DrawerTitle>
            <DrawerDescription>
              {open ? DESCRIPTIONS[open] : ''}
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex flex-col gap-3 px-4 pb-2">
            {open !== 'meeting' && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-muted-foreground text-xs">
                  Date de l’action
                </Label>
                <Input
                  type="date"
                  value={actionDate}
                  onChange={(e) => setActionDate(e.target.value)}
                />
              </div>
            )}
            {(open === 'message_sent' || open === 'message_received') && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-muted-foreground text-xs">Canal</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {PLATFORMS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPlatform(p)}
                        className={cn(
                          'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                          platform === p
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-input text-muted-foreground hover:bg-muted',
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-muted-foreground text-xs">
                    Message
                  </Label>
                  <Textarea
                    autoFocus
                    value={texte}
                    onChange={(e) => setTexte(e.target.value)}
                    placeholder="Ex : prise de contact, proposition de démo…"
                    rows={3}
                  />
                </div>
              </>
            )}

            {open === 'meeting' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-muted-foreground text-xs">
                    Date du RDV
                  </Label>
                  <Input
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-muted-foreground text-xs">
                    Description
                  </Label>
                  <Textarea
                    autoFocus
                    value={meetingDescription}
                    onChange={(e) => setMeetingDescription(e.target.value)}
                    placeholder="Ex : démo produit + Q&A avec le DGS"
                    rows={3}
                  />
                </div>
              </>
            )}

            {open === 'won' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-muted-foreground text-xs">
                    Pour faire quoi
                  </Label>
                  <Textarea
                    autoFocus
                    value={wonGoal}
                    onChange={(e) => setWonGoal(e.target.value)}
                    placeholder="Ex : accompagnement reprise officine, 6 mois"
                    rows={2}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-muted-foreground text-xs">
                    Pourquoi ça a marché
                  </Label>
                  <Textarea
                    value={wonReason}
                    onChange={(e) => setWonReason(e.target.value)}
                    placeholder="Ex : timing reprise, posture du titulaire, refs locales"
                    rows={2}
                  />
                </div>
              </>
            )}
          </div>

          <DrawerFooter className="flex-row justify-end">
            <DrawerClose asChild>
              <Button variant="ghost" disabled={submitting}>
                Annuler
              </Button>
            </DrawerClose>
            <Button onClick={submit} disabled={!canSubmit || submitting}>
              {submitting ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
