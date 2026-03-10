import { useEffect, useState } from 'react'
import { getAllClients } from '@/services'
import { getAllServices } from '@/services'
import { Client, Service } from '@/types'
import { PatientsList } from '@/components/admin/PatientsList'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { cleanCPF } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function Patients() {
  const [clients, setClients] = useState<Client[]>([])
  const [filteredClients, setFilteredClients] = useState<Client[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  // Filters
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'inactive'
  >('active')
  const [serviceFilter, setServiceFilter] = useState<string>('all')
  const [services, setServices] = useState<Service[]>([])

  // Fetch available services for the filter
  useEffect(() => {
    const fetchServices = async () => {
      const { data } = await getAllServices()
      if (data) {
        setServices(data)
      }
    }
    fetchServices()
  }, [])

  // Fetch clients when status or service filters change
  useEffect(() => {
    const fetchClients = async () => {
      setIsLoading(true)
      const { data } = await getAllClients({
        status: statusFilter,
        serviceId: serviceFilter,
      })
      if (data) {
        setClients(data)
        setFilteredClients(data)
      } else {
        setClients([])
        setFilteredClients([])
      }
      setIsLoading(false)
    }
    fetchClients()
  }, [statusFilter, serviceFilter])

  // Apply local search filter
  useEffect(() => {
    const lowerTerm = searchTerm.toLowerCase()
    const cleanTerm = cleanCPF(searchTerm)

    const filtered = clients.filter((client) => {
      const matchesName = client.name.toLowerCase().includes(lowerTerm)
      const matchesCPF =
        cleanTerm.length > 0 && client.email.includes(cleanTerm)
      // We check if cleaned search term matches the stored CPF (email field)

      return matchesName || matchesCPF
    })
    setFilteredClients(filtered)
  }, [searchTerm, clients])

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">
          Gerenciar Pacientes
        </h1>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CPF..."
            className="pl-8 w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(value: 'all' | 'active' | 'inactive') =>
            setStatusFilter(value)
          }
        >
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>

        <Select value={serviceFilter} onValueChange={setServiceFilter}>
          <SelectTrigger className="w-full md:w-[220px]">
            <SelectValue placeholder="Serviço" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Serviços</SelectItem>
            {services.map((service) => (
              <SelectItem key={service.id} value={service.id}>
                {service.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <PatientsList patients={filteredClients} />
      )}
    </div>
  )
}
