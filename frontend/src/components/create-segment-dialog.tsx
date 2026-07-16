import { useState } from 'react'

import { FormDrawer } from '@/components/form-drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (input: { nom: string; description: string }) => Promise<void>
}

export function CreateSegmentDialog({ open, onOpenChange, onCreate }: Props) {
  const [nom, setNom] = useState('')
  const [description, setDescription] = useState('')

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Nouveau segment"
      description="Un nom et une phrase suffisent pour démarrer — tu complètes le reste juste après."
      submitLabel="Créer le segment"
      submittingLabel="Création…"
      canSubmit={nom.trim().length > 0}
      onReset={() => {
        setNom('')
        setDescription('')
      }}
      onSubmit={() =>
        onCreate({ nom: nom.trim(), description: description.trim() })
      }
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="segment-nom">Nom</Label>
        <Input
          id="segment-nom"
          autoFocus
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="Ex : Pharmacie de quartier"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="segment-description">Description</Label>
        <Textarea
          id="segment-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="En une phrase, qui sont-ils ?"
          rows={3}
        />
      </div>
    </FormDrawer>
  )
}
