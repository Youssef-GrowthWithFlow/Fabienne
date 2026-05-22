import { Loader2, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'

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
import { forgotPassword } from '@/lib/auth-api'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      await forgotPassword(email.trim())
    } catch {
      // 204 toujours côté backend — pas de leak. On affiche le même état.
    } finally {
      setSubmitting(false)
      setSent(true)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Mail className="size-5 text-primary" />
          </div>
          <CardTitle className="text-xl">Ça arrive à tout le monde</CardTitle>
          <CardDescription>
            Mets ton email, je t'envoie un lien pour repartir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="flex flex-col gap-3 text-sm">
              <p className="text-foreground">
                C’est parti — regarde ta boîte mail dans la minute qui vient.
              </p>
              <a
                href="/"
                className="self-center text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                Retour
              </a>
            </div>
          ) : (
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
                  placeholder="toi@exemple.fr"
                />
              </div>
              <Button
                type="submit"
                className="gap-2"
                disabled={submitting || !email}
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                M'envoyer le lien
              </Button>
              <a
                href="/"
                className="self-center text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                Retour
              </a>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
