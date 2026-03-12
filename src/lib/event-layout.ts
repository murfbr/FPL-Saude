import { Appointment } from '@/types'
import { formatInTimeZone } from '@/lib/utils'

export interface LayoutedEvent extends Appointment {
  layout: {
    top: number
    height: number
    left: number
    width: number
  }
}

/**
 * Calculates layout for overlapping events to display them side-by-side.
 * Uses a column packing algorithm.
 */
export function computeEventLayout(
  events: Appointment[],
  getTop: (date: Date) => number,
  getHeight: (date: Date, duration: number) => number,
): LayoutedEvent[] {
  if (events.length === 0) return []

  // 1. Sort events by start time, then duration
  const sorted = [...events].sort((a, b) => {
    const startA = new Date(a.schedules?.start_time || 0).getTime()
    const startB = new Date(b.schedules?.start_time || 0).getTime()
    if (startA !== startB) return startA - startB
    return (b.services?.duration_minutes || 0) - (a.services?.duration_minutes || 0)
  })

  // 2. Group into overlapping clusters
  const clusters: Appointment[][] = []
  let currentCluster: Appointment[] = []
  let clusterEnd = 0

  sorted.forEach(appt => {
    const start = new Date(appt.schedules?.start_time || 0).getTime()
    const end = start + (appt.services?.duration_minutes || 60) * 60 * 1000

    if (currentCluster.length === 0) {
      currentCluster.push(appt)
      clusterEnd = end
    } else if (start < clusterEnd) {
      currentCluster.push(appt)
      clusterEnd = Math.max(clusterEnd, end)
    } else {
      clusters.push(currentCluster)
      currentCluster = [appt]
      clusterEnd = end
    }
  })
  if (currentCluster.length > 0) clusters.push(currentCluster)

  // 3. Layout each cluster independently
  const results: LayoutedEvent[] = []

  clusters.forEach(cluster => {
    const columns: Appointment[][] = []
    
    cluster.forEach(appt => {
      const start = new Date(appt.schedules?.start_time || 0).getTime()
      
      let colIndex = -1
      for (let i = 0; i < columns.length; i++) {
        const last = columns[i][columns[i].length - 1]
        const lastStart = new Date(last.schedules?.start_time || 0).getTime()
        const lastEnd = lastStart + (last.services?.duration_minutes || 60) * 60 * 1000
        
        if (start >= lastEnd) {
          colIndex = i
          break
        }
      }

      if (colIndex === -1) {
        colIndex = columns.length
        columns.push([])
      }
      columns[colIndex].push(appt)
      
      const top = getTop(new Date(appt.schedules?.start_time || 0))
      const height = getHeight(new Date(appt.schedules?.start_time || 0), appt.services?.duration_minutes || 60)
      
      results.push({
        ...appt,
        layout: {
          top,
          height: Math.max(height, 28),
          left: colIndex, // Temporary store colIndex here
          width: columns.length // Temporary store total columns needed so far in cluster
        }
      } as any)
    })

    // Update widths for the whole cluster once we know the final columns.length
    const totalCols = columns.length
    const clusterIds = cluster.map(a => a.id)
    results.forEach(r => {
      if (clusterIds.includes(r.id)) {
        const colIdx = r.layout.left
        r.layout.width = 100 / totalCols
        r.layout.left = (colIdx / totalCols) * 100
      }
    })
  })

  return results
}
