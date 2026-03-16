import { Schedule } from '@/shared/types'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatInTimeZone, cn } from '@/shared/lib/utils'

interface AvailableSlotsProps {
  schedules: Schedule[] | null
  isLoading: boolean
  onSlotSelect: (schedule: Schedule) => void
  selectedSlotTime?: string | null
}

export const AvailableSlots = ({
  schedules,
  isLoading,
  onSlotSelect,
  selectedSlotTime,
}: AvailableSlotsProps) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (!schedules || schedules.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8 border border-dashed rounded-lg bg-gray-50">
        <p>Nenhum horário disponível para esta data.</p>
        <p className="text-sm mt-1">Por favor, selecione outro dia.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {schedules.map((schedule) => {
        const isSelected = selectedSlotTime === schedule.start_time
        const maxCapacity = schedule.max_capacity || 1
        const currentCount = schedule.current_count || 0
        const isPartial = currentCount > 0 && currentCount < maxCapacity
        const spotsLeft = maxCapacity - currentCount

        // Show capacity text if it's a group session (max > 1)
        const showCapacity = maxCapacity > 1

        return (
          <Button
            key={schedule.start_time}
            variant={isSelected ? 'default' : 'outline'}
            className={cn(
              'flex flex-col items-center h-auto py-2 px-1 gap-0.5 relative overflow-hidden transition-all',
              isSelected && 'ring-2 ring-primary ring-offset-2',
              // Visual treatment for partially full slots
              isPartial &&
                !isSelected &&
                'border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-950',
              // Regular slots
              !isPartial &&
                !isSelected &&
                'hover:bg-accent hover:text-accent-foreground',
            )}
            onClick={() => onSlotSelect(schedule)}
            type="button"
          >
            {/* Start Time */}
            <span className="text-sm font-semibold">
              {formatInTimeZone(schedule.start_time, 'HH:mm')}
            </span>

            {/* Capacity Indicator */}
            {showCapacity && (
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full mt-0.5 font-medium leading-none',
                  isSelected
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : isPartial
                      ? 'bg-orange-200 text-orange-900'
                      : 'bg-gray-100 text-gray-500',
                )}
              >
                {spotsLeft} {spotsLeft === 1 ? 'vaga' : 'vagas'}
              </span>
            )}
          </Button>
        )
      })}
    </div>
  )
}
