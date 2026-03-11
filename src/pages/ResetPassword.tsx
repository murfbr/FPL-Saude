import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth as firebaseAuth } from '@/lib/firebase'
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Lock, Loader2 } from 'lucide-react'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const oobCode = searchParams.get('oobCode')
    
    if (!oobCode) {
      toast({
        title: 'Link inválido ou expirado',
        description: 'Por favor, solicite uma nova recuperação de senha.',
        variant: 'destructive',
      })
      navigate('/forgot-password')
      return
    }

    verifyPasswordResetCode(firebaseAuth, oobCode)
      .catch(() => {
        toast({
          title: 'Link inválido ou expirado',
          description: 'Por favor, solicite uma nova recuperação de senha.',
          variant: 'destructive',
        })
        navigate('/forgot-password')
      })
  }, [navigate, toast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast({
        title: 'Senhas não conferem',
        description: 'As senhas digitadas não são iguais.',
        variant: 'destructive',
      })
      return
    }

    if (password.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)

    try {
      const searchParams = new URLSearchParams(window.location.search)
      const oobCode = searchParams.get('oobCode')
      
      if (!oobCode) throw new Error('Código de recuperação inválido.')

      await confirmPasswordReset(firebaseAuth, oobCode, password)

      toast({
        title: 'Senha atualizada!',
        description: 'Você já pode fazer login com sua nova senha.',
      })
      navigate('/login')
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar senha',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-112px)] py-12">
      <Card className="w-full max-w-sm animate-fade-in-up">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary text-primary-foreground rounded-full h-16 w-16 flex items-center justify-center mb-4">
            <Lock className="h-8 w-8" />
          </div>
          <CardTitle>Nova Senha</CardTitle>
          <CardDescription>Crie uma nova senha para sua conta.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Atualizando...
                </>
              ) : (
                'Redefinir Senha'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
