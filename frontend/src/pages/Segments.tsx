import { Plus } from 'lucide-react'
import { useState } from 'react'

import { CreateSegmentDialog } from '@/components/create-segment-dialog'
import { SegmentSheet } from '@/components/segment-sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useSegments } from '@/hooks/use-segments'
import { type Segment } from '@/lib/prospects'

const MAX_PREVIEW_TAGS = 4

export function Segments() {
  const { segments, getBrief, addSegment } = useSegments()
  const [openSegment, setOpenSegment] = useState<Segment | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const handleCreate = async (input: { nom: string; description: string }) => {
    const id = await addSegment(input)
    if (id) setOpenSegment(id)
  }

  return (
    <>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Tes segments</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Une fiche par type de client à viser — c'est ce qui nourrit la
          recherche de prospects.
        </p>
      </div>

      <Button
        onClick={() => setCreateOpen(true)}
        className="w-full sm:w-fit"
      >
        <Plus className="size-4" />
        Nouveau segment
      </Button>

      <CreateSegmentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {segments.map((segment) => {
          const brief = getBrief(segment)
          const visibleTags = brief.postes.slice(0, MAX_PREVIEW_TAGS)
          const extra = brief.postes.length - visibleTags.length
          return (
            <button
              key={segment}
              type="button"
              onClick={() => setOpenSegment(segment)}
              className="flex flex-col gap-3 rounded-lg border bg-card p-5 text-left shadow-sm transition-colors hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <h2 className="text-base font-semibold leading-tight">
                {brief.nom || 'Sans nom'}
              </h2>

              {brief.description ? (
                <p className="text-sm text-muted-foreground">
                  {brief.description}
                </p>
              ) : null}

              {visibleTags.length > 0 ? (
                <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                  {visibleTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="font-normal"
                    >
                      {tag}
                    </Badge>
                  ))}
                  {extra > 0 ? (
                    <Badge variant="outline" className="font-normal">
                      +{extra}
                    </Badge>
                  ) : null}
                </div>
              ) : null}
            </button>
          )
        })}
      </div>

      <SegmentSheet
        segment={openSegment}
        onClose={() => setOpenSegment(null)}
      />
    </>
  )
}
