import { X } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

export type TagsFieldProps = {
  values: string[]
  onChange: (next: string[]) => void
  placeholder?: string
}

/**
 * Inline chip input — supports Enter / comma to add, Backspace on empty
 * draft to delete the last tag, click on tag text to edit, click on × to
 * remove. Extracted from segment-sheet so the sourcer drawer reuses the
 * exact same UX as the segment briefs.
 */
export function TagsField({ values, onChange, placeholder }: TagsFieldProps) {
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
