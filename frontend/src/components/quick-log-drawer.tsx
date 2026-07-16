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
import { Textarea } from '@/components/ui/textarea'
import { useProspects } from '@/hooks/use-prospects'
import type { Prospect } from '@/lib/prospects'
import { cn } from '@/lib/utils'

const PLATFORMS = ['LinkedIn', 'Email', 'Téléphone', 'SMS', 'Autre'] as const
type Platform = (typeof PLATFORMS)[number]

/**
 * Lightweight "C'est fait" logger: one tap on the channel, optional note,
 * done. Logs a `message` action — the backend flips the status to
 * « Contacté » and pushes the relance to J+7 on its own.
 */
export function QuickLogDrawer({
  prospect,
  onClose,
}: {
  prospect: Prospect | null
  onClose: () => void
}) {
  const { logAction } = useProspects()
  const [platform, setPlatform] = useState<Platform>('LinkedIn')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (prospect) {
      setPlatform('LinkedIn')
      setNote('')
      setSubmitting(false)
    }
  }, [prospect?.id])

  async function submit() {
    if (!prospect) return
    setSubmitting(true)
    try {
      await logAction(prospect.id, 'message', {
        platform,
        message: note.trim(),
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={!!prospect} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-lg">
          <DrawerHeader>
            <DrawerTitle>Bien joué !</DrawerTitle>
            <DrawerDescription>
              {prospect?.nom
                ? `Comment as-tu contacté ${prospect.nom} ?`
                : 'Comment as-tu pris contact ?'}
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex flex-col gap-4 px-4 pb-2">
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={cn(
                    'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                    platform === p
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-input text-muted-foreground hover:bg-muted',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Une note ? (optionnel)"
              rows={2}
            />
          </div>

          <DrawerFooter className="flex-row justify-end">
            <DrawerClose asChild>
              <Button variant="ghost" disabled={submitting}>
                Annuler
              </Button>
            </DrawerClose>
            <Button
              onClick={submit}
              disabled={submitting}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {submitting ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
