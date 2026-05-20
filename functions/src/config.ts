import * as admin from 'firebase-admin'

admin.initializeApp()

export const db = admin.firestore()
export const REGION = 'southamerica-east1'
export const Inc = admin.firestore.FieldValue.increment
export const ServerTs = admin.firestore.FieldValue.serverTimestamp
