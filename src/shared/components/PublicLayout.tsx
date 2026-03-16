import { Outlet } from 'react-router-dom'

export default function PublicLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-background font-sans text-foreground">
      <main className="flex-grow flex flex-col justify-center">
        <Outlet />
      </main>
    </div>
  )
}
