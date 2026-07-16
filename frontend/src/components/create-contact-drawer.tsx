import { Building2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { FormDrawer } from '@/components/form-drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useEntreprises } from '@/hooks/use-entreprises'

export type CreateContactInput = {
  nom: string
  role: string
  email: string
  telephone: string
  entrepriseId: string | null
  entrepriseNom: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (input: CreateContactInput) => Promise<void>
}

/**
 * Minimal add-contact form: name + free-text company. Picking a suggestion
 * links the existing entreprise; free text lets the backend find-or-create
 * one — no need to create the company first.
 */
export function CreateContactDrawer({ open, onOpenChange, onCreate }: Props) {
  const { entreprises } = useEntreprises()
  const [nom, setNom] = useState('')
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')
  const [telephone, setTelephone] = useState('')
  const [entrepriseText, setEntrepriseText] = useState('')
  const [entrepriseId, setEntrepriseId] = useState<string | null>(null)
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)

  const suggestions = useMemo(() => {
    const q = entrepriseText.trim().toLowerCase()
    if (!q || entrepriseId) return []
    return entreprises
      .filter((e) => e.entreprise.toLowerCase().includes(q))
      .slice(0, 5)
  }, [entreprises, entrepriseText, entrepriseId])

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Ajouter un contact"
      description="Son nom, son entreprise — le reste peut attendre."
      submitLabel="Ajouter"
      submittingLabel="Ajout…"
      canSubmit={nom.trim().length > 0 && entrepriseText.trim().length > 0}
      onReset={() => {
        setNom('')
        setRole('')
        setEmail('')
        setTelephone('')
        setEntrepriseText('')
        setEntrepriseId(null)
        setSuggestionsOpen(false)
      }}
      onSubmit={() =>
        onCreate({
          nom: nom.trim(),
          role: role.trim(),
          email: email.trim(),
          telephone: telephone.trim(),
          entrepriseId,
          entrepriseNom: entrepriseId ? '' : entrepriseText.trim(),
        })
      }
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="c-nom">Son nom</Label>
        <Input
          id="c-nom"
          autoFocus
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="Ex : Emilie Genieys"
          required
        />
      </div>

      <div className="relative flex flex-col gap-1.5">
        <Label htmlFor="c-entreprise">Son entreprise</Label>
        <Input
          id="c-entreprise"
          value={entrepriseText}
          onChange={(e) => {
            setEntrepriseText(e.target.value)
            setEntrepriseId(null)
            setSuggestionsOpen(true)
          }}
          onFocus={() => setSuggestionsOpen(true)}
          onBlur={() => setTimeout(() => setSuggestionsOpen(false), 150)}
          placeholder="Ex : Pharmacie du Parc"
          autoComplete="off"
          required
        />
        {suggestionsOpen && suggestions.length > 0 ? (
          <div className="bg-popover absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-md border shadow-md">
            {suggestions.map((e) => (
              <button
                key={e.id}
                type="button"
                onMouseDown={(ev) => {
                  ev.preventDefault()
                  setEntrepriseText(e.entreprise)
                  setEntrepriseId(e.id)
                  setSuggestionsOpen(false)
                }}
                className="hover:bg-muted flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
              >
                <Building2 className="text-muted-foreground size-3.5 shrink-0" />
                <span className="truncate">
                  {e.entreprise || 'Sans nom'}
                  {e.ville ? (
                    <span className="text-muted-foreground"> · {e.ville}</span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        ) : null}
        <p className="text-muted-foreground text-xs">
          {entrepriseId
            ? 'Entreprise existante — le contact y sera rattaché.'
            : "Si l'entreprise n'existe pas encore, je la crée pour toi."}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="c-role">Son rôle (optionnel)</Label>
        <Input
          id="c-role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Pharmacien titulaire, gérante…"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="c-email">Email (optionnel)</Label>
          <Input
            id="c-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contact@exemple.com"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="c-tel">Téléphone (optionnel)</Label>
          <Input
            id="c-tel"
            type="tel"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            placeholder="06 12 34 56 78"
          />
        </div>
      </div>
    </FormDrawer>
  )
}
