import { useEffect, useState } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Trash2,
  PlusCircle,
  ChevronsUpDown,
  Check,
  Loader2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  getRecurringAvailability,
  setRecurringAvailability,
} from '@/services/availability'
import { getServicesByProfessional } from '@/services'
import { Skeleton } from '@/components/ui/skeleton'
import { Service } from '@/types'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'

const timeSlotSchema = z.object({
  start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  service_ids: z.array(z.string()).nullable(),
})

const daySchema = z.object({
  day_of_week: z.number(),
  enabled: z.boolean(),
  slots: z.array(timeSlotSchema),
})

const availabilitySchema = z.object({
  days: z.array(daySchema),
})

type AvailabilityFormValues = z.infer<typeof availabilitySchema>

const weekDays = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
]

interface AvailabilitySettingsProps {
  professionalId: string
}

export const AvailabilitySettings = ({
  professionalId,
}: AvailabilitySettingsProps) => {
  const { toast } = useToast()
  const [services, setServices] = useState<Service[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const {
    control,
    handleSubmit,
    reset,
    formState: { isLoading },
  } = useForm<AvailabilityFormValues>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: {
      days: weekDays.map((_, index) => ({
        day_of_week: index,
        enabled: false,
        slots: [],
      })),
    },
  })

  const { fields } = useFieldArray({ control, name: 'days' })

  useEffect(() => {
    async function loadData() {
      const [availRes, servicesRes] = await Promise.all([
        getRecurringAvailability(professionalId),
        getServicesByProfessional(professionalId),
      ])
      setServices(servicesRes.data || [])
      const newDays = weekDays.map((_, index) => {
        const daySlots =
          availRes.data
            ?.filter((slot) => slot.day_of_week === index)
            .map((slot) => ({
              start_time: slot.start_time.slice(0, 5),
              end_time: slot.end_time.slice(0, 5),
              service_ids: slot.service_ids,
            })) || []
        return {
          day_of_week: index,
          enabled: daySlots.length > 0,
          slots: daySlots,
        }
      })
      reset({ days: newDays })
    }
    loadData()
  }, [professionalId, reset])

  const onSubmit = async (data: AvailabilityFormValues) => {
    setIsProcessing(true)
    const availabilities = data.days
      .filter((day) => day.enabled)
      .flatMap((day) =>
        day.slots.map((slot) => ({
          day_of_week: day.day_of_week,
          start_time: `${slot.start_time}:00`,
          end_time: `${slot.end_time}:00`,
          service_ids: slot.service_ids,
        })),
      )

    const { error } = await setRecurringAvailability(
      professionalId,
      availabilities,
    )

    if (error) {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível atualizar sua disponibilidade.',
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Disponibilidade salva',
        description: 'Seus novos horários foram atualizados.',
      })
    }
    setIsProcessing(false)
  }

  if (isLoading) return <Skeleton className="h-96 w-full" />

  return (
    <Card>
      <CardHeader>
        <CardTitle>Horário de Trabalho Semanal</CardTitle>
        <CardDescription>
          Defina seus horários e os serviços específicos para cada um. Se nenhum
          serviço for selecionado, todos estarão disponíveis.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-6">
          {fields.map((field, dayIndex) => (
            <div key={field.id} className="space-y-3">
              <div className="flex items-center space-x-3">
                <Controller
                  name={`days.${dayIndex}.enabled`}
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id={`day-${dayIndex}-enabled`}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label
                  htmlFor={`day-${dayIndex}-enabled`}
                  className="text-lg font-medium"
                >
                  {weekDays[dayIndex]}
                </Label>
              </div>
              <Controller
                name={`days.${dayIndex}.enabled`}
                control={control}
                render={({ field: enabledField }) =>
                  enabledField.value && (
                    <div className="pl-8 space-y-2">
                      <Controller
                        name={`days.${dayIndex}.slots`}
                        control={control}
                        render={({ field: { value: slots, onChange } }) => (
                          <>
                            {slots.map((slot, slotIndex) => (
                              <div
                                key={slotIndex}
                                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                              >
                                <div className="flex-1 flex items-center gap-2">
                                  <Controller
                                    name={`days.${dayIndex}.slots.${slotIndex}.start_time`}
                                    control={control}
                                    render={({ field }) => (
                                      <Input type="time" {...field} />
                                    )}
                                  />
                                  <span>-</span>
                                  <Controller
                                    name={`days.${dayIndex}.slots.${slotIndex}.end_time`}
                                    control={control}
                                    render={({ field }) => (
                                      <Input type="time" {...field} />
                                    )}
                                  />
                                </div>
                                <div className="flex-1 flex items-center gap-2">
                                  <Controller
                                    name={`days.${dayIndex}.slots.${slotIndex}.service_ids`}
                                    control={control}
                                    render={({ field }) => (
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <Button
                                            variant="outline"
                                            role="combobox"
                                            className="w-full sm:w-[200px] justify-between"
                                          >
                                            {field.value &&
                                            field.value.length > 0
                                              ? `${field.value.length} serviço(s)`
                                              : 'Todos os serviços'}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[200px] p-0">
                                          <Command>
                                            <CommandInput placeholder="Buscar serviço..." />
                                            <CommandList>
                                              <CommandEmpty>
                                                Nenhum serviço encontrado.
                                              </CommandEmpty>
                                              <CommandGroup>
                                                {services.map((service) => (
                                                  <CommandItem
                                                    key={service.id}
                                                    value={service.name}
                                                    onSelect={() => {
                                                      const currentIds =
                                                        field.value || []
                                                      const newIds =
                                                        currentIds.includes(
                                                          service.id,
                                                        )
                                                          ? currentIds.filter(
                                                              (id) =>
                                                                id !==
                                                                service.id,
                                                            )
                                                          : [
                                                              ...currentIds,
                                                              service.id,
                                                            ]
                                                      field.onChange(newIds)
                                                    }}
                                                  >
                                                    <Check
                                                      className={cn(
                                                        'mr-2 h-4 w-4',
                                                        field.value?.includes(
                                                          service.id,
                                                        )
                                                          ? 'opacity-100'
                                                          : 'opacity-0',
                                                      )}
                                                    />
                                                    {service.name}
                                                  </CommandItem>
                                                ))}
                                              </CommandGroup>
                                            </CommandList>
                                          </Command>
                                        </PopoverContent>
                                      </Popover>
                                    )}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      const newSlots = [...slots]
                                      newSlots.splice(slotIndex, 1)
                                      onChange(newSlots)
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                onChange([
                                  ...slots,
                                  {
                                    start_time: '09:00',
                                    end_time: '17:00',
                                    service_ids: null,
                                  },
                                ])
                              }
                            >
                              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar
                              Intervalo
                            </Button>
                          </>
                        )}
                      />
                    </div>
                  )
                }
              />
            </div>
          ))}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isProcessing}>
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isProcessing ? 'Processando...' : 'Salvar Disponibilidade'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
