/** Shared color classes for the pipeline status groups (bar, cards, legend). */
export const GROUP_COLORS: Record<
  string,
  { dot: string; bar: string; text: string }
> = {
  'a-contacter': {
    dot: 'bg-slate-400',
    bar: 'bg-slate-400',
    text: 'text-slate-600 dark:text-slate-300',
  },
  'en-cours': {
    dot: 'bg-sky-500',
    bar: 'bg-sky-500',
    text: 'text-sky-700 dark:text-sky-300',
  },
  clients: {
    dot: 'bg-emerald-500',
    bar: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
  refus: {
    dot: 'bg-rose-400',
    bar: 'bg-rose-400',
    text: 'text-rose-600 dark:text-rose-300',
  },
}
