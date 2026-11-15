import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useModelInfo } from '@/hooks/useApi'

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { data: modelInfo, isLoading } = useModelInfo()

  return (
    <div className="min-h-screen bg-secondary-50 flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0 lg:ml-64">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          modelLoaded={!!modelInfo && !isLoading}
        />
        <main className="flex-1 min-w-0 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  )
}