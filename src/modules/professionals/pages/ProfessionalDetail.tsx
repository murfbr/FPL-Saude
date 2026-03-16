import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getProfessionalById } from '@/shared/services'
import { Professional } from '@/shared/types'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Edit } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ProfessionalServicesManager } from '@/modules/professionals/components/ProfessionalServicesManager'
import { ProfessionalEditDialog } from '@/modules/professionals/components/ProfessionalEditDialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AvailabilitySettings } from '@/modules/availability/components/AvailabilitySettings'
import { AvailabilityOverridesManager } from '@/modules/availability/components/AvailabilityOverridesManager'
import { Badge } from '@/components/ui/badge'

const ProfessionalDetail = () => {
  const { id } = useParams<{ id: string }>()
  const [professional, setProfessional] = useState<Professional | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  useEffect(() => {
    const fetchProfessional = async () => {
      if (!id) return
      setIsLoading(true)
      const { data } = await getProfessionalById(id)
      setProfessional(data)
      setIsLoading(false)
    }
    fetchProfessional()
  }, [id])

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase()
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid md:grid-cols-3 gap-6">
          <Skeleton className="h-64 md:col-span-1" />
          <Skeleton className="h-96 md:col-span-2" />
        </div>
      </div>
    )
  }

  if (!professional) {
    return (
      <div className="container mx-auto py-8 px-4 text-center">
        <h2 className="text-2xl font-bold">Profissional não encontrado</h2>
        <Button asChild className="mt-4">
          <Link to="/admin?tab=professionals">Voltar para a Lista</Link>
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="container mx-auto py-8 px-4">
        <Button asChild variant="outline" className="mb-6">
          <Link to="/admin?tab=professionals">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Profissionais
          </Link>
        </Button>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-6">
            <Card className={!professional.is_active ? 'border-dashed' : ''}>
              <CardHeader className="items-center text-center">
                <Avatar
                  className={`w-24 h-24 mb-4 ${!professional.is_active ? 'grayscale' : ''}`}
                >
                  <AvatarImage
                    src={professional.avatar_url || ''}
                    alt={professional.name}
                  />
                  <AvatarFallback className="text-3xl">
                    {getInitials(professional.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <CardTitle className="text-2xl">
                    {professional.name}
                  </CardTitle>
                  {!professional.is_active && (
                    <Badge variant="destructive">Inativo</Badge>
                  )}
                  {professional.is_active && (
                    <Badge
                      variant="secondary"
                      className="bg-green-100 text-green-800 hover:bg-green-200"
                    >
                      Ativo
                    </Badge>
                  )}
                </div>
                <CardDescription>{professional.specialty}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center">
                  {professional.bio || 'Nenhuma biografia disponível.'}
                </p>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(true)}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Editar Perfil
                </Button>
              </CardFooter>
            </Card>
          </div>
          <div className="md:col-span-2">
            <Tabs defaultValue="services" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="services">Serviços</TabsTrigger>
                <TabsTrigger value="availability">Disponibilidade</TabsTrigger>
              </TabsList>
              <TabsContent value="services">
                <ProfessionalServicesManager professionalId={professional.id} />
              </TabsContent>
              <TabsContent value="availability" className="space-y-6">
                <AvailabilitySettings professionalId={professional.id} />
                <AvailabilityOverridesManager
                  professionalId={professional.id}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
      <ProfessionalEditDialog
        professional={professional}
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onProfessionalUpdate={setProfessional}
      />
    </>
  )
}

export default ProfessionalDetail
