import { KeyRound, Loader2, UserCog } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/use-auth'
import { changePassword, updateMe } from '@/lib/auth-api'

function detail(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { detail?: string } } })?.response?.data
      ?.detail ?? fallback
  )
}

export function Account() {
  const { user, setUser } = useAuth()

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <UserCog className="size-5 text-primary" />
          Mon compte
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {user?.email}
        </p>
      </div>

      <ProfileCard
        key={user?.id}
        initialName={user?.full_name ?? ''}
        initialEmail={user?.email ?? ''}
        onSaved={(u) => setUser(u)}
      />
      <PasswordCard />
    </div>
  )
}

function ProfileCard({
  initialName,
  initialEmail,
  onSaved,
}: {
  initialName: string
  initialEmail: string
  onSaved: (u: import('@/lib/auth-types').AuthUser) => void
}) {
  const [fullName, setFullName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  const [saving, setSaving] = useState(false)

  const dirty =
    fullName.trim() !== initialName || email.trim() !== initialEmail
  const canSave = dirty && email.trim().length > 0

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSave || saving) return
    setSaving(true)
    try {
      const updated = await updateMe({
        fullName: fullName.trim(),
        email: email.trim(),
      })
      onSaved(updated)
      toast.success('Profil mis à jour.')
    } catch (err: unknown) {
      toast.error(detail(err, 'Échec de la mise à jour.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profil</CardTitle>
        <CardDescription>Ton nom et ton adresse de connexion.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ac-name">Nom complet</Label>
            <Input
              id="ac-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ton nom"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ac-email">Email</Label>
            <Input
              id="ac-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!canSave || saving}
              className="gap-1.5"
            >
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function PasswordCard() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setCurrent('')
    setNext('')
    setConfirm('')
  }

  const mismatch = confirm.length > 0 && next !== confirm
  const canSave =
    current.length > 0 && next.length >= 8 && next === confirm && !saving

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (next.length < 8) {
      setError('Le nouveau mot de passe doit faire au moins 8 caractères.')
      return
    }
    if (next !== confirm) {
      setError('La confirmation ne correspond pas.')
      return
    }
    setSaving(true)
    try {
      await changePassword(current, next)
      reset()
      toast.success('Mot de passe modifié.')
    } catch (err: unknown) {
      setError(detail(err, 'Échec de la modification.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4 text-primary" />
          Mot de passe
        </CardTitle>
        <CardDescription>
          Choisis un nouveau mot de passe (8 caractères minimum).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pw-current">Mot de passe actuel</Label>
            <Input
              id="pw-current"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pw-next">Nouveau mot de passe</Label>
            <Input
              id="pw-next"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pw-confirm">Confirmer</Label>
            <Input
              id="pw-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={mismatch}
            />
            {mismatch && (
              <p className="text-xs text-destructive">
                La confirmation ne correspond pas.
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={!canSave} className="gap-1.5">
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              Modifier
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
