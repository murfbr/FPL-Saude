import * as appointmentFunctions from './appointments/onAppointmentWrite';
import * as financialFunctions from './financial/onFinancialRecordWrite';
import * as subscriptionFunctions from './subscriptions/onSubscriptionWrite';
import * as cronFunctions from './cron/dailyReconciliation';

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
