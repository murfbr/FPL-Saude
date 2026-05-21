import { Repeat } from 'lucide-react'
import { UseFormReturn } from 'react-hook-form'
import { AppointmentFormValues } from './useAppointmentForm'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { cn } from '@/shared/lib/utils'
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'

interface RecurringOptionsProps {
  form: UseFormReturn<AppointmentFormValues>
  isRecurring: boolean
  availableWeekdays: number[] | null
}

export const RecurringOptions = ({ form, isRecurring, availableWeekdays }: RecurringOptionsProps) => {
  return (
    <div className="space-y-2">
      <FormField
        control={form.control}
        name="isRecurring"
        render={({ field }) => (
          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-muted/20">
            <FormControl>
              <Checkbox
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <div className="space-y-1 leading-none w-full">
              <FormLabel className="flex items-center gap-2">
                <Repeat className="w-4 h-4 text-primary" />
                Repetir semanalmente
              </FormLabel>
            </div>
          </FormItem>
        )}
      />

      {isRecurring && (
        <div className="space-y-4 border rounded-md p-4 bg-muted/10">
          <FormField
            control={form.control}
            name="recurrenceDays"
            render={() => (
              <FormItem>
                <div className="mb-2">
                  <FormLabel className="text-sm font-medium">Dias da Semana</FormLabel>
                </div>
                <div className="flex flex-wrap gap-4">
                  {[
                    { id: 1, label: 'Seg' },
                    { id: 2, label: 'Ter' },
                    { id: 3, label: 'Qua' },
                    { id: 4, label: 'Qui' },
                    { id: 5, label: 'Sex' },
                    { id: 6, label: 'Sáb' },
                    { id: 0, label: 'Dom' },
                  ].map((day) => (
                    <FormField
                      key={day.id}
                      control={form.control}
                      name="recurrenceDays"
                      render={({ field }) => {
                        return (
                          <FormItem
                            key={day.id}
                            className="flex flex-row items-center space-x-1 space-y-0"
                          >
                            <FormControl>
                              <Checkbox
                                disabled={availableWeekdays !== null && !availableWeekdays.includes(day.id === 0 ? 7 : day.id)}
                                checked={field.value?.includes(day.id)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...(field.value || []), day.id])
                                    : field.onChange(
                                        field.value?.filter(
                                          (value) => value !== day.id
                                        )
                                      )
                                }}
                              />
                            </FormControl>
                            <FormLabel 
                              className={cn(
                                "font-normal text-sm",
                                (availableWeekdays !== null && !availableWeekdays.includes(day.id === 0 ? 7 : day.id)) 
                                ? "text-muted-foreground cursor-not-allowed" 
                                : "cursor-pointer"
                              )}
                            >
                              {day.label}
                            </FormLabel>
                          </FormItem>
                        )
                      }}
                    />
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="recurrenceWeeks"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex justify-between">
                  Duração da Recorrência
                  <span className="text-xs text-muted-foreground font-normal">
                    Max: 52 semanas
                  </span>
                </FormLabel>
                <div className="flex gap-2 items-center">
                  <FormControl>
                    <Input
                      type="number"
                      min={2}
                      max={52}
                      className="w-24"
                      {...field}
                    />
                  </FormControl>
                  <span className="text-sm text-muted-foreground">
                    semanas
                  </span>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </div>
  )
}
