import { useEffect, useState, type ReactNode } from 'react'

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

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  submitLabel: string
  submittingLabel?: string
  cancelLabel?: string
  canSubmit: boolean
  onSubmit: () => Promise<void> | void
  onReset?: () => void
  children: ReactNode
}

export function FormDrawer({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  submittingLabel = 'Enregistrement…',
  cancelLabel = 'Annuler',
  canSubmit,
  onSubmit,
  onReset,
  children,
}: Props) {
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setSubmitting(false)
      onReset?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || submitting) return
    setSubmitting(true)
    try {
      await onSubmit()
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <form onSubmit={handleSubmit} className="mx-auto w-full max-w-lg">
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            {description ? (
              <DrawerDescription>{description}</DrawerDescription>
            ) : null}
          </DrawerHeader>

          <div className="flex flex-col gap-3 px-4 pb-2">{children}</div>

          <DrawerFooter className="flex-row justify-end">
            <DrawerClose
              render={
                <Button type="button" variant="ghost" disabled={submitting}>
                  {cancelLabel}
                </Button>
              }
            />
            <Button type="submit" disabled={!canSubmit || submitting}>
              {submitting ? submittingLabel : submitLabel}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
