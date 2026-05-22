import { TrendingUp } from 'lucide-react'
import { Bar, BarChart, XAxis, YAxis } from 'recharts'

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

type Props = {
  /** One entry per day of the current week (Mon→Sun), ordered. */
  perDay: { day: string; count: number }[]
  total: number
  target: number
}

// Même teinte emerald que le radial sourcing — cohérence visuelle des
// indicateurs "objectifs hebdo".
const chartConfig = {
  count: { label: 'Contacts', color: '#10b981' },
} satisfies ChartConfig

export function ContactsBar({ perDay, total, target }: Props) {
  const pct = target > 0 ? Math.round((total / target) * 100) : 0
  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle>Contacts clients</CardTitle>
        <CardDescription>
          {total} / {target} cette semaine ({pct}%)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[220px] w-full"
        >
          <BarChart
            accessibilityLayer
            data={perDay}
            layout="vertical"
            margin={{ top: 4, right: 12, bottom: 4, left: 0 }}
          >
            {/* domain figé sur l'objectif pour que la barre "max" reste
                comparable d'une semaine à l'autre. */}
            <XAxis
              type="number"
              dataKey="count"
              domain={[0, Math.max(target, 1)]}
              hide
            />
            <YAxis
              dataKey="day"
              type="category"
              tickLine={false}
              tickMargin={6}
              axisLine={false}
              width={32}
              tickFormatter={(v: string) => v.slice(0, 3)}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Bar dataKey="count" fill="var(--color-count)" radius={5} />
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-1 pt-2 text-xs text-muted-foreground">
        {total >= target ? (
          <div className="flex items-center gap-1 text-emerald-600">
            <TrendingUp className="size-3.5" />
            <span className="font-medium">Objectif atteint cette semaine.</span>
          </div>
        ) : (
          <p>
            Encore {target - total} contact{target - total > 1 ? 's' : ''} pour
            atteindre l'objectif.
          </p>
        )}
      </CardFooter>
    </Card>
  )
}
