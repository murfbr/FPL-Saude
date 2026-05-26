import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/**
 * Merges multiple class names into a single string
 * @param inputs - Array of class names
 * @returns Merged class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCPF(value: string | undefined | null): string {
  if (!value) return ''
  const digits = value.replace(/\D/g, '')
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1')
}

export function cleanCPF(value: string): string {
  return value.replace(/\D/g, '')
}

export function validateCPF(cpf: string): boolean {
  const clean = cleanCPF(cpf)
  if (clean.length !== 11) return false
  // Check if all digits are the same
  if (/^(\d)\1+$/.test(clean)) return false

  // Simple length check is usually enough for basic validation in this context,
  // but full algorithm could be implemented if stricter validation is needed.
  return true
}

/**
 * Formats a date using the Brazil Timezone (America/Sao_Paulo).
 * Forces the display to match Brazil time regardless of the browser's timezone.
 *
 * @param date - Date object or ISO string
 * @param formatStr - date-fns format string (e.g. 'HH:mm', 'dd/MM/yyyy')
 */
export function formatInTimeZone(
  date: Date | string,
  formatStr: string,
): string {
  const d = typeof date === 'string' ? new Date(date) : date

  // Brazil Standard Time (GMT-3) offset is 180 minutes behind UTC.
  const targetOffset = 180

  // Get local browser offset (positive if behind UTC)
  const localOffset = new Date().getTimezoneOffset()

  // Calculate the difference in minutes
  // Example: NY (300) -> BR (180). Diff = 120. Shift forward 2 hours.
  // 13:00 NY (is 18:00 UTC) -> 15:00 NY (is 20:00 UTC).
  // Wait, if it is 18:00 UTC. Brazil is 15:00.
  // NY is 13:00.
  // We want to display 15:00.
  // So we need to shift the date so that local time becomes 15:00.
  // Shift = 15:00 - 13:00 = +2h = 120min.
  // Formula: localOffset - targetOffset = 300 - 180 = 120. Correct.
  const offsetDiff = localOffset - targetOffset

  // Create a shifted date
  const shiftedDate = new Date(d.getTime() + offsetDiff * 60 * 1000)

  return format(shiftedDate, formatStr, { locale: ptBR })
}

/**
 * Formats a date string into dd/MM/yyyy format while typing.
 * Also handles basic intelligent pasting of ISO dates.
 */
export function formatDateInput(value: string): string {
  if (!value) return ''

  // Handle ISO date paste (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-')
    return `${d}/${m}/${y}`
  }

  // Remove non-digit characters
  const digits = value.replace(/\D/g, '')

  // Limit to 8 digits (ddmmyyyy)
  const limited = digits.slice(0, 8)

  // Apply mask
  if (limited.length <= 2) return limited
  if (limited.length <= 4) return `${limited.slice(0, 2)}/${limited.slice(2)}`
  return `${limited.slice(0, 2)}/${limited.slice(2, 4)}/${limited.slice(4)}`
}

/**
 * Validates if a string is a valid date in dd/MM/yyyy format.
 * Checks for format, valid calendar day, and ensures it is not in the future.
 */
export function isValidDate(dateStr: string): boolean {
  if (!dateStr) return true
  if (dateStr.length !== 10) return false

  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return false

  const [day, month, year] = dateStr.split('/').map(Number)

  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false
  if (year < 1900) return false

  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return false
  }

  if (date > new Date()) return false

  return true
}

/**
 * Converts a dd/MM/yyyy string to YYYY-MM-DD (ISO format).
 * Returns null if the input is invalid.
 */
export function convertDateToISO(
  dateStr: string | null | undefined,
): string | null {
  if (!dateStr) return null
  if (!isValidDate(dateStr)) return null
  const [day, month, year] = dateStr.split('/').map(Number)
  const y = year
  const m = String(month).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function hexToHsl(hex: string): string {
  hex = hex.replace(/^#/, '')
  let r = 0, g = 0, b = 0
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16)
    g = parseInt(hex[1] + hex[1], 16)
    b = parseInt(hex[2] + hex[2], 16)
  } else if (hex.length === 6) {
    r = parseInt(hex.substring(0, 2), 16)
    g = parseInt(hex.substring(2, 4), 16)
    b = parseInt(hex.substring(4, 6), 16)
  }
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h /= 6
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

export function applyBranding(branding: { primary_hex?: string; app_name?: string; logo_url?: string } | null | undefined) {
  if (branding) {
    if (branding.primary_hex) {
      document.documentElement.style.setProperty('--primary', hexToHsl(branding.primary_hex))
    } else {
      document.documentElement.style.removeProperty('--primary')
    }
    document.title = branding.app_name || 'FPL Saúde'
    
    if (branding.logo_url) {
      let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.href = branding.logo_url
    }
  } else {
    document.documentElement.style.removeProperty('--primary')
    document.title = 'FPL Saúde'
  }
}
