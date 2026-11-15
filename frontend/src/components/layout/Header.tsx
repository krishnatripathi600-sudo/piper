import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Menu, Bell, Moon, LogOut, User, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface HeaderProps {
  onMenuClick: () => void
  modelLoaded: boolean
}

export function Header({ onMenuClick, modelLoaded }: HeaderProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-secondary-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <Button
        variant="ghost"
        size="sm"
        className="lg:hidden"
        onClick={onMenuClick}
        aria-label="Toggle menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex-1 min-w-0" />

      <div className="flex items-center gap-4 flex-wrap">
        <div className="hidden sm:flex items-center gap-2">
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              modelLoaded ? 'bg-success-500' : 'bg-warning-500 animate-pulse'
            )}
          />
          <span className="text-sm text-secondary-600">
            {modelLoaded ? 'Model Ready' : 'Model Loading'}
          </span>
        </div>

        <Button variant="ghost" size="sm" aria-label="Notifications">
          <Bell className="h-5 w-5" />
        </Button>

        <Button variant="ghost" size="sm" aria-label="Toggle theme">
          <Moon className="h-5 w-5" />
        </Button>

        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            aria-expanded={userMenuOpen}
            aria-haspopup="true"
          >
            <User className="h-5 w-5" />
            <ChevronDown className="h-4 w-4" />
          </Button>

          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-lg border border-secondary-200 bg-white py-1 shadow-lg">
              <div className="px-4 py-2 border-b border-secondary-100">
                <p className="text-sm font-medium text-secondary-900">Operator</p>
                <p className="text-xs text-secondary-500">operator@utility.com</p>
              </div>
              <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-secondary-600 hover:bg-secondary-50">
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}