import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { db } from '@/shared/lib/firebase'
import { collection, getDocs, doc, getDoc, writeBatch } from 'firebase/firestore'
import { useToast } from '@/shared/hooks/use-toast'
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react'

const COMPANY_ID = 'fpl-saude'

export const DataMaintenance = () => {
  const { toast } = useToast()
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState('')

  const migrateAppointments = async () => {
    setIsRunning(true)
    setProgress('Iniciando migração...')
    try {
      const apptsRef = collection(db, 'companies', COMPANY_ID, 'appointments')
      const snapshot = await getDocs(apptsRef)
      
      setProgress(`Encontrados ${snapshot.size} agendamentos. Processando...`)
      
      let processed = 0
      let batch = writeBatch(db)
      let batchCount = 0

      for (const d of snapshot.docs) {
        const data = d.data()
        
        // Se já estiver denormalizado, pula
        if (data.clients?.name && data.professionals?.name && data.services?.name) {
          processed++
          continue
        }

        const [clientSnap, profSnap, serviceSnap] = await Promise.all([
          getDoc(doc(db, 'companies', COMPANY_ID, 'clients', data.client_id)),
          getDoc(doc(db, 'companies', COMPANY_ID, 'professionals', data.professional_id)),
          getDoc(doc(db, 'companies', COMPANY_ID, 'services', data.service_id))
        ])

        const updates: any = {
          clients: { 
            id: data.client_id, 
            name: clientSnap.data()?.name, 
            email: clientSnap.data()?.email, 
            phone: clientSnap.data()?.phone 
          },
          professionals: { 
            id: data.professional_id, 
            name: profSnap.data()?.name 
          },
          services: { 
            id: data.service_id, 
            name: serviceSnap.data()?.name, 
            duration_minutes: serviceSnap.data()?.duration_minutes,
            price: serviceSnap.data()?.price,
            value_type: serviceSnap.data()?.value_type
          }
        }

        // Add schedules if missing end_time
        if (data.schedules?.start_time && !data.schedules.end_time) {
          const duration = serviceSnap.data()?.duration_minutes || 60
          updates.schedules = {
            ...data.schedules,
            end_time: new Date(new Date(data.schedules.start_time).getTime() + duration * 60000).toISOString()
          }
        }

        batch.update(d.ref, updates)
        batchCount++
        processed++

        setProgress(`Formatando: ${processed}/${snapshot.size}...`)

        if (batchCount >= 50) {
          await batch.commit()
          batch = writeBatch(db)
          batchCount = 0
        }
      }

      if (batchCount > 0) {
        await batch.commit()
      }

      toast({
        title: 'Migração concluída',
        description: `${processed} agendamentos atualizados com sucesso.`
      })
    } catch (error: any) {
      console.error(error)
      toast({
        title: 'Erro na migração',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setIsRunning(false)
      setProgress('')
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Manutenção de Dados (NoSQL Optimizations)
          </CardTitle>
          <CardDescription>
            Ferramentas para otimizar o banco de dados e reduzir o consumo de reads.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg bg-orange-50 border-orange-100 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-orange-800 font-medium">
                <AlertTriangle className="h-4 w-4" />
                <span>Fix Appointments (Denormalization)</span>
              </div>
              <p className="text-sm text-orange-700">
                Atualiza agendamentos antigos salvando nomes de clientes e profissionais diretamente no documento.
                Isso reduz drasticamente os reads na agenda.
              </p>
            </div>
            <Button 
              onClick={migrateAppointments} 
              disabled={isRunning}
              variant="outline"
              className="bg-white hover:bg-orange-100 shrink-0"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Atualizando...
                </>
              ) : (
                'Corrigir Agendamentos'
              )}
            </Button>
          </div>
          {isRunning && (
            <p className="text-xs font-mono text-muted-foreground animate-pulse">
              {progress}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
