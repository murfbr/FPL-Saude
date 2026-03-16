import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/shared/providers/AuthProvider'
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
import { useToast } from '@/shared/hooks/use-toast'
import { UserPlus } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

const Register = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      toast({
        title: 'Erro de Validação',
        description: 'As senhas não coincidem.',
        variant: 'destructive',
      })
      return
    }
    setIsLoading(true)
    const { error } = await signUp(email, password)
    if (error) {
      toast({
        title: 'Erro no Cadastro',
        description:
          error.message || 'Não foi possível criar a conta. Tente novamente.',
        variant: 'destructive',
      })
    } else {
      setIsSuccess(true)
    }
    setIsLoading(false)
  }

  if (isSuccess) {
    return (
      <div className="container flex items-center justify-center min-h-[calc(100vh-112px)] py-12">
        <Card className="w-full max-w-md animate-fade-in-up">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Verifique seu Email</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertTitle>Cadastro quase completo!</AlertTitle>
              <AlertDescription>
                Enviamos um link de confirmação para <strong>{email}</strong>.
                Por favor, clique no link para ativar sua conta.
              </AlertDescription>
            </Alert>
            <Button className="w-full mt-4" asChild>
              <Link to="/login">Voltar para o Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-112px)] py-12">
      <Card className="w-full max-w-sm animate-fade-in-up">
        <CardHeader className="text-center">
          <div className="mx-auto bg-secondary text-secondary-foreground rounded-full h-16 w-16 flex items-center justify-center mb-4">
            <UserPlus className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl">Crie sua Conta</CardTitle>
          <CardDescription>
            Preencha os campos abaixo para se cadastrar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirme a Senha</Label>
              <Input
                id="confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Cadastrando...' : 'Cadastrar'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Já tem uma conta?{' '}
              <Link to="/login" className="underline hover:text-primary">
                Faça login
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default Register
