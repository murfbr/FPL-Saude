import { useState, useEffect } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
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
import { LogIn, Loader2, AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { signIn, user, loading, role, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()

  const from = location.state?.from?.pathname || '/'

  // Redirect if already authenticated and role is loaded
  useEffect(() => {
    // Only redirect if loading is finished and user exists
    if (!loading && user) {
      if (role) {
        console.log('[Login] Authenticated with role:', role, 'Redirecting...')
        // Smart redirect based on role
        // Se o profissional tentar acessar uma rota de admin por acidente (histórico/cache), forçamos ele para o painel dele
        if (
          from === '/' || 
          from === '/login' || 
          (role === 'professional' && (from.startsWith('/admin') || from.startsWith('/super-admin')))
        ) {
          if (role === 'admin') navigate('/admin', { replace: true })
          else if (role === 'professional')
            navigate('/profissional', { replace: true })
          else navigate('/dashboard', { replace: true }) // Will hit Index and redirect
        } else {
          navigate(from, { replace: true })
        }
      }
      // Note: If user is authenticated but role is missing, we render the error UI below.
    }
  }, [user, role, loading, navigate, from])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const { error } = await signIn(email, password)

      if (error) {
        toast({
          title: 'Erro de Autenticação',
          description: 'Email ou senha inválidos. Por favor, tente novamente.',
          variant: 'destructive',
        })
      }
      // Successful login logic is handled by the useEffect watching auth state
      // The AuthProvider sets loading=true on success, triggering the loading view
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro Inesperado',
        description: 'Ocorreu um erro ao tentar fazer login.',
        variant: 'destructive',
      })
    } finally {
      // If successful, loading will be true (set by AuthProvider), so this doesn't flash
      setIsSubmitting(false)
    }
  }

  // Loading State - Shows while AuthProvider is verifying session/profile
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background animate-in fade-in duration-500">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-foreground">
            {user ? 'Verificando perfil...' : 'Autenticando...'}
          </p>
          <p className="text-xs text-muted-foreground animate-pulse">
            Por favor, aguarde um momento.
          </p>
        </div>
      </div>
    )
  }

  // Valid Auth State - Render nothing while redirecting (handled by useEffect)
  if (user && role) return null

  // Error State: User logged in but no role found
  if (user && !role) {
    return (
      <div className="container flex items-center justify-center min-h-screen py-12">
        <Card className="w-full max-w-sm border-destructive/50">
          <CardHeader className="text-center">
            <div className="mx-auto bg-destructive/10 text-destructive rounded-full p-3 w-fit mb-4">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <CardTitle className="text-destructive">
              Perfil Incompleto
            </CardTitle>
            <CardDescription>
              Não foi possível carregar as informações do seu perfil.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTitle>Atenção</AlertTitle>
              <AlertDescription>
                Seu usuário foi autenticado, mas o registro de perfil
                correspondente não foi encontrado no banco de dados.
              </AlertDescription>
            </Alert>
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                await signOut()
              }}
            >
              Sair e Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Default Login Form
  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-112px)] py-12">
      <Card className="w-full max-w-sm animate-fade-in-up shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary text-primary-foreground rounded-full h-16 w-16 flex items-center justify-center mb-4 shadow-md">
            <LogIn className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl">Acesse sua Conta</CardTitle>
          <CardDescription>
            Use seu email e senha para entrar no sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                className="transition-all focus:ring-2"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  Esqueci minha senha
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                className="transition-all focus:ring-2"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Ou
                </span>
              </div>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Não tem uma conta?{' '}
              <Link
                to="/register"
                className="font-medium underline underline-offset-4 hover:text-primary transition-colors"
              >
                Cadastre-se
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default Login
