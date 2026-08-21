"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.setStaffActive = exports.createStaffUser = exports.onUserWrite = exports.dailyReconciliation = exports.onFinancialRecordWrite = exports.setAppointmentStatus = exports.onAppointmentWrite = void 0;
const appointmentFunctions = __importStar(require("./appointments/onAppointmentWrite"));
const appointmentStatusFunctions = __importStar(require("./appointments/setAppointmentStatus"));
const financialFunctions = __importStar(require("./financial/onFinancialRecordWrite"));
const cronFunctions = __importStar(require("./cron/dailyReconciliation"));
const authFunctions = __importStar(require("./auth/onUserWrite"));
const staffFunctions = __importStar(require("./auth/staffLifecycle"));
exports.onAppointmentWrite = appointmentFunctions.onAppointmentWrite;
exports.setAppointmentStatus = appointmentStatusFunctions.setAppointmentStatus;
exports.onFinancialRecordWrite = financialFunctions.onFinancialRecordWrite;
exports.dailyReconciliation = cronFunctions.dailyReconciliation;
exports.onUserWrite = authFunctions.onUserWrite;
exports.createStaffUser = staffFunctions.createStaffUser, exports.setStaffActive = staffFunctions.setStaffActive;
//# sourceMappingURL=index.js.map