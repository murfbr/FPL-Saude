import * as React from 'react'
import * as RechartsPrimitive from 'recharts'

import { cn } from '@/shared/lib/utils'

// --- Chart CONSTANTS ---
const THEMES = {
  light: '',
  dark: '.dark',
} as const

// --- Chart TYPES ---
export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
}

type ChartContextProps = {
  config: ChartConfig
}

// --- Chart CONTEXT ---
const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) {
    throw new Error('useChart must be used within a ChartContainer')
  }
  return context
}

// --- Chart COMPONENTS ---
const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    config: ChartConfig
    children: React.ComponentProps<
      typeof RechartsPrimitive.ResponsiveContainer
    >['children']
  }
>(({ id, className, children, config, ...props }, ref) => {
  const chartId = React.useId()
  const uniqueId = id || chartId

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={uniqueId}
        ref={ref}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/50 [&_.recharts-legend-item_text]:text-muted-foreground [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-reference-line_line]:stroke-border [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none [&_.recharts-tooltip-cursor]:stroke-border [&_.recharts-tooltip-wrapper]:rounded-lg [&_.recharts-tooltip-wrapper]:border [&_.recharts-tooltip-wrapper]:border-border [&_.recharts-tooltip-wrapper]:bg-background [&_.recharts-tooltip-wrapper]:p-2 [&_.recharts-tooltip-wrapper]:shadow-lg",
          className,
        )}
        {...props}
      >
        <ChartStyle id={uniqueId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
})
ChartContainer.displayName = 'ChartContainer'

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const style = React.useMemo(() => {
    if (!config) {
      return ''
    }
    return Object.entries(THEMES)
      .map(([theme, prefix]) => {
        const cssVars = Object.entries(config)
          .map(([key, value]) => {
            const color =
              value.theme?.[theme as keyof typeof THEMES] || value.color
            return color ? `  --color-${key}: ${color};` : null
          })
          .filter(Boolean)
          .join('\n')

        return cssVars ? `${prefix} [data-chart=${id}] {\n${cssVars}\n}` : null
      })
      .filter(Boolean)
      .join('\n')
  }, [id, config])

  return <style>{style}</style>
}

const ChartTooltip = RechartsPrimitive.Tooltip

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
    React.ComponentProps<'div'> & {
      hideLabel?: boolean
      hideIndicator?: boolean
      indicator?: 'line' | 'dot' | 'dashed'
      nameKey?: string
      labelKey?: string
    }
>(
  (
    {
      active,
      payload,
      className,
      indicator = 'dot',
      hideLabel,
      hideIndicator,
      label,
      labelFormatter,
      labelClassName,
      formatter,
      nameKey,
      labelKey,
    },
    ref,
  ) => {
    const { config } = useChart()

    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !payload || payload.length === 0) {
        return null
      }

      if (label) {
        return label
      }

      if (labelFormatter) {
        const name = payload[0].payload[labelKey || 'name']
        return labelFormatter(name, payload)
      }

      if (labelKey && payload[0].payload[labelKey]) {
        return payload[0].payload[labelKey]
      }

      if (payload[0].name) {
        return payload[0].name
      }

      return null
    }, [label, labelFormatter, payload, hideLabel, labelKey])

    if (!active || !payload || payload.length === 0) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn(
          'grid min-w-[8rem] items-stretch gap-1.5 rounded-lg border bg-background p-2.5 shadow-lg',
          className,
        )}
      >
        {!hideLabel && tooltipLabel ? (
          <div className={cn('font-medium', labelClassName)}>
            {tooltipLabel}
          </div>
        ) : null}
        <div className="grid gap-1.5">
          {payload.map((item, i) => {
            const key = `${nameKey || item.name || item.dataKey || 'value'}`
            const itemConfig = config[key]
            const indicatorColor = itemConfig?.color || item.color

            return (
              <div
                key={item.dataKey || i}
                className="flex w-full items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground"
              >
                {!hideIndicator && (
                  <div
                    className="flex w-2.5 shrink-0 items-center justify-center"
                    style={{ color: indicatorColor }}
                  >
                    {itemConfig?.icon ? (
                      <itemConfig.icon />
                    ) : indicator === 'dot' ? (
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: indicatorColor }}
                      />
                    ) : (
                      <div
                        className="w-full border-t-2"
                        style={{
                          borderColor: indicatorColor,
                          borderStyle: indicator,
                        }}
                      />
                    )}
                  </div>
                )}
                <div className="flex flex-1 justify-between leading-none">
                  <div className="grid gap-1.5">
                    <span className="text-muted-foreground">
                      {itemConfig?.label || item.name}
                    </span>
                  </div>
                  {item.value ? (
                    <span className="font-medium">
                      {formatter
                        ? formatter(item.value, item.name, item, i, payload)
                        : item.value.toString()}
                    </span>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  },
)
ChartTooltipContent.displayName = 'ChartTooltipContent'

const ChartLegend = RechartsPrimitive.Legend

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> &
    Pick<RechartsPrimitive.LegendProps, 'payload' | 'verticalAlign'> & {
      hideIcon?: boolean
      nameKey?: string
    }
>(
  (
    { className, hideIcon, payload, verticalAlign = 'bottom', nameKey },
    ref,
  ) => {
    const { config } = useChart()

    if (!payload || !payload.length) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center justify-center gap-4',
          verticalAlign === 'top' ? 'pb-3' : 'pt-3',
          className,
        )}
      >
        {payload.map((item) => {
          const key = `${nameKey || item.value}`
          const itemConfig = config[key]
          const color = itemConfig?.color || item.color

          return (
            <div
              key={item.value as string}
              className="flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3"
            >
              {!hideIcon && (
                <div
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: color }}
                />
              )}
              {itemConfig?.label || item.value}
            </div>
          )
        })}
      </div>
    )
  },
)
ChartLegendContent.displayName = 'ChartLegendContent'

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
}
