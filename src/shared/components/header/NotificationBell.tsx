import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/shared/providers/AuthProvider'
import {
  getUnreadNotificationCount,
  getRecentUnreadNotifications,
  markNotificationAsRead,
  UnifiedNotification
} from '@/modules/notifications/service'
import { db } from '@/shared/lib/firebase'
import { collection, query, onSnapshot } from 'firebase/firestore'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { getCompanyId } from '@/shared/lib/tenantStore'

export const NotificationBell = () => {
  const { professionalId, user, role } = useAuth()
  const adminId = role === 'admin' ? user?.id || null : null
  
  const [unreadCount, setUnreadCount] = useState(0)
  const [recentNotifications, setRecentNotifications] = useState<
    UnifiedNotification[]
  >([])
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()

  const fetchData = async () => {
    if (!professionalId && !adminId) return
    const [countRes, recentRes] = await Promise.all([
      getUnreadNotificationCount(professionalId, adminId),
      getRecentUnreadNotifications(professionalId, adminId),
    ])
    setUnreadCount(countRes.count || 0)
    setRecentNotifications(recentRes.data || [])
  }

  useEffect(() => {
    fetchData()

    if (!professionalId && !adminId) return

    const unsubscribes: (() => void)[] = []

    if (professionalId) {
      const ref = collection(db, 'companies', getCompanyId(), 'professionals', professionalId, 'notifications')
      unsubscribes.push(onSnapshot(query(ref), () => fetchData()))
    }
    
    if (adminId) {
      const ref = collection(db, 'companies', getCompanyId(), 'admins', adminId, 'notifications')
      unsubscribes.push(onSnapshot(query(ref), () => fetchData()))
    }

    return () => {
      unsubscribes.forEach(unsub => unsub())
    }
  }, [professionalId, adminId, user])

  const handleNotificationClick = async (notification: UnifiedNotification) => {
    // Mark as read
    await markNotificationAsRead(professionalId, adminId, notification.id, notification.source)

    // Update local state optimistically or re-fetch
    fetchData()

    // Navigate if link exists
    if (notification.link) {
      setIsOpen(false)
      navigate(notification.link)
    }
  }

  const handleViewAll = () => {
    setIsOpen(false)
    navigate('/profissional/notifications')
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b">
          <h4 className="font-semibold leading-none">Notificações</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Você tem {unreadCount} notificações não lidas.
          </p>
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {recentNotifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Nenhuma notificação nova.
            </div>
          ) : (
            <div className="divide-y">
              {recentNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => handleNotificationClick(notification)}
                >
                  <p className="text-sm font-medium leading-snug">
                    {notification.content}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(notification.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-2 border-t bg-muted/20">
          <Button
            variant="ghost"
            className="w-full text-xs h-8"
            onClick={handleViewAll}
          >
            Ver todas as notificações
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
