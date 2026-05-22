import { Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import penguinHero from '@/assets/penguin-hero.png'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/use-auth'

export function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      await login(email.trim(), password)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Email ou mot de passe incorrect.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/20 px-4 py-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-5">
        {/* Hero illustration --------------------------------------------- */}
        <img
          src={penguinHero}
          alt="Prospection Automatisée — Growth With Flow"
          width={220}
          height={152}
          className="h-auto w-44 select-none sm:w-52"
          draggable={false}
        />

        {/* Wordmark + tagline ------------------------------------------- */}
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Prospection Automatisée
          </h1>
          <p className="text-sm text-muted-foreground">
            On trouve vos prochains clients pendant que vous faites le reste.
          </p>
        </div>

        {/* Login card ---------------------------------------------------- */}
        <Card className="w-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Connexion</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="prenom@growthwithflow.com"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="password">Mot de passe</Label>
                  <a
                    href="/forgot-password"
                    className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Oublié ?
                  </a>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {error && (
                <p
                  className="rounded-md border border-destructive/30 bg-destructive/[0.04] px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="gap-2"
                disabled={submitting || !email || !password}
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {submitting ? 'Connexion…' : 'Se connecter'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
