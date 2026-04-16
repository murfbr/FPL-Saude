/**
 * Componente de prompt de atualização PWA.
 * Exibe um toast quando uma nova versão do app está disponível,
 * permitindo ao usuário atualizar sem perder contexto.
 */
import { useEffect, useState } from 'react'
import { Workbox } from 'workbox-window'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

export const ReloadPrompt = () => {
  const [showReload, setShowReload] = useState(false)
  const [wb, setWb] = useState<Workbox | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const workbox = new Workbox('/sw.js')

    workbox.addEventListener('waiting', () => {
      setShowReload(true)
    })

    workbox.register()
    setWb(workbox)
  }, [])

  const handleReload = () => {
    if (wb) {
      wb.messageSkipWaiting()
      window.location.reload()
    }
  }

  if (!showReload) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3 bg-card border shadow-lg rounded-lg px-4 py-3">
        <p className="text-sm font-medium">Nova versão disponível</p>
        <Button size="sm" onClick={handleReload} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizar
        </Button>
      </div>
    </div>
  )
}
