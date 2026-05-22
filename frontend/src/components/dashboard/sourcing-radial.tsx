import { PolarAngleAxis, RadialBar, RadialBarChart } from 'recharts'

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
  sourced: number
  sourcedTarget: number
  validated: number
  validatedTarget: number
}

// Palette emerald — alignée sur le badge "Ajouté", boutons Valider, etc.
const chartConfig = {
  sourced: { label: 'Sourcés', color: '#10b981' },
  validated: { label: 'Validés', color: '#047857' },
} satisfies ChartConfig

type Row = {
  key: 'sourced' | 'validated'
  label: string
  count: number
  target: number
  /** Normalised 0–100 — chaque target vaut 100 %, donc les deux anneaux
   *  partagent la même échelle visuelle. */
  value: number
  fill: string
}

export function SourcingRadial({
  sourced,
  sourcedTarget,
  validated,
  validatedTarget,
}: Props) {
  const data: Row[] = [
    {
      key: 'sourced',
      label: 'Sourcés',
      count: sourced,
      target: sourcedTarget,
      value: Math.min(100, (sourced / Math.max(sourcedTarget, 1)) * 100),
      fill: 'var(--color-sourced)',
    },
    {
      key: 'validated',
      label: 'Validés',
      count: validated,
      target: validatedTarget,
      value: Math.min(100, (validated / Math.max(validatedTarget, 1)) * 100),
      fill: 'var(--color-validated)',
    },
  ]

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>Sourcing</CardTitle>
        <CardDescription>Leads générés cette semaine</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[220px]"
        >
          <RadialBarChart
            data={data}
            startAngle={-90}
            endAngle={270}
            innerRadius={40}
            outerRadius={110}
          >
            {/* Force the angular domain to 0–100 so each ring is relative to
                its own target rather than the max value in the dataset. */}
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  nameKey="key"
                  // Recharts feeds the normalised `value` (0–100) — replace it
                  // by the absolute "count / target" pulled from the row payload.
                  formatter={(_value, _name, item) => {
                    const row = item?.payload as Row | undefined
                    if (!row) return null
                    return (
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: row.fill }}
                        />
                        <span className="text-foreground">{row.label}</span>
                        <span className="ml-auto font-mono tabular-nums">
                          {row.count} / {row.target}
                        </span>
                      </span>
                    )
                  }}
                />
              }
            />
            <RadialBar
              dataKey="value"
              background={{ fill: 'var(--muted)' }}
              cornerRadius={6}
            />
          </RadialBarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-1.5 pt-2 text-xs text-muted-foreground">
        <div className="flex w-full items-center justify-around">
          {data.map((r) => (
            <div key={r.key} className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ background: r.fill }}
              />
              <span className="text-foreground font-medium tabular-nums">
                {r.count}
              </span>
              <span className="text-muted-foreground tabular-nums">
                / {r.target}
              </span>
              <span className="ml-0.5">{r.label.toLowerCase()}</span>
            </div>
          ))}
        </div>
      </CardFooter>
    </Card>
  )
}
