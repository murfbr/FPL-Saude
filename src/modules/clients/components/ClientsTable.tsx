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

interface ClientsTableProps {
  clients: Client[]
}

export const ClientsTable = ({ clients }: ClientsTableProps) => {
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const handleRowClick = (clientId: string) => {
    navigate(`/profissional/pacientes/${clientId}`)
  }

  if (isMobile) {
    return (
      <div className="space-y-4">
        {clients.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Nenhum cliente encontrado.
          </p>
        ) : (
          clients.map((client) => (
            <Card
              key={client.id}
              onClick={() => handleRowClick(client.id)}
              className="cursor-pointer hover:bg-muted/50"
            >
              <CardHeader>
                <CardTitle className="text-base">{client.name}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>{client.email}</p>
                <p>{client.phone || 'Não informado'}</p>
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
            <TableHead>Email / CPF</TableHead>
            <TableHead>Telefone</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-center">
                Nenhum cliente encontrado.
              </TableCell>
            </TableRow>
          )}
          {clients.map((client) => (
            <TableRow
              key={client.id}
              onClick={() => handleRowClick(client.id)}
              className="cursor-pointer hover:bg-muted/50"
            >
              <TableCell className="font-medium">{client.name}</TableCell>
              <TableCell>{client.email}</TableCell>
              <TableCell>{client.phone || 'Não informado'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
