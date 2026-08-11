import { db, auth } from '@/shared/lib/firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { Professional } from '@/shared/types'
import { getCompanyId } from '@/shared/lib/tenantStore'
import { sendPasswordResetEmail } from 'firebase/auth'
import { callCreateStaffUser, callSetStaffActive } from '@/shared/lib/functions'

export async function updateProfessional(
  id: string,
  updates: Partial<Omit<Professional, 'id' | 'created_at' | 'user_id'>>,
): Promise<{ data: Professional | null; error: any }> {
  try {
    const docRef = doc(db, 'companies', getCompanyId(), 'professionals', id)
    await updateDoc(docRef, updates)

    const snapshot = await getDoc(docRef)
    return { data: { id: snapshot.id, ...snapshot.data() } as Professional, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

/**
 * Ativa/desativa o ACESSO do profissional via Cloud Function:
 * desativar congela a conta (disabled) e revoga sessões — nada é apagado,
 * histórico intacto; reativar religa a mesma conta.
 * Retorna a contagem de agendamentos futuros para a UI avisar o admin.
 */
export async function setProfessionalActive(
  professionalId: string,
  active: boolean,
): Promise<{ futureAppointments: number | null; error: any }> {
  try {
    const companyId = getCompanyId()
    const result = await callSetStaffActive({ companyId, professionalId, active })
    const data = result.data as { futureAppointments?: number | null }
    return { futureAppointments: data?.futureAppointments ?? null, error: null }
  } catch (error: any) {
    console.error('Erro ao atualizar acesso do profissional:', error)
    return {
      futureAppointments: null,
      error: new Error(error?.message || 'Falha ao atualizar o acesso do profissional.'),
    }
  }
}

export async function addServiceToProfessional(
  professionalId: string,
  serviceId: string,
): Promise<{ error: any }> {
  try {
    const docRef = doc(db, 'companies', getCompanyId(), 'professionals', professionalId)
    const snapshot = await getDoc(docRef)

    const currentServices = snapshot.data()?.service_ids || []
    if (!currentServices.includes(serviceId)) {
      currentServices.push(serviceId)
      await updateDoc(docRef, { service_ids: currentServices })
    }
    return { error: null }
  } catch (error) {
    return { error }
  }
}

export async function removeServiceFromProfessional(
  professionalId: string,
  serviceId: string,
): Promise<{ error: any }> {
  try {
    const docRef = doc(db, 'companies', getCompanyId(), 'professionals', professionalId)
    const snapshot = await getDoc(docRef)

    let currentServices = snapshot.data()?.service_ids || []
    currentServices = currentServices.filter((id: string) => id !== serviceId)
    await updateDoc(docRef, { service_ids: currentServices })

    return { error: null }
  } catch (error) {
    return { error }
  }
}

export async function createProfessionalUser(
  data: any,
): Promise<{ data: any; error: any }> {
  try {
    const companyId = getCompanyId()

    // Criação atômica no servidor (Admin SDK): Auth + users raiz + professionals,
    // com rollback — sem conta órfã nem e-mail preso se um passo falhar, e sem
    // esbarrar nas rules (o antigo fluxo gravava autenticado como o usuário novo)
    const result = await callCreateStaffUser({
      companyId,
      name: data.name,
      email: data.email,
      password: data.password || null,
      role: 'professional',
      specialty: data.specialty || '',
      bio: data.bio || '',
      avatarUrl: data.avatar_url || '',
    })
    const profData = (result.data as { professional?: unknown })?.professional

    // Convite para definir senha — a falha aparece para o admin, não é engolida
    if (!data.password) {
      try {
        const actionCodeSettings = {
          url: `${window.location.origin}/reset-password`,
          handleCodeInApp: false,
        }
        await sendPasswordResetEmail(auth, data.email, actionCodeSettings)
      } catch (emailError) {
        console.error('Error sending reset email:', emailError)
        return {
          data: profData,
          error: new Error(
            'Profissional criado, mas o e-mail de convite falhou. Peça para usar "Esqueci minha senha" na tela de login.',
          ),
        }
      }
    }

    return { data: profData, error: null }
  } catch (error: any) {
    console.error('Erro ao criar usuário profissional:', error)
    return { data: null, error: new Error(error?.message || 'Falha ao criar profissional.') }
  }
}
