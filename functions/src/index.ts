import * as appointmentFunctions from './appointments/onAppointmentWrite';
import * as financialFunctions from './financial/onFinancialRecordWrite';
import * as subscriptionFunctions from './subscriptions/onSubscriptionWrite';
import * as cronFunctions from './cron/dailyReconciliation';
import * as authFunctions from './auth/onUserWrite';
import * as staffFunctions from './auth/staffLifecycle';

export const {
    onAppointmentWrite
} = appointmentFunctions;

export const {
    onFinancialRecordWrite
} = financialFunctions;

export const {
    onSubscriptionWrite
} = subscriptionFunctions;

export const {
    dailyReconciliation
} = cronFunctions;

export const {
    onUserWrite
} = authFunctions;

export const {
    createStaffUser,
    setStaffActive
} = staffFunctions;
