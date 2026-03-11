import { storage } from '@/lib/firebase'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'

export const uploadFile = async (bucket: string, path: string, file: File) => {
  try {
    const storageRef = ref(storage, `${bucket}/${path}`)
    const snapshot = await uploadBytesResumable(storageRef, file)

    return { data: snapshot, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export const getPublicUrl = async (bucket: string, path: string) => {
  try {
    const storageRef = ref(storage, `${bucket}/${path}`)
    const url = await getDownloadURL(storageRef)
    return url
  } catch (error) {
    return null
  }
}
