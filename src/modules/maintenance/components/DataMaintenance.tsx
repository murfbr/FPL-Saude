import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { db } from '@/shared/lib/firebase'
import { collection, getDocs, doc, getDoc, writeBatch, query, where } from 'firebase/firestore'
import { useToast } from '@/shared/hooks/use-toast'
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react'
import { getCompanyId } from '@/shared/lib/tenantStore'

export const DataMaintenance = () => {
  const { toast } = useToast()
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState('')

  const fixPackageCounts = async () => {
    setIsRunning(true)
    setProgress('Lendo pacotes e agendamentos...')
    try {
      const clientsRef = collection(db, 'companies', getCompanyId(), 'clients')
      const clientsSnap = await getDocs(clientsRef)
      
      let processedPkgs = 0
      let fixedPkgs = 0
      let batch = writeBatch(db)
      let batchCount = 0
      const parentPackagesCache: Record<string, number> = {}

      for (const clientDoc of clientsSnap.docs) {
        const pkgsRef = collection(db, 'companies', getCompanyId(), 'clients', clientDoc.id, 'packages')
        const pkgsSnap = await getDocs(pkgsRef)

        if (pkgsSnap.empty) continue

        const apptsRef = collection(db, 'companies', getCompanyId(), 'appointments')
        const apptsQuery = query(apptsRef, where('client_id', '==', clientDoc.id))
        const apptsSnap = await getDocs(apptsQuery)
        const appts = apptsSnap.docs.map(d => d.data() as any)

        for (const pkgDoc of pkgsSnap.docs) {
          const pkgData = pkgDoc.data()
          if (!pkgData.package_id) continue

          let totalSessions = parentPackagesCache[pkgData.package_id]
          if (totalSessions === undefined) {
             const parentSnap = await getDoc(doc(db, 'companies', getCompanyId(), 'packages', pkgData.package_id))
             if (parentSnap.exists()) {
                totalSessions = parentSnap.data().session_count || 0
             } else {
                totalSessions = 0
             }
             parentPackagesCache[pkgData.package_id] = totalSessions
          }

          if (totalSessions === 0) continue

          const consumedAppts = appts.filter(a => 
             a.client_package_id === pkgDoc.id && 
             (a.status === 'completed' || a.status === 'no_show')
          )
          const consumedCount = consumedAppts.length
          const correctRemaining = totalSessions - consumedCount
          const currentRemaining = pkgData.sessions_remaining || 0

          if (currentRemaining !== correctRemaining) {
            batch.update(pkgDoc.ref, { sessions_remaining: correctRemaining })
            batchCount++
            fixedPkgs++
          }

          processedPkgs++
          setProgress(`Analisados ${processedPkgs} pacotes... Corrigidos: ${fixedPkgs}`)

          if (batchCount >= 50) {
            await batch.commit()
            batch = writeBatch(db)
            batchCount = 0
          }
        }
      }

      if (batchCount > 0) {
        await batch.commit()
      }

      toast({
        title: 'Auditoria Concluída',
        description: `Foram analisados ${processedPkgs} pacotes. ${fixedPkgs} pacotes tinham erros e foram corrigidos.`
      })
    } catch (error: any) {
      console.error(error)
      toast({
        title: 'Erro na auditoria',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setIsRunning(false)
      setProgress('')
    }
  }

  const migrateAppointments = async () => {
    setIsRunning(true)
    setProgress('Iniciando migração...')
    try {
      const apptsRef = collection(db, 'companies', getCompanyId(), 'appointments')
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
          getDoc(doc(db, 'companies', getCompanyId(), 'clients', data.client_id)),
          getDoc(doc(db, 'companies', getCompanyId(), 'professionals', data.professional_id)),
          getDoc(doc(db, 'companies', getCompanyId(), 'services', data.service_id))
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

  const migrateBirthdays = async () => {
    setIsRunning(true)
    setProgress('Iniciando indexação de aniversariantes...')
    try {
      const clientsRef = collection(db, 'companies', getCompanyId(), 'clients')
      const snapshot = await getDocs(clientsRef)
      
      setProgress(`Encontrados ${snapshot.size} clientes. Processando...`)
      
      let processed = 0
      let batch = writeBatch(db)
      let batchCount = 0

      for (const d of snapshot.docs) {
        const data = d.data()
        
        if (data.birth_date && !data.birth_month_day) {
          const parts = data.birth_date.split('-')
          if (parts.length >= 3) {
            batch.update(d.ref, { birth_month_day: `${parts[1]}-${parts[2]}` })
            batchCount++
          }
        }
        processed++
        setProgress(`Analisando: ${processed}/${snapshot.size}...`)

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
        title: 'Indexação concluída',
        description: `Todos os clientes foram verificados com sucesso.`
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

  const fixNotesDatesHandler = async () => {
    setIsRunning(true)
    setProgress('Corrigindo datas do histórico de prontuários...')
    try {
      const { fixNotesDates } = await import('@/shared/services')
      const companyId = getCompanyId()
      const result = await fixNotesDates(companyId)
      
      if (result.success) {
        toast({
          title: 'Correção concluída',
          description: `${result.fixed} anotações foram corrigidas e reordenadas.`
        })
      } else {
        throw result.error
      }
    } catch (error: any) {
      console.error(error)
      toast({
        title: 'Erro na correção',
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

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg bg-blue-50 border-blue-100 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-blue-800 font-medium">
                <AlertTriangle className="h-4 w-4" />
                <span>Fix Birthdays (Indexação)</span>
              </div>
              <p className="text-sm text-blue-700">
                Gera o índice nativo 'birth_month_day' nos clientes legados para zerar os custos de leitura no Dashboard.
              </p>
            </div>
            <Button 
              onClick={migrateBirthdays} 
              disabled={isRunning}
              variant="outline"
              className="bg-white hover:bg-blue-100 shrink-0"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Indexando...
                </>
              ) : (
                'Corrigir Aniversariantes'
              )}
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg bg-green-50 border-green-100 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-green-800 font-medium">
                <AlertTriangle className="h-4 w-4" />
                <span>Auditar e Corrigir Pacotes</span>
              </div>
              <p className="text-sm text-green-700">
                Varre todos os pacotes dos pacientes, compara com as sessões concluídas no histórico e corrige automaticamente a contagem de sessões restantes (corrige saldos negativos ou estornos errados).
              </p>
            </div>
            <Button 
              onClick={fixPackageCounts} 
              disabled={isRunning}
              variant="outline"
              className="bg-white hover:bg-green-100 shrink-0"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Auditando...
                </>
              ) : (
                'Corrigir Pacotes'
              )}
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg bg-purple-50 border-purple-100 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-purple-800 font-medium">
                <AlertTriangle className="h-4 w-4" />
                <span>Fix Notes Dates (Prontuário)</span>
              </div>
              <p className="text-sm text-purple-700">
                Corrige e reordena o histórico de evolução clínica dos pacientes para a data oficial do agendamento, inserindo a data da sessão na mensagem.
              </p>
            </div>
            <Button 
              onClick={fixNotesDatesHandler} 
              disabled={isRunning}
              variant="outline"
              className="bg-white hover:bg-purple-100 shrink-0"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Corrigindo...
                </>
              ) : (
                'Corrigir Prontuários'
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
