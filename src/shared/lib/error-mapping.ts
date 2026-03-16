/**
 * Maps technical error messages to user-friendly Portuguese messages.
 * Handles Supabase Auth errors, Postgres errors, and generic application errors.
 */
export const getFriendlyErrorMessage = (error: any): string => {
  if (!error) return 'Ocorreu um erro desconhecido.'

  // Extract the message string
  const message =
    error.message ||
    error.error_description ||
    error.msg ||
    (typeof error === 'string' ? error : JSON.stringify(error))

  // --- Capacity & Scheduling Errors ---
  if (message.includes('Turma lotada')) {
    return 'Este horário atingiu a capacidade máxima de participantes.'
  }
  if (message.includes('Conflito de serviço')) {
    return 'Este horário já está reservado para outro tipo de serviço.'
  }
  if (message.includes('Cliente já está agendado')) {
    return 'Este paciente já possui um agendamento neste horário.'
  }
  if (message.includes('Conflito de horário')) {
    return 'O horário selecionado conflita com outro agendamento existente.'
  }

  // --- Auth & User Management Errors ---
  if (
    message.includes('User already registered') ||
    message.includes('Email already registered') ||
    (message.includes('unique_violation') && message.includes('email'))
  ) {
    return 'Este e-mail já está em uso por outro profissional ou usuário.'
  }

  if (message.includes('Password should be at least')) {
    return 'A senha deve ter pelo menos 6 caracteres.'
  }

  if (message.includes('Invalid login credentials')) {
    return 'E-mail ou senha incorretos.'
  }

  if (message.includes('AuthApiError: rate limit exceeded')) {
    return 'Muitas tentativas. Por favor, aguarde alguns instantes e tente novamente.'
  }

  // --- Database Constraints ---
  if (message.includes('duplicate key value violates unique constraint')) {
    if (message.includes('clients_email_key')) {
      return 'Já existe um paciente cadastrado com este e-mail ou CPF.'
    }
    if (message.includes('professionals_email_key')) {
      return 'Já existe um profissional cadastrado com este e-mail.'
    }
    return 'Registro duplicado. Estes dados já existem no sistema.'
  }

  if (message.includes('violates foreign key constraint')) {
    return 'Não é possível excluir ou alterar este item pois ele está vinculado a outros registros (como agendamentos ou pacotes).'
  }

  // --- Generic / Network ---
  if (
    message.includes('Failed to fetch') ||
    message.includes('Network request failed')
  ) {
    return 'Erro de conexão. Verifique sua internet e tente novamente.'
  }

  // Return original message if no mapping found, but clean up technical prefixes if possible
  return message.replace(/^Error: /, '').replace(/^AuthApiError: /, '')
}
