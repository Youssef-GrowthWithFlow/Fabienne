import {
  Building2,
  ChevronLeft,
  ExternalLink,
  Globe,
  Loader2,
  Map as MapIcon,
  Phone,
  Sparkles,
  Star,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { RichTextEditor } from '@/components/rich-text-editor'
import { SignalBadge } from '@/components/signal-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { WithSourceTooltip } from '@/components/with-source-tooltip'
import { useEntreprises } from '@/hooks/use-entreprises'
import { useProspects } from '@/hooks/use-prospects'
import { useSegments } from '@/hooks/use-segments'
import { regenerateEntrepriseFiche } from '@/lib/entreprises-api'
import type { EntrepriseRecord } from '@/lib/entreprises'
import { SEGMENT_NONE } from '@/lib/segment-constants'

type Props = {
  entreprise: EntrepriseRecord
  onClose: () => void
}

export function EntrepriseSheet({ entreprise: ent, onClose }: Props) {
  const { updateEntreprise, deleteEntreprise, ingestMany } = useEntreprises()
  const { segments, briefs } = useSegments()
  const { prospects } = useProspects()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
    setRegenerating(false)
  }, [ent.id])

  const update = <K extends keyof EntrepriseRecord>(
    key: K,
    value: EntrepriseRecord[K],
  ) => {
    updateEntreprise(ent.id, { [key]: value } as Partial<EntrepriseRecord>)
  }

  const attachedProspects = useMemo(
    () => prospects.filter((p) => p.entrepriseId === ent.id),
    [prospects, ent.id],
  )

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      const updated = await regenerateEntrepriseFiche(ent.id)
      ingestMany([updated])
      toast.success('Fiche régénérée.')
    } catch {
      toast.error('Échec de la régénération.')
    } finally {
      setRegenerating(false)
    }
  }

  const confirmDelete = () => {
    setDeleteOpen(false)
    deleteEntreprise(ent.id)
    onClose()
  }

  const sources = ent.fieldSources
  const subtitle =
    [ent.codePostal, ent.ville].filter(Boolean).join(' ') || '—'

  return (
    <Sheet
      open
      modal={false}
      onOpenChange={(o, details) => {
        if (o) return
        if (
          details?.reason === 'close-press' ||
          details?.reason === 'escape-key'
        ) {
          onClose()
        }
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex !w-full flex-col gap-0 p-0 sm:!max-w-none lg:!w-[55vw]"
      >
        {/* Header --------------------------------------------------------- */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b px-2 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="gap-1.5"
          >
            <ChevronLeft className="size-4" />
            Retour
          </Button>
          <span className="truncate px-2 text-sm font-medium text-muted-foreground">
            {ent.entreprise || 'Sans nom'}
          </span>
        </div>

        <Tabs
          defaultValue="coordonnees"
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <div className="border-b px-4 sm:px-6 pt-3 pb-2">
            <TabsList>
              <TabsTrigger value="coordonnees">Coordonnées</TabsTrigger>
              <TabsTrigger value="fiche-client">Fiche entreprise</TabsTrigger>
              <TabsTrigger value="contacts">
                Contacts{attachedProspects.length > 0 && ` (${attachedProspects.length})`}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Coordonnées --------------------------------------------------- */}
          <TabsContent
            value="coordonnees"
            className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 sm:px-6 py-4"
          >
            <Field icon={Building2} label="Nom" source={sources?.entreprise}>
              <Input
                value={ent.entreprise}
                onChange={(e) => update('entreprise', e.target.value)}
                placeholder="Raison sociale"
                className="h-9"
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Code postal" source={sources?.code_postal}>
                <Input
                  value={ent.codePostal}
                  onChange={(e) => update('codePostal', e.target.value)}
                  className="h-9"
                />
              </Field>
              <Field label="Ville" source={sources?.ville}>
                <Input
                  value={ent.ville}
                  onChange={(e) => update('ville', e.target.value)}
                  className="h-9"
                />
              </Field>
            </div>

            <Field label="Adresse" source={sources?.adresse}>
              <Input
                value={ent.adresse}
                onChange={(e) => update('adresse', e.target.value)}
                placeholder="Numéro, voie"
                className="h-9"
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Secteur" source={sources?.secteur ?? sources?.naf_label}>
                <Input
                  value={ent.secteur}
                  onChange={(e) => update('secteur', e.target.value)}
                  className="h-9"
                />
              </Field>
              <Field label="Taille" source={sources?.effectif ?? sources?.taille}>
                <Input
                  value={ent.effectif || ent.taille}
                  onChange={(e) => update('taille', e.target.value)}
                  placeholder="Ex. 11-50"
                  className="h-9"
                />
              </Field>
            </div>

            <Field label="Segment">
              <Select
                value={ent.segmentId ?? SEGMENT_NONE}
                onValueChange={(v) =>
                  update(
                    'segmentId',
                    typeof v === 'string' && v !== SEGMENT_NONE ? v : null,
                  )
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEGMENT_NONE}>Sans segment</SelectItem>
                  {segments.map((s) => (
                    <SelectItem key={s} value={s}>
                      {briefs[s]?.nom ?? s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field icon={Globe} label="Site web" source={sources?.site_web}>
              <Input
                type="url"
                value={ent.siteWeb}
                onChange={(e) => update('siteWeb', e.target.value)}
                placeholder="https://…"
                className="h-9"
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field icon={Phone} label="Téléphone" source={sources?.telephone}>
                <Input
                  type="tel"
                  value={ent.telephone}
                  onChange={(e) => update('telephone', e.target.value)}
                  className="h-9"
                />
              </Field>
              <Field label="LinkedIn">
                <Input
                  type="url"
                  value={ent.linkedin}
                  onChange={(e) => update('linkedin', e.target.value)}
                  placeholder="https://linkedin.com/company/…"
                  className="h-9"
                />
              </Field>
            </div>

            {/* Identité SIRET / SIREN / NAF (read-only quand vide non-éditable) */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="SIRET" source={sources?.siret}>
                <Input
                  value={ent.siret ?? ''}
                  onChange={(e) => update('siret', e.target.value || null)}
                  placeholder="14 chiffres"
                  className="h-9 font-mono"
                />
              </Field>
              <Field label="SIREN" source={sources?.siren}>
                <Input
                  value={ent.siren ?? ''}
                  onChange={(e) => update('siren', e.target.value || null)}
                  className="h-9 font-mono"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Code NAF">
                <Input
                  value={ent.nafCode ?? ''}
                  onChange={(e) => update('nafCode', e.target.value || null)}
                  className="h-9 font-mono"
                />
              </Field>
              <Field label="Libellé NAF">
                <Input
                  value={ent.nafLabel ?? ''}
                  onChange={(e) => update('nafLabel', e.target.value || null)}
                  className="h-9"
                />
              </Field>
            </div>

            {/* Signaux entreprise (lecture) */}
            {ent.signaux && ent.signaux.length > 0 && (
              <Field label="Signaux">
                <div className="flex flex-wrap gap-1.5">
                  {ent.signaux.map((s, i) => (
                    <SignalBadge key={i}>{s}</SignalBadge>
                  ))}
                </div>
              </Field>
            )}

            {/* Dirigeants (lecture) */}
            {ent.dirigeants && ent.dirigeants.length > 0 && (
              <Field label="Dirigeants" source={sources?.dirigeants}>
                <ul className="flex flex-col gap-1 text-sm">
                  {ent.dirigeants.map((d, i) => (
                    <li key={i}>
                      <span className="font-medium">{d.nom}</span>
                      {d.qualite && (
                        <span className="text-muted-foreground">
                          {' '}
                          · {d.qualite}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </Field>
            )}

            {/* Google Maps + rating ----------------------------------------- */}
            {(ent.googleMapsUrl || ent.googleRating != null) && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {ent.googleMapsUrl && (
                  <Field label="Google Maps" source={sources?.google_maps_url}>
                    <a
                      href={ent.googleMapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-foreground hover:underline"
                    >
                      <MapIcon className="size-3.5 text-muted-foreground" />
                      Ouvrir
                      <ExternalLink className="size-3 text-muted-foreground" />
                    </a>
                  </Field>
                )}
                {ent.googleRating != null && (
                  <Field label="Avis Google" source={sources?.google_rating}>
                    <div className="inline-flex items-center gap-1.5 text-sm">
                      <Star className="size-3.5 fill-amber-400 text-amber-400" />
                      <span className="font-medium">
                        {ent.googleRating.toFixed(1)}
                      </span>
                      {ent.googleRatingCount != null && (
                        <span className="text-muted-foreground">
                          ({ent.googleRatingCount} avis)
                        </span>
                      )}
                    </div>
                  </Field>
                )}
              </div>
            )}

            {/* Note libre --------------------------------------------------- */}
            <Field label="Note">
              <textarea
                value={ent.note}
                onChange={(e) => update('note', e.target.value)}
                placeholder="Notes internes"
                rows={3}
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              />
            </Field>
          </TabsContent>

          {/* Fiche client -------------------------------------------------- */}
          <TabsContent
            value="fiche-client"
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6 pt-3 pb-3">
              {ent.ficheClient ? (
                <RichTextEditor
                  value={ent.ficheClient}
                  onChange={(html) => update('ficheClient', html)}
                  editable
                />
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-muted/20 py-10 text-center text-sm text-muted-foreground">
                  <p>Aucune fiche générée pour cette entreprise.</p>
                  <Button
                    size="sm"
                    onClick={handleRegenerate}
                    disabled={regenerating}
                    className="gap-1.5"
                  >
                    {regenerating ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="size-3.5" />
                    )}
                    Générer la fiche
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Contacts ------------------------------------------------------ */}
          <TabsContent
            value="contacts"
            className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 sm:px-6 py-4"
          >
            {attachedProspects.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Aucun contact rattaché à cette entreprise.
              </p>
            ) : (
              <ul className="flex flex-col divide-y">
                {attachedProspects.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-start gap-2 py-2 text-sm"
                  >
                    <Users className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{p.nom || '—'}</div>
                      <div className="text-muted-foreground text-xs">
                        {p.role}
                        {p.email && ` · ${p.email}`}
                        {p.telephone && ` · ${p.telephone}`}
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {p.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>

        {/* Footer ---------------------------------------------------------- */}
        <div className="shrink-0 space-y-2 border-t px-4 py-3 sm:px-6">
          <div className="text-xs text-muted-foreground">
            {subtitle}
            {ent.dateCreation && ` · créée le ${ent.dateCreation}`}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            className="w-full gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" />
            Supprimer
          </Button>
        </div>
      </SheetContent>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'entreprise ?</AlertDialogTitle>
            <AlertDialogDescription>
              {ent.entreprise || 'Cette entreprise'} sera retirée définitivement.
              Les contacts rattachés perdent leur lien.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <X className="size-4" /> Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              <Trash2 className="size-4" /> Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}

function Field({
  icon: Icon,
  label,
  source,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>
  label: string
  source?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
        {Icon && <Icon className="size-3" />}
        <WithSourceTooltip source={source}>{label}</WithSourceTooltip>
      </div>
      {children}
    </div>
  )
}
