import { useState } from 'react'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type Props = {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
  type?: 'text' | 'email' | 'tel' | 'url'
  className?: string
  displayClassName?: string
  emptyLabel?: string
}

export function InlineText({
  value,
  onChange,
  placeholder,
  multiline = false,
  type = 'text',
  className,
  displayClassName,
  emptyLabel = 'Ajouter…',
}: Props) {
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
        'rounded-sm text-left text-sm hover:bg-muted/60',
        !value && 'italic text-muted-foreground',
        displayClassName,
      )}
    >
      {/* Jamais le placeholder ici : un exemple grisé (« 06 12 34 56 78 »)
          se confond avec une vraie valeur. Il ne sert qu'en édition. */}
      {value || emptyLabel}
    </button>
  )
}
