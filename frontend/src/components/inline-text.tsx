import { useState, type KeyboardEvent } from 'react'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type Props = {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
  type?: 'text' | 'email' | 'tel' | 'url'
  rows?: number
  className?: string
  displayClassName?: string
}

export function InlineText({
  value,
  onChange,
  placeholder,
  multiline = false,
  type = 'text',
  rows = 3,
  className,
  displayClassName,
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
          rows={rows}
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
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
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
        'block w-full rounded px-2 py-1 text-left text-sm hover:bg-muted/50',
        multiline && 'whitespace-pre-wrap',
        !value && 'italic text-muted-foreground',
        displayClassName,
      )}
    >
      {value || placeholder || 'Ajouter…'}
    </button>
  )
}
