import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Zap,
  BarChart2,
  Database,
  Settings,
  HelpCircle,
  X,
  RotateCcw,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Live Prediction', href: '/predict', icon: Zap },
  { name: 'Live Telemetry', href: '/replay', icon: RotateCcw },
  { name: 'Model Performance', href: '/performance', icon: BarChart2 },
  { name: 'Data Explorer', href: '/data', icon: Database },
  { name: 'Settings', href: '/settings', icon: Settings },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation()

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-secondary-200 transition-transform duration-200 ease-in-out flex flex-col',
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}
      aria-label="Main navigation"
    >
      <div className="flex h-16 items-center justify-between px-6 border-b border-secondary-200">
        <NavLink to="/" className="flex items-center gap-2" onClick={onClose}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-secondary-900">PIPER</span>
        </NavLink>
        <button
          className="lg:hidden p-2 rounded-lg text-secondary-500 hover:text-secondary-700 hover:bg-secondary-100 transition-colors"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 p-4 overflow-y-auto" aria-label="Main navigation">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href ||
            (item.href !== '/' && location.pathname.startsWith(item.href))
          return (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-primary-600')} aria-hidden="true" />
              {item.name}
            </NavLink>
          )
        })}
      </nav>

      <div className="border-t border-secondary-200 p-4">
        <NavLink
          to="/help"
          onClick={onClose}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900 transition-colors"
        >
          <HelpCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          Help & Docs
        </NavLink>
      </div>
    </aside>
  )
}