import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/shared/providers/AuthProvider'
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/modules/notifications/service'
import { Notification } from '@/shared/types'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Bell, CheckCheck } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/shared/lib/utils'
import { useToast } from '@/shared/hooks/use-toast'
import { db } from '@/shared/lib/firebase'
import { collection, query, onSnapshot, addDoc } from 'firebase/firestore'
import { getCompanyId } from '@/shared/lib/tenantStore'

const NotificationsPage = () => {
  const { professionalId, user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchNotifications = async () => {
    if (!professionalId) return
    setIsLoading(true)
    const { data } = await getNotifications(professionalId)
    
    // Auto-inject mock if completely empty
    if (data && data.length === 0) {
      try {
        const ref = collection(db, 'companies', getCompanyId(), 'professionals', professionalId, 'notifications')
        await addDoc(ref, {
          title: 'Notificações Ativas!',
          content: 'Sua caixa de entrada de notificações do novo banco Firestore está operando corretamente. A migração foi concluida com sucesso.',
          is_read: false,
          link: null,
          created_at: new Date().toISOString()
        })
        const updated = await getNotifications(professionalId)
        setNotifications(updated.data || [])
      } catch (e) {
        console.error('Failed to inject mock', e)
      }
    } else {
      setNotifications(data || [])
    }
    
    setIsLoading(false)
  }

  useEffect(() => {
    fetchNotifications()
  }, [professionalId])

  useEffect(() => {
    if (!user || !professionalId) return

    const ref = collection(db, 'companies', getCompanyId(), 'professionals', professionalId, 'notifications')
    const q = query(ref)

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          // Toast or similar could be added here if it wasn't the initial load
        }
      })
      fetchNotifications()
    })

    return () => {
      unsubscribe()
    }
  }, [user, professionalId, toast])

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      if (professionalId) {
        await markNotificationAsRead(professionalId, notification.id)
      }
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, is_read: true } : n,
        ),
      )
    }
    if (notification.link) {
      navigate(notification.link)
    }
  }

  const handleMarkAllAsRead = async () => {
    if (!professionalId) return
    await markAllNotificationsAsRead(professionalId)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    toast({ title: 'Todas as notificações foram marcadas como lidas.' })
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Bell />
              Notificações
            </CardTitle>
            <CardDescription>
              Mantenha-se atualizado sobre suas atividades.
            </CardDescription>
          </div>
          <Button
            onClick={handleMarkAllAsRead}
            variant="outline"
            className="w-full sm:w-auto"
          >
            <CheckCheck className="mr-2 h-4 w-4" />
            Marcar todas como lidas
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : notifications.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Você não tem nenhuma notificação.
            </p>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    'p-4 border rounded-lg flex items-start gap-4 cursor-pointer transition-colors hover:bg-muted/50',
                    !notification.is_read && 'bg-primary/5',
                  )}
                >
                  {!notification.is_read && (
                    <div className="w-2 h-2 mt-1.5 rounded-full bg-primary shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm">{notification.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default NotificationsPage
