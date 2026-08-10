import { useState, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getAllProfessionals } from '@/shared/services'
import { upsertTimeRecord } from '@/modules/time-tracking/service'
import { Professional } from '@/shared/types'
import { useToast } from '@/shared/hooks/use-toast'
import { Loader2, PlusCircle } from 'lucide-react'
import { format } from 'date-fns'

interface AdminTimeEntryProps {
  onSuccess: () => void
}

export const AdminTimeEntry = ({ onSuccess }: AdminTimeEntryProps) => {
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [selectedProfessional, setSelectedProfessional] = useState<string>('')
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [clockIn, setClockIn] = useState<string>('08:00')
  const [clockOut, setClockOut] = useState<string>('17:00')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    // Only fetch active professionals for manual entry to ensure reliable data entry
    getAllProfessionals({ activeOnly: true }).then(({ data }) => {
      setProfessionals(data || [])
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProfessional || !date || !clockIn) {
      toast({
        title: 'Dados incompletos',
        description: 'Selecione o profissional, data e horário de entrada.',
        variant: 'destructive',
      })
      return
    }

    if (clockOut && clockOut <= clockIn) {
      toast({
        title: 'Horário inválido',
        description: 'O horário de saída deve ser depois do horário de entrada.',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    try {
      // Append :00 for seconds to match TIME format in Supabase
      const formattedClockIn = clockIn.length === 5 ? `${clockIn}:00` : clockIn
      const formattedClockOut =
        clockOut && clockOut.length === 5 ? `${clockOut}:00` : clockOut

      const { error } = await upsertTimeRecord(
        selectedProfessional,
        date,
        formattedClockIn,
        formattedClockOut || null,
      )

      if (error) {
        toast({
          title: 'Erro ao registrar ponto',
          description: error.message,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Ponto registrado com sucesso!',
          description: 'O registro foi salvo na base de dados.',
        })
        onSuccess()
        // We do not clear professional or date to allow easier bulk entry for same person/day
      }
    } catch (err: any) {
      console.error('Submission error:', err)
      toast({
        title: 'Erro inesperado',
        description: 'Ocorreu um erro ao processar a solicitação.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="mb-8 border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Registro Manual de Ponto</CardTitle>
        <CardDescription>
          Adicione ou corrija registros de horas para profissionais ativos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end"
        >
          <div className="space-y-2 md:col-span-2">
            <Label>Profissional</Label>
            <Select
              value={selectedProfessional}
              onValueChange={setSelectedProfessional}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {professionals.length === 0 ? (
                  <SelectItem value="none" disabled>
                    Nenhum profissional ativo
                  </SelectItem>
                ) : (
                  professionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Entrada</Label>
              <Input
                type="time"
                value={clockIn}
                onChange={(e) => setClockIn(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Saída</Label>
              <Input
                type="time"
                value={clockOut}
                onChange={(e) => setClockOut(e.target.value)}
              />
            </div>
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <PlusCircle className="mr-2 h-4 w-4" />
                Registrar
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
