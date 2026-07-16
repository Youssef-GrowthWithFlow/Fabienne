import {
  Briefcase,
  Check,
  ExternalLink,
  Loader2,
  Map as MapIcon,
  MapPin,
  Phone,
  Star,
  Users,
  X,
} from 'lucide-react'

import { SignalBadge } from '@/components/signal-badge'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { SourcerCandidate } from '@/hooks/use-sourcer-history'

type Props = {
  candidate: SourcerCandidate | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onPickContact: (index: number) => void
  onValidate: () => void
  onRefuse: () => void
  busy?: boolean
}

export function CandidateSheet({
  candidate,
  open,
  onOpenChange,
  onPickContact,
  onValidate,
  onRefuse,
  busy,
}: Props) {
  if (!candidate) return null
  const isDone =
    candidate.status === 'validated' || candidate.status === 'refused'
  // Streaming candidates have a temp_id, not a persisted SourcedCandidate.id
  // — validate/refuse endpoints would 404. Lock both actions until enrichment
  // finishes and the row is persisted at end-of-run.
  const locked = candidate.enriching || candidate.persisted === false

  const address = [
    candidate.adresse,
    [candidate.codePostal, candidate.ville].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(' — ')

  // INSEE renvoie « NN » quand l'effectif n'est pas renseigné — pas parlant.
  const rawTaille = candidate.effectif || candidate.taille || ''
  const taille = rawTaille === 'NN' ? '' : rawTaille
  const secteur = candidate.secteur || candidate.nafLabel || ''
  const rating = candidate.googleRating
  const ratingCount = candidate.googleRatingCount

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex !w-full flex-col gap-0 overflow-hidden p-0 sm:!max-w-xl">
        <SheetHeader className="gap-1 border-b px-4 py-3">
          <SheetTitle className="text-base font-medium leading-snug">
            {candidate.entreprise || 'Sans nom'}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
          {/* Résumé — l'essentiel d'un coup d'œil avant de décider */}
          <div className="bg-muted/30 mb-4 grid grid-cols-2 gap-3 rounded-xl border p-3 sm:grid-cols-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
                Avis Google
              </span>
              {rating != null ? (
                <span className="flex items-center gap-1 text-lg font-semibold tabular-nums">
                  <Star className="size-4 fill-amber-400 text-amber-400" />
                  {rating.toFixed(1)}
                  {ratingCount != null ? (
                    <span className="text-muted-foreground text-xs font-normal">
                      ({ratingCount})
                    </span>
                  ) : null}
                </span>
              ) : (
                <span className="text-muted-foreground text-sm">—</span>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
                Ville
              </span>
              <span className="flex items-center gap-1 truncate text-sm font-medium">
                <MapPin className="text-muted-foreground size-3.5 shrink-0" />
                {candidate.ville || '—'}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
                Taille
              </span>
              <span className="flex items-center gap-1 truncate text-sm font-medium">
                <Users className="text-muted-foreground size-3.5 shrink-0" />
                {taille || '—'}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
                Secteur
              </span>
              <span
                className="flex items-center gap-1 truncate text-sm font-medium"
                title={secteur}
              >
                <Briefcase className="text-muted-foreground size-3.5 shrink-0" />
                {secteur || '—'}
              </span>
            </div>
          </div>

          {candidate.signaux && candidate.signaux.length > 0 && (
            <Block label="Pourquoi elle est intéressante">
              <div className="flex flex-wrap gap-1.5">
                {candidate.signaux.map((s, i) => (
                  <SignalBadge key={i}>{s}</SignalBadge>
                ))}
              </div>
            </Block>
          )}

          {candidate.raison && (
            <Block label="En deux mots">
              <p className="text-sm leading-relaxed text-foreground">
                {candidate.raison}
              </p>
            </Block>
          )}

          {address && (
            <Block label="Adresse">
              <span className="text-sm">{address}</span>
            </Block>
          )}

          {candidate.siteWeb && (
            <Block label="Site web">
              <a
                href={candidate.siteWeb}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-foreground hover:underline"
              >
                {stripScheme(candidate.siteWeb)}
                <ExternalLink className="size-3 text-muted-foreground" />
              </a>
            </Block>
          )}

          {candidate.googleMapsUrl && (
            <Block label="Google Maps">
              <a
                href={candidate.googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-foreground hover:underline"
              >
                <MapIcon className="size-3.5 text-muted-foreground" />
                Ouvrir dans Google Maps
                <ExternalLink className="size-3 text-muted-foreground" />
              </a>
            </Block>
          )}

          {candidate.telephone && (
            <Block label="Téléphone">
              <a
                href={`tel:${candidate.telephone}`}
                className="inline-flex items-center gap-1 text-sm text-foreground hover:underline"
              >
                <Phone className="size-3.5 text-muted-foreground" />
                {candidate.telephone}
              </a>
            </Block>
          )}

          {candidate.contacts.length > 0 && (
            <Block
              label={
                candidate.contacts.length > 1
                  ? 'Qui contacter ?'
                  : 'Contact'
              }
            >
              {candidate.contacts.length > 1 ? (
                <p className="mb-1 text-[11px] text-muted-foreground">
                  Choisis la personne à suivre — elle rejoindra tes contacts.
                </p>
              ) : null}
              <RadioGroup
                value={String(candidate.mainContactIndex)}
                onValueChange={(v: string) => onPickContact(Number(v))}
                className="flex flex-col gap-1"
              >
                {candidate.contacts.map((c, i) => (
                  <label
                    key={i}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 transition-colors',
                      candidate.mainContactIndex === i
                        ? 'border-primary/40 bg-primary/[0.03]'
                        : 'border-border hover:bg-muted/40',
                    )}
                  >
                    <RadioGroupItem value={String(i)} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium">
                        {c.nom || 'Sans nom'}
                      </span>
                      {c.role && (
                        <div className="text-[11px] text-muted-foreground">
                          {c.role}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </Block>
          )}
        </div>

        <SheetFooter className="flex-col gap-2 border-t px-4 py-3 sm:flex-row">
          {locked && (
            <div className="flex w-full items-center gap-2 rounded-md bg-primary/[0.04] px-3 py-2 text-[12px] text-primary">
              <Loader2 className="size-3.5 animate-spin" />
              Je complète encore les infos — quelques secondes…
            </div>
          )}
          <div className="flex w-full flex-row gap-2">
            <Button
              variant="outline"
              onClick={onRefuse}
              disabled={busy || isDone || locked}
              className="flex-1 gap-2"
            >
              <X className="size-4" /> Non merci
            </Button>
            <Button
              onClick={onValidate}
              disabled={busy || isDone || locked}
              className="flex-1 gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Ajouter à mes contacts
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/** Notion-style block : tiny gray label, content underneath, generous spacing. */
function Block({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-4">
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
        {label}
      </div>
      {children}
    </div>
  )
}

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}
