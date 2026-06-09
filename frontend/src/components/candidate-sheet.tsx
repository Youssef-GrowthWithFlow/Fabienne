import {
  Check,
  ExternalLink,
  Loader2,
  Map as MapIcon,
  Phone,
  Star,
  X,
} from 'lucide-react'

import { SignalBadge } from '@/components/signal-badge'
import { WithSourceTooltip } from '@/components/with-source-tooltip'
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
  const sources = candidate.fieldSources
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

  const taille = candidate.effectif || candidate.taille || ''
  const secteur = candidate.secteur || candidate.nafLabel || ''
  const rating = candidate.googleRating
  const ratingCount = candidate.googleRatingCount

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex !w-full flex-col gap-0 overflow-hidden p-0 sm:!max-w-xl">
        <SheetHeader className="gap-1 border-b px-4 py-3">
          <SheetTitle className="text-base font-medium leading-snug">
            <WithSourceTooltip source={sources?.entreprise}>
              {candidate.entreprise || 'Sans nom'}
            </WithSourceTooltip>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
          {/* Signaux + explication ------------------------------------- */}
          {candidate.signaux && candidate.signaux.length > 0 && (
            <Block label="Signaux">
              <div className="flex flex-wrap gap-1.5">
                {candidate.signaux.map((s, i) => (
                  <SignalBadge key={i}>{s}</SignalBadge>
                ))}
              </div>
            </Block>
          )}

          {candidate.raison && (
            <Block label="Description">
              <p className="text-sm leading-relaxed text-foreground">
                {candidate.raison}
              </p>
            </Block>
          )}

          {/* Identité ------------------------------------------------- */}
          {address && (
            <Block label="Adresse">
              <WithSourceTooltip source={sources?.adresse ?? sources?.ville}>
                <span className="text-sm">{address}</span>
              </WithSourceTooltip>
            </Block>
          )}

          {secteur && (
            <Block label="Secteur">
              <WithSourceTooltip
                source={sources?.secteur ?? sources?.naf_label}
              >
                <span className="text-sm">{secteur}</span>
              </WithSourceTooltip>
            </Block>
          )}

          {taille && (
            <Block label="Taille">
              <WithSourceTooltip
                source={sources?.effectif ?? sources?.taille}
              >
                <span className="text-sm">{taille}</span>
              </WithSourceTooltip>
            </Block>
          )}

          {/* Contact info --------------------------------------------- */}
          {candidate.siteWeb && (
            <Block label="Site web">
              <a
                href={candidate.siteWeb}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-foreground hover:underline"
              >
                <WithSourceTooltip source={sources?.site_web}>
                  {stripScheme(candidate.siteWeb)}
                </WithSourceTooltip>
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
                <WithSourceTooltip source={sources?.google_maps_url}>
                  Ouvrir dans Google Maps
                </WithSourceTooltip>
                <ExternalLink className="size-3 text-muted-foreground" />
              </a>
            </Block>
          )}

          {rating != null && (
            <Block label="Avis Google">
              <div className="inline-flex items-center gap-1.5 text-sm">
                <Star className="size-3.5 fill-amber-400 text-amber-400" />
                <WithSourceTooltip source={sources?.google_rating}>
                  <span className="font-medium">{rating.toFixed(1)}</span>
                  {ratingCount != null && (
                    <span className="ml-1 text-muted-foreground">
                      ({ratingCount} avis)
                    </span>
                  )}
                </WithSourceTooltip>
              </div>
            </Block>
          )}

          {candidate.telephone && (
            <Block label="Téléphone">
              <a
                href={`tel:${candidate.telephone}`}
                className="inline-flex items-center gap-1 text-sm text-foreground hover:underline"
              >
                <Phone className="size-3.5 text-muted-foreground" />
                <WithSourceTooltip source={sources?.telephone}>
                  {candidate.telephone}
                </WithSourceTooltip>
              </a>
            </Block>
          )}

          {/* Sélecteur contact principal ------------------------------ */}
          {candidate.contacts.length > 0 && (
            <Block
              label={
                candidate.contacts.length > 1
                  ? `Contact principal (${candidate.contacts.length} disponibles)`
                  : 'Contact'
              }
            >
              {candidate.contacts.length > 1 ? (
                <p className="mb-1 text-[11px] text-muted-foreground">
                  Sélectionne le contact principal — il devient le prospect.
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
                    <RadioGroupItem
                      value={String(i)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <WithSourceTooltip source={c.source}>
                        <span className="text-sm font-medium">
                          {c.nom || 'Sans nom'}
                        </span>
                      </WithSourceTooltip>
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

          {/* Sources --------------------------------------------------- */}
          {candidate.sources && candidate.sources.length > 0 && (
            <Block label="Sources">
              <ul className="flex flex-col gap-1">
                {candidate.sources.map((s, i) => (
                  <li key={i}>
                    <a
                      href={s.uri}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-start gap-1.5 text-sm text-foreground hover:underline"
                    >
                      <ExternalLink className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                      <span className="break-all">{s.title || s.uri}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </Block>
          )}
        </div>

        <SheetFooter className="flex-col gap-2 border-t px-4 py-3 sm:flex-row">
          {locked && (
            <div className="flex w-full items-center gap-2 rounded-md bg-primary/[0.04] px-3 py-2 text-[12px] text-primary">
              <Loader2 className="size-3.5 animate-spin" />
              Enrichissement en cours — actions disponibles à la fin du run.
            </div>
          )}
          <div className="flex w-full flex-row gap-2">
            <Button
              variant="outline"
              onClick={onRefuse}
              disabled={busy || isDone || locked}
              className="flex-1 gap-2"
            >
              <X className="size-4" /> Refuser
            </Button>
            <Button
              onClick={onValidate}
              disabled={busy || isDone || locked}
              className="flex-1 gap-2"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Valider
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
