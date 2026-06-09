import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function SignalBadge({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'border-primary/20 bg-primary/[0.04] font-normal',
        className,
      )}
    >
      {children}
    </Badge>
  )
}
