import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Client } from '@/shared/types'
import { getClientsWithBirthdayThisWeek } from '@/shared/services'
import { startOfWeek, endOfWeek, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Cake } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

export const BirthdaysList = () => {
  const [birthdays, setBirthdays] = useState<Client[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchBirthdays = async () => {
      setIsLoading(true)
      const today = new Date()
      const startDate = startOfWeek(today, { locale: ptBR })
      const endDate = endOfWeek(today, { locale: ptBR })

      const { data } = await getClientsWithBirthdayThisWeek(startDate, endDate)
      setBirthdays(data || [])
      setIsLoading(false)
    }
    fetchBirthdays()
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cake className="w-5 h-5 text-pink-500" />
          Aniversariantes da Semana
        </CardTitle>
        <CardDescription>
          Clientes celebrando aniversário nesta semana.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : birthdays.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum aniversariante nesta semana.
          </p>
        ) : (
          <ScrollArea className="max-h-[250px] pr-4">
            <ul className="space-y-3">
              {birthdays.map((client) => {
                if (!client.birth_date) return null
                const birthDate = parseISO(client.birth_date)

                // Determine if today is the birthday
                const today = new Date()
                const isToday =
                  birthDate.getDate() === today.getDate() &&
                  birthDate.getMonth() === today.getMonth()

                return (
                  <li
                    key={client.id}
                    className="flex items-center justify-between border-b last:border-0 pb-2 last:pb-0"
                  >
                    <div className="flex items-center gap-2">
                      {isToday && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500"></span>
                        </span>
                      )}
                      <span
                        className={`font-medium ${isToday ? 'text-primary' : ''}`}
                      >
                        {client.name}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground capitalize">
                      {format(birthDate, "dd 'de' MMMM", { locale: ptBR })}
                    </span>
                  </li>
                )
              })}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
