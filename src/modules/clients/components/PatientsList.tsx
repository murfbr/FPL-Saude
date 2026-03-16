import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Client } from '@/shared/types'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { Badge } from '@/components/ui/badge'
import { cn, formatCPF } from '@/shared/lib/utils'

interface PatientsListProps {
  patients: Client[]
}

export const PatientsList = ({ patients }: PatientsListProps) => {
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const handleRowClick = (patientId: string) => {
    navigate(`/admin/pacientes/${patientId}`)
  }

  if (isMobile) {
    return (
      <div className="space-y-4">
        {patients.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Nenhum paciente encontrado.
          </p>
        ) : (
          patients.map((patient) => (
            <Card
              key={patient.id}
              onClick={() => handleRowClick(patient.id)}
              className={cn(
                'cursor-pointer hover:bg-muted/50',
                !patient.is_active && 'bg-muted/30 opacity-60',
              )}
            >
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base">{patient.name}</CardTitle>
                  <Badge
                    variant={patient.is_active ? 'outline' : 'destructive'}
                  >
                    {patient.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>CPF: {formatCPF(patient.email)}</p>
                <p>{patient.phone || 'Não informado'}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>CPF</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {patients.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center">
                Nenhum paciente encontrado.
              </TableCell>
            </TableRow>
          ) : (
            patients.map((patient) => (
              <TableRow
                key={patient.id}
                onClick={() => handleRowClick(patient.id)}
                className={cn(
                  'cursor-pointer hover:bg-muted/50',
                  !patient.is_active && 'text-muted-foreground opacity-60',
                )}
              >
                <TableCell className="font-medium">{patient.name}</TableCell>
                <TableCell>{formatCPF(patient.email)}</TableCell>
                <TableCell>{patient.phone || 'Não informado'}</TableCell>
                <TableCell>
                  <Badge
                    variant={patient.is_active ? 'outline' : 'destructive'}
                  >
                    {patient.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
