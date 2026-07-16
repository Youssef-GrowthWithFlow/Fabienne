import { CalendarClock, Check, Mail, Phone, Send } from 'lucide-react'
import { useRef } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useProspects } from '@/hooks/use-prospects'
import {
  formatDate,
  isoInDays,
  relanceLabel,
  taskSentence,
  todayIso,
  type Prospect,
} from '@/lib/prospects'
import { cn } from '@/lib/utils'

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M20.451 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.447-2.136 2.94v5.666H9.355V9h3.414v1.561h.049c.476-.9 1.637-1.852 3.37-1.852 3.6 0 4.266 2.37 4.266 5.455v6.288zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.114 20.452H3.558V9h3.556v11.452zM22.225 0H1.771C.792 0 0 .771 0 1.723v20.554C0 23.229.792 24 1.771 24h20.451C23.2 24 24 23.229 24 22.277V1.723C24 .771 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

/**
 * One follow-up line on the home screen: who, why, and the two actions that
 * matter — « Contacter » (deep-links) and « C'est fait ».
 */
export function RelanceRow({
  prospect,
  overdue,
  onOpen,
  onDone,
}: {
  prospect: Prospect
  overdue?: boolean
  onOpen: () => void
  onDone: () => void
}) {
  const { updateProspect } = useProspects()
  const dateInputRef = useRef<HTMLInputElement>(null)
  const sentence = taskSentence(prospect)
  const hasChannel = !!(prospect.email || prospect.telephone || prospect.linkedin)

  const postponeTo = (iso: string) => {
    if (!iso) return
    updateProspect({ ...prospect, relanceDate: iso })
    const label = relanceLabel(iso)
    toast.success(
      `Ok, je te la remets ${label.charAt(0).toLowerCase()}${label.slice(1)}.`,
    )
  }

  return (
    <div
      className={cn(
        'bg-card flex flex-wrap items-center gap-3 rounded-xl border p-4 shadow-xs',
        overdue && 'border-rose-200 dark:border-rose-900',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 basis-52 text-left outline-none"
      >
        <div className="flex items-center gap-2">
          <span className="truncate text-base font-semibold">
            {prospect.nom || 'Sans nom'}
          </span>
          {prospect.entreprise?.entreprise ? (
            <span className="text-muted-foreground truncate text-sm">
              · {prospect.entreprise.entreprise}
            </span>
          ) : null}
        </div>
        {/* La tâche, en une phrase : « Demain, je dois envoyer ma proposition. » */}
        <p className="truncate text-sm">
          <span
            className={cn(
              'font-semibold',
              overdue ? 'text-rose-600' : 'text-sky-700 dark:text-sky-300',
            )}
          >
            {sentence.when ||
              `Ajouté le ${formatDate(prospect.createdAt)}`}
          </span>
          {sentence.when ? (
            <span className="text-muted-foreground">
              , je dois {sentence.what}.
            </span>
          ) : null}
        </p>
      </button>

      <div className="relative flex shrink-0 items-center gap-1.5">
        {hasChannel ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-sky-200 text-sky-700 hover:bg-sky-50 hover:text-sky-800 dark:border-sky-900 dark:text-sky-300 dark:hover:bg-sky-950"
                />
              }
            >
              <Send className="size-3.5" />
              Contacter
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              {prospect.email ? (
                <DropdownMenuItem
                  onClick={() => window.open(`mailto:${prospect.email}`, '_blank')}
                >
                  <Mail className="size-4" />
                  Envoyer un email
                </DropdownMenuItem>
              ) : null}
              {prospect.telephone ? (
                <DropdownMenuItem
                  onClick={() =>
                    window.open(
                      `tel:${prospect.telephone.replace(/\s/g, '')}`,
                      '_blank',
                    )
                  }
                >
                  <Phone className="size-4" />
                  Appeler
                </DropdownMenuItem>
              ) : null}
              {prospect.linkedin ? (
                <DropdownMenuItem
                  onClick={() => window.open(prospect.linkedin!, '_blank')}
                >
                  <LinkedinIcon className="size-4" />
                  LinkedIn
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onOpen}>
            <Send className="size-3.5" />
            Contacter
          </Button>
        )}
        <Button
          size="sm"
          className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
          onClick={onDone}
        >
          <Check className="size-3.5" />
          C'est fait
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                title="Plus tard"
                aria-label="Repousser la relance"
              />
            }
          >
            <CalendarClock className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem onClick={() => postponeTo(isoInDays(1))}>
              Demain
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => postponeTo(isoInDays(2))}>
              Dans 2 jours
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => postponeTo(isoInDays(7))}>
              La semaine prochaine
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                const input = dateInputRef.current
                if (!input) return
                if (typeof input.showPicker === 'function') input.showPicker()
                else input.click()
              }}
            >
              Choisir une date…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Sélecteur natif invisible, ouvert par « Choisir une date… ». */}
        <input
          ref={dateInputRef}
          type="date"
          min={todayIso()}
          tabIndex={-1}
          aria-hidden
          onChange={(e) => postponeTo(e.target.value)}
          className="pointer-events-none absolute size-0 opacity-0"
        />
      </div>
    </div>
  )
}
