import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import { UseFormReturn } from 'react-hook-form'
import { AppointmentFormValues } from './useAppointmentForm'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import { cn } from '@/shared/lib/utils'
import { AvailableSlots } from '@/modules/availability/components/AvailableSlots'
import { Schedule } from '@/shared/types'

interface DateTimeSelectionProps {
  form: UseFormReturn<AppointmentFormValues>
  isSpecificTimeSlot?: boolean
  currentMonth: Date
  setCurrentMonth: (date: Date) => void
  professionalId: string
  serviceId: string
  availableDates: string[] | null
  schedules: Schedule[]
  isLoadingSchedules: boolean
}

export const DateTimeSelection = ({
  form,
  isSpecificTimeSlot,
  currentMonth,
  setCurrentMonth,
  professionalId,
  serviceId,
  availableDates,
  schedules,
  isLoadingSchedules,
}: DateTimeSelectionProps) => {
  if (isSpecificTimeSlot) return null

  return (
    <>
      <div className="flex gap-4">
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel>Data</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={'outline'}
                      className={cn(
                        'w-full pl-3 text-left font-normal',
                        !field.value && 'text-muted-foreground',
                      )}
                    >
                      {field.value ? (
                        format(field.value, 'PPP', { locale: ptBR })
                      ) : (
                        <span>Escolha uma data</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    month={currentMonth}
                    onMonthChange={setCurrentMonth}
                    disabled={(day) => {
                      if (
                        day <
                        new Date(new Date().setHours(0, 0, 0, 0))
                      )
                        return true
                      if (
                        professionalId &&
                        serviceId &&
                        availableDates
                      ) {
                        return !availableDates.includes(
                          format(day, 'yyyy-MM-dd'),
                        )
                      }
                      return false
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={form.control}
        name="startTime"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Horário</FormLabel>
            <FormControl>
              <AvailableSlots
                schedules={schedules}
                isLoading={isLoadingSchedules}
                selectedSlotTime={field.value}
                onSlotSelect={(schedule) =>
                  field.onChange(schedule.start_time)
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  )
}
