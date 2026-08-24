import * as appointmentFunctions from './appointments/onAppointmentWrite'
import * as appointmentStatusFunctions from './appointments/setAppointmentStatus'
import * as financialFunctions from './financial/onFinancialRecordWrite'
import * as expenseFunctions from './financial/onExpenseWrite'
import * as recurringExpenseFunctions from './financial/monthlyRecurringExpenses'
import * as cronFunctions from './cron/dailyReconciliation'
import * as authFunctions from './auth/onUserWrite'
import * as staffFunctions from './auth/staffLifecycle'
import * as entitlementFunctions from './entitlements/onEntitlementWrite'

export const { onAppointmentWrite } = appointmentFunctions

export const { setAppointmentStatus } = appointmentStatusFunctions

export const { onFinancialRecordWrite } = financialFunctions

export const { onExpenseWrite } = expenseFunctions

export const { monthlyRecurringExpenses } = recurringExpenseFunctions

export const { dailyReconciliation } = cronFunctions

export const { onUserWrite } = authFunctions

export const { createStaffUser, setStaffActive } = staffFunctions

export const { onClientSubscriptionWrite, onClientPackageWrite } =
  entitlementFunctions
