import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/shared/providers/AuthProvider'

const AccessDenied = () => {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-112px)] py-12">
      <Card className="w-full max-w-md animate-fade-in-up border-destructive/20 shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto bg-destructive/10 text-destructive rounded-full h-20 w-20 flex items-center justify-center mb-4">
            <ShieldAlert className="h-10 w-10" />
          </div>
          <CardTitle className="text-2xl text-destructive">
            Acesso Negado
          </CardTitle>
          <CardDescription className="text-base mt-2">
            Você não tem permissão para acessar esta página.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            Se você acredita que isso é um erro, entre em contato com o
            administrador do sistema ou tente fazer login com uma conta
            diferente.
          </p>
          <div className="grid gap-3 pt-2">
            <Button variant="outline" className="w-full" asChild>
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para o Início
              </Link>
            </Button>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground hover:text-destructive"
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair da Conta
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default AccessDenied
