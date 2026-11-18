import { forwardRef, SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'w-full px-3 py-2 text-sm rounded-lg border bg-white transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
          error ? 'border-danger-500' : 'border-secondary-300 hover:border-secondary-400',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      >
        {children}
      </select>
    )
  }
)

Select.displayName = 'Select'

interface SelectContentProps {
  children: React.ReactNode
}

export const SelectContent = ({ children }: SelectContentProps) => {
  return <>{children}</>
}

interface SelectItemProps {
  value: string
  children: React.ReactNode
  disabled?: boolean
}

export const SelectItem = forwardRef<HTMLOptionElement, SelectItemProps>(
  ({ value, children, disabled, ...props }, ref) => {
    return (
      <option
        ref={ref}
        value={value}
        disabled={disabled}
        className="px-3 py-2 text-sm"
        {...props}
      >
        {children}
      </option>
    )
  }
)

SelectItem.displayName = 'SelectItem'

interface SelectTriggerProps {
  children: React.ReactNode
  className?: string
}

export const SelectTrigger = ({ children, className }: SelectTriggerProps) => {
  return <div className={cn('relative', className)}>{children}</div>
}

interface SelectValueProps {
  placeholder?: string
  className?: string
}

export const SelectValue = ({ placeholder, className }: SelectValueProps) => {
  return <span className={cn('text-sm text-secondary-600', className)}>{placeholder}</span>
}