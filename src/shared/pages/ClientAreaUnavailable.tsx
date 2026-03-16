import { useAuth } from '@/shared/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Info, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const ClientAreaUnavailable = () => {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-112px)] py-12">
      <Card className="w-full max-w-md animate-fade-in-up">
        <CardHeader className="text-center">
          <div className="mx-auto bg-accent text-accent-foreground rounded-full h-16 w-16 flex items-center justify-center mb-4">
            <Info className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl">
            Funcionalidade Indisponível
          </CardTitle>
          <CardDescription>
            A área do cliente está temporariamente em manutenção.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Pedimos desculpas pelo inconveniente. Estamos trabalhando para
            melhorar nossos serviços. Por favor, tente novamente mais tarde.
          </p>
          <Button onClick={handleSignOut} className="w-full">
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default ClientAreaUnavailable
