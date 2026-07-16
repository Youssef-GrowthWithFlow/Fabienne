import DOMPurify from 'dompurify'
import { ExternalLink } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

type SourceRef = { uri: string; title: string }

type Popover = {
  top: number
  left: number
  sources: SourceRef[]
}

const PROSE_CLASSES = cn(
  '[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold',
  '[&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold',
  '[&_p]:my-2 [&_p]:leading-relaxed',
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5',
  '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
  '[&_li]:my-0.5',
  '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
  // Grounded segments: dotted violet underline — hover reveals the sources.
  '[&_span.grounded]:cursor-help [&_span.grounded]:underline [&_span.grounded]:decoration-dotted [&_span.grounded]:decoration-violet-400 [&_span.grounded]:underline-offset-3 [&_span.grounded:hover]:bg-violet-50 dark:[&_span.grounded:hover]:bg-violet-950/40',
)

function hostnameOf(uri: string): string {
  try {
    return new URL(uri).hostname.replace(/^www\./, '')
  } catch {
    return uri
  }
}

/**
 * Renders an AI fiche. Sentences backed by Google-Search grounding carry
 * `<span class="grounded" data-sources>` (added server-side): hovering one
 * shows a small panel with the clickable sources it came from.
 */
export function FicheHtml({ html }: { html: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<number | null>(null)
  const [popover, setPopover] = useState<Popover | null>(null)

  const safeHtml = useMemo(
    () =>
      DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
          'h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'span', 'br',
        ],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'data-sources'],
      }),
    [html],
  )

  const cancelHide = () => {
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }

  const scheduleHide = () => {
    cancelHide()
    hideTimer.current = window.setTimeout(() => setPopover(null), 250)
  }

  const handleOver = (e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest?.('span.grounded')
    if (!target || !containerRef.current) return
    cancelHide()
    let sources: SourceRef[]
    try {
      sources = JSON.parse(target.getAttribute('data-sources') ?? '[]')
    } catch {
      return
    }
    if (sources.length === 0) return
    const rect = target.getBoundingClientRect()
    const containerRect = containerRef.current.getBoundingClientRect()
    setPopover({
      top: rect.bottom - containerRect.top + 6,
      left: Math.max(0, rect.left - containerRect.left),
      sources,
    })
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className={cn('text-sm', PROSE_CLASSES)}
        onMouseOver={handleOver}
        onMouseLeave={scheduleHide}
        // Sanitized above with an explicit allowlist.
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
      {popover ? (
        <div
          role="tooltip"
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
          className="bg-popover absolute z-50 max-w-xs rounded-lg border p-2 shadow-md"
          style={{ top: popover.top, left: Math.min(popover.left, 260) }}
        >
          <div className="text-muted-foreground mb-1 px-1 text-[10px] font-medium uppercase tracking-wide">
            Sources de cette info
          </div>
          <div className="flex flex-col">
            {popover.sources.map((s, i) => (
              <a
                key={i}
                href={s.uri}
                target="_blank"
                rel="noreferrer"
                className="hover:bg-muted flex items-center gap-1.5 rounded px-1.5 py-1 text-xs"
              >
                <ExternalLink className="text-muted-foreground size-3 shrink-0" />
                <span className="truncate">
                  {s.title || hostnameOf(s.uri)}
                </span>
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
