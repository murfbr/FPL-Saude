import { useState } from 'react'
import { Professional } from '@/shared/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useNavigate } from 'react-router-dom'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

interface ProfessionalsListProps {
  professionals: Professional[]
}

export const ProfessionalsList = ({
  professionals,
}: ProfessionalsListProps) => {
  const navigate = useNavigate()
  const [showInactive, setShowInactive] = useState(false)

  const handleCardClick = (professionalId: string) => {
    navigate(`/admin/profissionais/${professionalId}`)
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase()
  }

  const filteredProfessionals = professionals.filter(
    (prof) => showInactive || prof.is_active,
  )

  const inactiveCount = professionals.filter((p) => !p.is_active).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Exibindo {filteredProfessionals.length} de {professionals.length}{' '}
          profissionais
        </div>
        {inactiveCount > 0 && (
          <div className="flex items-center space-x-2">
            <Switch
              id="show-inactive"
              checked={showInactive}
              onCheckedChange={setShowInactive}
            />
            <Label htmlFor="show-inactive">Mostrar inativos</Label>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredProfessionals.map((prof) => (
          <Card
            key={prof.id}
            onClick={() => handleCardClick(prof.id)}
            className={`cursor-pointer hover:shadow-md transition-all ${
              !prof.is_active ? 'opacity-75 bg-muted/30 border-dashed' : ''
            }`}
          >
            <CardHeader className="flex flex-row items-center gap-4 relative">
              <Avatar className={!prof.is_active ? 'grayscale' : ''}>
                <AvatarImage src={prof.avatar_url || ''} alt={prof.name} />
                <AvatarFallback>{getInitials(prof.name)}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <CardTitle className="text-base">{prof.name}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {prof.specialty}
                </p>
              </div>
              {!prof.is_active && (
                <div className="absolute top-4 right-4">
                  <Badge variant="destructive" className="text-xs px-2 py-0.5">
                    Inativo
                  </Badge>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-3">
                {prof.bio || 'Nenhuma biografia disponível.'}
              </p>
            </CardContent>
          </Card>
        ))}
        {filteredProfessionals.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            Nenhum profissional encontrado.
          </div>
        )}
      </div>
    </div>
  )
}
