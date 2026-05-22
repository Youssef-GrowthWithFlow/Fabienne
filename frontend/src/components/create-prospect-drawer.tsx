import { Wand2 } from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'

import { FormDrawer } from '@/components/form-drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { useEntreprises } from '@/hooks/use-entreprises'
import { useSegments } from '@/hooks/use-segments'

export type CreateProspectInput = {
  nom: string
  role: string
  entrepriseId: string | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (input: CreateProspectInput) => Promise<void>
}

export function CreateProspectDrawer({ open, onOpenChange, onCreate }: Props) {
  const { entreprises } = useEntreprises()
  const { briefs } = useSegments()
  const [nom, setNom] = useState('')
  const [role, setRole] = useState('')
  const [entrepriseId, setEntrepriseId] = useState<string | null>(null)

  const noEntreprise = entreprises.length === 0

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Nouveau contact"
      description="Rattache un contact à une entreprise existante. Crée une entreprise depuis Sourcer si besoin."
      submitLabel="Créer le contact"
      submittingLabel="Création…"
      canSubmit={nom.trim().length > 0 && !!entrepriseId}
      onReset={() => {
        setNom('')
        setRole('')
        setEntrepriseId(null)
      }}
      onSubmit={() =>
        onCreate({
          nom: nom.trim(),
          role: role.trim(),
          entrepriseId,
        })
      }
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="p-nom">Nom</Label>
        <Input
          id="p-nom"
          autoFocus
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="Ex : Emilie Genieys"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="p-role">Rôle</Label>
        <Input
          id="p-role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Pharmacien titulaire, CEO…"
        />
      </div>

      {noEntreprise ? (
        <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
          <Wand2 className="size-3.5 shrink-0" />
          <span>
            Aucune entreprise en base.{' '}
            <NavLink
              to="/sourcer"
              onClick={() => onOpenChange(false)}
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              Va sourcer
            </NavLink>{' '}
            pour en créer.
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label>Entreprise</Label>
          <Select
            value={entrepriseId ?? ''}
            onValueChange={(v) =>
              typeof v === 'string' && setEntrepriseId(v || null)
            }
          >
            <SelectTrigger className="h-9 text-sm">
              <span>
                {entrepriseId
                  ? entreprises.find((e) => e.id === entrepriseId)?.entreprise ||
                    'Sans nom'
                  : 'Choisir une entreprise'}
              </span>
            </SelectTrigger>
            <SelectContent>
              {entreprises.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.entreprise || 'Sans nom'}
                  {e.ville ? ` · ${e.ville}` : ''}
                  {e.segmentId
                    ? ` · ${briefs[e.segmentId]?.nom ?? e.segmentId}`
                    : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </FormDrawer>
  )
}
