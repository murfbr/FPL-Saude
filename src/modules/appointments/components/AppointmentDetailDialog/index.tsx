import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { PartyPopper, Trash2, CalendarClock, Loader2, Repeat } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'

import { Appointment } from '@/shared/types'
import { type AppointmentsRange } from '@/modules/appointments/queries'
import { RescheduleDialog } from '../RescheduleDialog'
import { PatientHistoryModal } from '@/modules/clients/components/PatientHistoryModal'
import { isValid } from 'date-fns'

import { useAppointmentDetail } from './useAppointmentDetail'
import { EventPanel } from './EventPanel'
import { AppointmentPanel } from './AppointmentPanel'
import { NotesSection } from './NotesSection'

interface AppointmentDetailDialogProps {
  appointment: Appointment | null
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onAppointmentUpdated: (shouldInvalidate?: boolean | AppointmentsRange) => void
}

export const AppointmentDetailDialog = (props: AppointmentDetailDialogProps) => {
  const { appointment, isOpen, onOpenChange } = props
  const { state, actions } = useAppointmentDetail(props)

  if (
    !appointment ||
    !appointment.schedules?.start_time ||
    !isValid(new Date(appointment.schedules.start_time))
  ) {
    return null
  }

  const {
    isEvent,
    canEdit,
    isAdmin,
    canReschedule,
    isDeleting,
    deleteMode,
    isRescheduleOpen,
    isHistoryModalOpen,
  } = state

  const {
    setIsRescheduleOpen,
    setDeleteMode,
    handleDelete,
    setIsHistoryModalOpen,
    handleRescheduleSuccess,
  } = actions

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isEvent && <PartyPopper className="h-5 w-5 text-purple-500" />}
              {isEvent ? 'Detalhes do Evento' : 'Detalhes do Agendamento'}
            </DialogTitle>
            <DialogDescription>
              {isEvent ? appointment.event_title : 'Informações completas sobre a sessão.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {isEvent ? (
              <EventPanel appointment={appointment} state={state} actions={actions} />
            ) : (
              <>
                <AppointmentPanel appointment={appointment} state={state} actions={actions} />
                <NotesSection state={state} actions={actions} />
              </>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full sm:w-auto">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir Agendamento</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja{' '}
                      <strong>excluir permanentemente</strong> este registro?
                      <br />
                      Esta ação não pode ser desfeita. Para apenas cancelar e
                      manter o histórico, altere o status para "Cancelado".
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  {appointment.is_recurring && (
                    <div className="py-4 px-1">
                      <Label className="text-sm font-semibold mb-3 block flex items-center gap-2">
                        <Repeat className="w-4 h-4 text-destructive" />
                        Este é um agendamento recorrente
                      </Label>
                      <RadioGroup
                        value={deleteMode}
                        onValueChange={(val: any) => setDeleteMode(val)}
                        className="flex flex-col space-y-2"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="only-this" id="del-only-this" />
                          <Label htmlFor="del-only-this" className="font-normal cursor-pointer text-sm">
                            Excluir apenas este agendamento
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="this-and-future" id="del-this-and-future" />
                          <Label htmlFor="del-this-and-future" className="font-normal cursor-pointer text-sm font-medium text-destructive">
                            Excluir este e todos os agendamentos futuros
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  )}

                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        appointment.is_recurring && deleteMode === 'this-and-future'
                          ? 'Confirmar Exclusão da Série'
                          : 'Confirmar Exclusão'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {canReschedule && canEdit && !isEvent && (
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => setIsRescheduleOpen(true)}
              >
                <CalendarClock className="mr-2 h-4 w-4" />
                Remarcar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!isEvent && (
        <RescheduleDialog
          isOpen={isRescheduleOpen}
          onOpenChange={setIsRescheduleOpen}
          oldAppointmentId={appointment.id}
          client={appointment.clients as any}
          service={appointment.services as any}
          professionalId={appointment.professional_id}
          onRescheduleSuccess={handleRescheduleSuccess}
          is_recurring={appointment.is_recurring}
          currentStartTime={appointment.schedules?.start_time}
        />
      )}

      <PatientHistoryModal
        clientId={(appointment as any).client_id}
        isOpen={isHistoryModalOpen}
        onOpenChange={setIsHistoryModalOpen}
      />
    </>
  )
}
