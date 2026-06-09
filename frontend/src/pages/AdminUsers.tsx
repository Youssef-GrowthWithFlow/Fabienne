import {
  Copy,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
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
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import {
  adminSetUserPassword,
  createUserApi,
  deleteUserApi,
  listUsers,
  updateUserApi,
  type UserCreatePayload,
} from '@/lib/auth-api'
import type { AuthUser } from '@/lib/auth-types'
import { cn, generatePassword } from '@/lib/utils'

export function AdminUsers() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<AuthUser[] | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pwdUser, setPwdUser] = useState<AuthUser | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = async () => {
    try {
      setUsers(await listUsers())
    } catch {
      toast.error('Impossible de charger la liste des utilisateurs.')
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function toggleActive(u: AuthUser) {
    setBusy(u.id)
    try {
      const updated = await updateUserApi(u.id, { is_active: !u.is_active })
      setUsers((prev) =>
        prev ? prev.map((x) => (x.id === updated.id ? updated : x)) : prev,
      )
    } catch {
      toast.error('Échec de la mise à jour.')
    } finally {
      setBusy(null)
    }
  }

  async function toggleAdmin(u: AuthUser) {
    setBusy(u.id)
    try {
      const updated = await updateUserApi(u.id, { is_admin: !u.is_admin })
      setUsers((prev) =>
        prev ? prev.map((x) => (x.id === updated.id ? updated : x)) : prev,
      )
    } catch {
      toast.error('Échec de la mise à jour.')
    } finally {
      setBusy(null)
    }
  }

  async function removeUser(u: AuthUser) {
    if (!confirm(`Supprimer définitivement ${u.email} ?`)) return
    setBusy(u.id)
    try {
      await deleteUserApi(u.id)
      setUsers((prev) => (prev ? prev.filter((x) => x.id !== u.id) : prev))
      toast.success(`${u.email} supprimé.`)
    } catch {
      toast.error('Suppression échouée.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ShieldCheck className="size-5 text-primary" />
            Utilisateurs
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {users == null
              ? 'Chargement…'
              : `${users.length} compte${users.length > 1 ? 's' : ''}.`}
          </p>
        </div>
        <Button onClick={() => setDrawerOpen(true)} className="gap-1.5">
          <UserPlus className="size-4" />
          Nouveau
        </Button>
      </div>

      {users == null ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          Aucun utilisateur.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              isMe={me?.id === u.id}
              busy={busy === u.id}
              onToggleActive={() => toggleActive(u)}
              onToggleAdmin={() => toggleAdmin(u)}
              onRemove={() => removeUser(u)}
              onSetPassword={() => setPwdUser(u)}
            />
          ))}
        </div>
      )}

      <CreateUserDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onCreated={(u) => {
          setUsers((prev) => (prev ? [u, ...prev] : [u]))
        }}
      />

      <SetPasswordDrawer
        user={pwdUser}
        onOpenChange={(open) => {
          if (!open) setPwdUser(null)
        }}
      />
    </div>
  )
}

function UserRow({
  user,
  isMe,
  busy,
  onToggleActive,
  onToggleAdmin,
  onRemove,
  onSetPassword,
}: {
  user: AuthUser
  isMe: boolean
  busy: boolean
  onToggleActive: () => void
  onToggleAdmin: () => void
  onRemove: () => void
  onSetPassword: () => void
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        !user.is_active && 'opacity-60',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-medium">
            {user.full_name || user.email}
          </span>
          {isMe && (
            <Badge variant="outline" className="text-[10px]">
              toi
            </Badge>
          )}
          {user.is_admin && (
            <Badge className="bg-amber-500 text-[10px] hover:bg-amber-500">
              Admin
            </Badge>
          )}
          {!user.is_active && (
            <Badge variant="outline" className="text-[10px]">
              Désactivé
            </Badge>
          )}
        </div>
        {user.full_name && (
          <div className="text-xs text-muted-foreground">{user.email}</div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onSetPassword}
          disabled={busy}
          className="gap-1.5"
        >
          <KeyRound className="size-3" />
          Mot de passe
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleAdmin}
          disabled={busy || isMe}
          title={isMe ? 'Tu ne peux pas modifier ton propre rôle.' : undefined}
        >
          {user.is_admin ? 'Retirer admin' : 'Promouvoir'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleActive}
          disabled={busy || isMe}
        >
          {user.is_active ? 'Désactiver' : 'Réactiver'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          disabled={busy || isMe}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

function CreateUserDrawer({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (u: AuthUser) => void
}) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setEmail('')
      setFullName('')
      setPassword('')
      setIsAdmin(false)
      setError(null)
      setSubmitting(false)
    }
  }, [open])

  const canSubmit = email.trim().length > 0 && password.length >= 8

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit || submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const payload: UserCreatePayload = {
        email: email.trim(),
        full_name: fullName.trim(),
        password,
        is_admin: isAdmin,
      }
      const created = await createUserApi(payload)
      onCreated(created)
      toast.success(`${created.email} créé.`)
      onOpenChange(false)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Création échouée.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  function copyPasswordToClipboard() {
    navigator.clipboard.writeText(password).catch(() => {})
    toast.success('Mot de passe copié.')
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <form onSubmit={handleSubmit} className="mx-auto w-full max-w-lg">
          <DrawerHeader>
            <DrawerTitle>Nouvel utilisateur</DrawerTitle>
            <DrawerDescription>
              Choisis un mot de passe initial. L'utilisateur pourra le changer
              depuis sa propre interface ensuite.
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex flex-col gap-4 px-4 pb-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="u-email">Email</Label>
              <Input
                id="u-email"
                type="email"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom@exemple.fr"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="u-name">Nom complet</Label>
              <Input
                id="u-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Optionnel"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="u-password">Mot de passe initial</Label>
              <div className="flex gap-1.5">
                <Input
                  id="u-password"
                  type="text"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8 caractères minimum"
                />
                {password.length >= 8 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={copyPasswordToClipboard}
                    title="Copier"
                  >
                    <Copy className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsAdmin((v) => !v)}
              className={cn(
                'flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors',
                isAdmin
                  ? 'border-primary/40 bg-primary/[0.04]'
                  : 'border-border hover:bg-muted/40',
              )}
            >
              <span>Donner les droits administrateur</span>
              {isAdmin && <ShieldCheck className="size-4 text-primary" />}
            </button>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>

          <DrawerFooter className="flex-row justify-end">
            <DrawerClose asChild>
              <Button type="button" variant="ghost" disabled={submitting}>
                Annuler
              </Button>
            </DrawerClose>
            <Button
              type="submit"
              disabled={!canSubmit || submitting}
              className="gap-1.5"
            >
              {submitting && <Loader2 className="size-3.5 animate-spin" />}
              Créer
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}

function SetPasswordDrawer({
  user,
  onOpenChange,
}: {
  user: AuthUser | null
  onOpenChange: (open: boolean) => void
}) {
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      setPassword(generatePassword())
      setError(null)
      setSubmitting(false)
    }
  }, [user])

  const canSubmit = password.length >= 8

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit || submitting || !user) return
    setError(null)
    setSubmitting(true)
    try {
      await adminSetUserPassword(user.id, password)
      await navigator.clipboard.writeText(password).catch(() => {})
      toast.success('Mot de passe mis à jour et copié.', {
        description: 'Transmets-le à ' + user.email,
        duration: 10000,
      })
      onOpenChange(false)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Échec de la mise à jour.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={user != null} onOpenChange={onOpenChange}>
      <DrawerContent>
        <form onSubmit={handleSubmit} className="mx-auto w-full max-w-lg">
          <DrawerHeader>
            <DrawerTitle>Changer le mot de passe</DrawerTitle>
            <DrawerDescription>
              Nouveau mot de passe pour {user?.full_name || user?.email}. Il
              prend effet immédiatement — transmets-le à la personne.
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex flex-col gap-4 px-4 pb-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sp-password">Mot de passe</Label>
              <div className="flex gap-1.5">
                <Input
                  id="sp-password"
                  type="text"
                  required
                  minLength={8}
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8 caractères minimum"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setPassword(generatePassword())}
                  title="Générer"
                >
                  <RefreshCw className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(password).catch(() => {})
                    toast.success('Mot de passe copié.')
                  }}
                  disabled={password.length < 8}
                  title="Copier"
                >
                  <Copy className="size-3.5" />
                </Button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>

          <DrawerFooter className="flex-row justify-end">
            <DrawerClose asChild>
              <Button type="button" variant="ghost" disabled={submitting}>
                Annuler
              </Button>
            </DrawerClose>
            <Button
              type="submit"
              disabled={!canSubmit || submitting}
              className="gap-1.5"
            >
              {submitting && <Loader2 className="size-3.5 animate-spin" />}
              Enregistrer
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
