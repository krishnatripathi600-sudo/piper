# Frontend Architecture

Detailed architecture of the PIPER React + TypeScript + Vite frontend.

## 📁 Directory Structure

```
frontend/
├── index.html                 # Entry HTML
├── package.json               # Dependencies & scripts
├── tsconfig.json              # TypeScript config
├── tsconfig.node.json         # Node-specific TS config
├── vite.config.ts             # Vite configuration
├── tailwind.config.js         # Tailwind CSS config
├── postcss.config.js          # PostCSS config
├── public/
│   └── favicon.svg
├── src/
│   ├── main.tsx               # App entry point
│   ├── App.tsx                # Root component + routing
│   ├── index.css              # Global styles + Tailwind imports
│   ├── vite-env.d.ts          # Vite type declarations
│   ├── api/
│   │   └── client.ts          # Axios API client
│   ├── hooks/
│   │   └── useApi.ts          # Custom React hooks for API
│   ├── types/
│   │   └── api.ts             # TypeScript types for API
│   ├── components/
│   │   ├── ui/                # Reusable UI primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Table.tsx
│   │   │   └── Badge.tsx
│   │   └── layout/            # Layout components
│   │       ├── Layout.tsx
│   │       ├── Header.tsx
│   │       └── Sidebar.tsx
│   ├── pages/                 # Page components
│   │   ├── Dashboard.tsx
│   │   ├── Predict.tsx
│   │   ├── Performance.tsx
│   │   ├── DataExplorer.tsx
│   │   ├── Settings.tsx
│   │   └── Help.tsx
│   └── lib/
│       └── utils.ts           # Utility functions
```

## 🎯 Technology Stack

| Category | Technology | Version |
|----------|------------|---------|
| **Framework** | React | 18.2 |
| **Language** | TypeScript | 5.2 |
| **Build Tool** | Vite | 5.1 |
| **Styling** | Tailwind CSS | 3.4 |
| **Routing** | React Router | 6.22 |
| **HTTP Client** | Axios | 1.6 |
| **Charts** | Recharts | 2.12 |
| **Icons** | Lucide React | 0.344 |
| **Utilities** | clsx, tailwind-merge | 2.1, 2.2 |
| **Linting** | ESLint | 8.56 |
| **Type Checking** | TypeScript | 5.2 |

## ⚙️ Configuration Files

### Vite Config (`vite.config.ts`)
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
```

### TypeScript Config (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### Tailwind Config (`tailwind.config.js`)
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
        },
      },
    },
  },
  plugins: [],
}
```

## 🔌 API Layer

### API Client (`src/api/client.ts`)
```typescript
import axios, { AxiosInstance, AxiosError } from 'axios'
import type { ApiError } from '../types/api'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiError>) => {
        const message = error.response?.data?.detail || error.message
        return Promise.reject(new Error(message))
      }
    )
  }

  // Health
  async health() { return this.client.get('/health') }

  // Model
  async getModelInfo() { return this.client.get('/model/info') }

  // Prediction
  async predict(data: PredictionRequest) { 
    return this.client.post('/predict', data) 
  }
  async predictBatch(data: BatchPredictionRequest) { 
    return this.client.post('/predict/batch', data) 
  }

  // Data
  async getMeters() { return this.client.get('/meters') }
  async getSampleData(params: SampleDataParams) { 
    return this.client.get('/data/sample', { params }) 
  }
}

export const apiClient = new ApiClient()
```

### Custom Hooks (`src/hooks/useApi.ts`)
```typescript
import { useQuery, useMutation, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query'
import { apiClient } from '../api/client'

// Health
export function useHealth(options?: UseQueryOptions) {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiClient.health(),
    refetchInterval: 30000,
    ...options,
  })
}

// Model Info
export function useModelInfo(options?: UseQueryOptions) {
  return useQuery({
    queryKey: ['modelInfo'],
    queryFn: () => apiClient.getModelInfo(),
    staleTime: 5 * 60 * 1000,
    ...options,
  })
}

// Prediction
export function usePredict(options?: UseMutationOptions) {
  return useMutation({
    mutationFn: (data: PredictionRequest) => apiClient.predict(data),
    ...options,
  })
}

export function usePredictBatch(options?: UseMutationOptions) {
  return useMutation({
    mutationFn: (data: BatchPredictionRequest) => apiClient.predictBatch(data),
    ...options,
  })
}

// Data
export function useMeters(options?: UseQueryOptions) {
  return useQuery({
    queryKey: ['meters'],
    queryFn: () => apiClient.getMeters(),
    staleTime: 5 * 60 * 1000,
    ...options,
  })
}

export function useSampleData(params: SampleDataParams, options?: UseQueryOptions) {
  return useQuery({
    queryKey: ['sampleData', params],
    queryFn: () => apiClient.getSampleData(params),
    enabled: !!params,
    ...options,
  })
}
```

## 📝 Type Definitions (`src/types/api.ts`)

```typescript
// Request Types
export interface PredictionRequest {
  windows: number[][][]  // [B, W, F]
  feature_cols?: string[]
  thr?: number
}

export interface BatchPredictionRequest {
  thr?: number
}

export interface SampleDataParams {
  n?: number
  meter_id?: string
}

// Response Types
export interface HealthResponse {
  status: string
  model_loaded: boolean
  timestamp: string
}

export interface ModelInfoResponse {
  model: string
  task: string
  window: number
  stride: number
  in_dim: number
  feature_cols: string[]
  hidden: number
  num_layers: number
  bidirectional: boolean
  dropout: number
  thr: number
  metrics?: ModelMetrics
}

export interface ModelMetrics {
  accuracy: number
  precision: number
  recall: number
  f1: number
  auc?: number
  confusion_matrix: number[][]
}

export interface PredictionResponse {
  probs: number[]
  preds: number[]
  thr: number
}

export interface BatchPredictionResponse {
  predictions: PredictionResponse[]
  metrics?: ModelMetrics
  meter_breakdown?: MeterBreakdown[]
}

export interface MeterBreakdown {
  meter_id: string
  accuracy: number
  f1: number
  n_windows: number
}

export interface MetersResponse {
  meters: string[]
}

export interface SampleDataResponse {
  windows: number[][][]
  feature_cols: string[]
  metadata: WindowMetadata[]
}

export interface WindowMetadata {
  meter_id: string
  window_idx: number
  timestamp: string
  label: number
}

export interface ApiError {
  detail: string
  type?: string
}
```

## 🎨 UI Components

### Base Components (`src/components/ui/`)

#### Button (`Button.tsx`)
```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50'
  
  const variants = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
    outline: 'border border-gray-300 bg-transparent hover:bg-gray-50',
    ghost: 'hover:bg-gray-100 hover:text-gray-900',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
  }
  
  const sizes = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4 py-2',
    lg: 'h-12 px-8 text-lg',
  }

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}
```

#### Card (`Card.tsx`)
```typescript
interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
}

export function Card({ children, className, hover = false }) {
  return (
    <div
      className={cn(
        'bg-white rounded-lg border border-gray-200 shadow-sm',
        hover && 'hover:shadow-md transition-shadow',
        className
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className }) {
  return <div className={cn('px-6 py-4 border-b border-gray-200', className)}>{children}</div>
}

export function CardContent({ children, className }) {
  return <div className={cn('px-6 py-4', className)}>{children}</div>
}

export function CardFooter({ children, className }) {
  return <div className={cn('px-6 py-4 border-t border-gray-200 bg-gray-50', className)}>{children}</div>
}
```

#### Table (`Table.tsx`)
```typescript
interface Column<T> {
  key: string
  header: string
  render?: (value: any, row: T) => React.ReactNode
  className?: string
}

interface TableProps<T> {
  data: T[]
  columns: Column<T>[]
  keyExtractor: (row: T) => string
  className?: string
  emptyMessage?: string
  onRowClick?: (row: T) => void
}

export function Table<T>({ data, columns, keyExtractor, className, emptyMessage, onRowClick }: TableProps<T>) {
  if (data.length === 0) {
    return <div className="text-center py-8 text-gray-500">{emptyMessage || 'No data'}</div>
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {columns.map((col) => (
              <th key={col.key} className={cn('px-4 py-3 text-left font-medium text-gray-500', col.className)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((row) => (
            <tr
              key={keyExtractor(row)}
              className={cn('hover:bg-gray-50 transition-colors', onRowClick && 'cursor-pointer')}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <td key={col.key} className={cn('px-4 py-3', col.className)}>
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

### Layout Components (`src/components/layout/`)

#### Layout (`Layout.tsx`)
```typescript
interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
```

#### Sidebar (`Sidebar.tsx`)
```typescript
import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Activity, BarChart3, Database, Settings, HelpCircle } from 'lucide-react'

const navigation = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/predict', label: 'Live Prediction', icon: Activity },
  { path: '/performance', label: 'Model Performance', icon: BarChart3 },
  { path: '/data', label: 'Data Explorer', icon: Database },
  { path: '/settings', label: 'Settings', icon: Settings },
  { path: '/help', label: 'Help', icon: HelpCircle },
]

export function Sidebar() {
  const location = useLocation()
  
  return (
    <aside className="w-64 bg-white border-r border-gray-200 hidden lg:block">
      <nav className="p-4 space-y-1">
        {navigation.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              'flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary-50 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            <item.icon className="mr-3 h-5 w-5" aria-hidden="true" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
```

## 📄 Pages

### Dashboard (`Dashboard.tsx`)
- System status cards (model loaded, uptime, version)
- Quick stats (total predictions, accuracy, recent activity)
- Recent predictions table
- Quick actions (navigate to predict, performance, data)

### Predict (`Predict.tsx`)
- Input methods: Manual entry, Sample data, JSON upload, CSV upload
- Feature grid editor (48×9 matrix)
- Real-time validation
- Prediction results: Probability gauge, binary badge, confidence
- History of predictions in session

### Performance (`Performance.tsx`)
- Metric cards (Accuracy, Precision, Recall, F1, AUC)
- Confusion matrix heatmap
- Per-meter breakdown table
- Feature importance (if available)
- Threshold analysis

### Data Explorer (`DataExplorer.tsx`)
- Meter selector dropdown
- Paginated table of test windows
- Window detail modal (features, timestamp, label)
- Export to CSV
- Statistics summary

### Settings (`Settings.tsx`)
- API URL configuration
- Threshold override
- Theme toggle (light/dark)
- Notification preferences
- About/version info

### Help (`Help.tsx`)
- FAQ accordion
- API reference (auto-generated from OpenAPI)
- Quick start guides
- Troubleshooting
- Links to repository, issues

## 🔄 State Management

### React Query (TanStack Query)
```typescript
// QueryClient setup in main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// Usage in components
const { data, isLoading, error } = useModelInfo()
const predictMutation = usePredict({
  onSuccess: (data) => {
    // Update local state, show toast
  },
})
```

### Local State (useState/useReducer)
- Form inputs (Prediction page)
- UI state (modals, sidebars, tabs)
- Session history (predictions)

### Context (for global state)
```typescript
// ThemeContext, SettingsContext if needed
```

## 🎨 Styling Approach

### Tailwind CSS Utilities
- **Utility-first**: Compose styles with classes
- **Responsive**: `sm:`, `md:`, `lg:`, `xl:` prefixes
- **Dark mode**: `dark:` variant (class strategy)
- **Custom colors**: Primary palette in `tailwind.config.js`

### Component Patterns
```typescript
// Consistent spacing
'p-4 md:p-6 lg:p-8'

// Card pattern
'bg-white rounded-lg border border-gray-200 shadow-sm'

// Button pattern
'inline-flex items-center justify-center px-4 py-2 rounded-md font-medium transition-colors'

// Form input pattern
'w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
```

### clsx + tailwind-merge
```typescript
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Usage
<div className={cn('base-styles', condition && 'conditional-styles', props.className)} />
```

## 📱 Responsive Design

| Breakpoint | Width | Usage |
|------------|-------|-------|
| `sm` | 640px | Tablets |
| `md` | 768px | Small laptops |
| `lg` | 1024px | Desktops (sidebar shows) |
| `xl` | 1280px | Large desktops |
| `2xl` | 1536px | Ultra-wide |

### Sidebar Behavior
- **Mobile (< lg)**: Hidden, toggle via hamburger menu
- **Desktop (≥ lg)**: Always visible, fixed width 256px

## 🔧 Build & Development

### Development Server
```bash
npm run dev
# Starts Vite on http://localhost:3000
# HMR enabled
# Proxy /api/* to http://localhost:8000
```

### Production Build
```bash
npm run build
# Runs: tsc && vite build
# Output: dist/
# - index.html
# - assets/index-[hash].js
# - assets/index-[hash].css
# - favicon.svg
```

### Preview Production Build
```bash
npm run preview
# Serves dist/ on http://localhost:4173
```

### Type Checking
```bash
npx tsc --noEmit
# Runs TypeScript compiler without emitting files
```

### Linting
```bash
npm run lint
# Runs ESLint on src/**/*.{ts,tsx}
```

## 📦 Dependency Graph

```
src/main.tsx
  └── App.tsx (Router)
       ├── Layout.tsx
       │    ├── Sidebar.tsx (NavLink)
       │    └── Header.tsx
       └── Routes
            ├── / → Dashboard.tsx
            ├── /predict → Predict.tsx
            │     ├── usePredict hook
            │     ├── UI components (Button, Card, Input, Table)
            │     └── api/client
            ├── /performance → Performance.tsx
            │     ├── useModelInfo, usePredictBatch hooks
            │     ├── Recharts components
            │     └── UI components
            ├── /data → DataExplorer.tsx
            │     ├── useMeters, useSampleData hooks
            │     ├── Table, Modal components
            │     └── api/client
            ├── /settings → Settings.tsx
            └── /help → Help.tsx
```

## ♿ Accessibility

- Semantic HTML (`<main>`, `<nav>`, `<aside>`, `<header>`)
- ARIA labels on interactive elements
- Focus visible outlines
- Color contrast ratios (WCAG AA)
- Keyboard navigation support
- Screen reader friendly tables

## 🔒 Security

- **CSP**: Content Security Policy via meta tag
- **XSS Prevention**: React's built-in escaping
- **API URLs**: Environment variables only
- **No sensitive data** in localStorage/cookies
- **HTTPS** enforced in production

## 📈 Performance

### Code Splitting
```typescript
// Lazy load pages
const Predict = lazy(() import('./pages/Predict'))
const Performance = lazy(() import('./pages/Performance'))

// In App.tsx
<Suspense fallback={<PageSkeleton />}>
  <Routes>
    <Route path="/predict" element={<Predict />} />
    <Route path="/performance" element={<Performance />} />
  </Routes>
</Suspense>
```

### Bundle Optimization
- Tree shaking (ES modules)
- Minification (esbuild)
- CSS purging (Tailwind)
- Asset hashing (cache busting)

### Runtime Performance
- React Query caching (5 min staleTime)
- Memoization (`React.memo`, `useMemo`, `useCallback`)
- Virtualized tables for large datasets (if needed)

---

## 📋 Quick Reference

| File | Purpose |
|------|---------|
| `src/main.tsx` | Entry, QueryClient, Router |
| `src/App.tsx` | Routes, Layout |
| `src/api/client.ts` | Axios instance, endpoints |
| `src/hooks/useApi.ts` | React Query hooks |
| `src/types/api.ts` | TypeScript interfaces |
| `src/components/ui/` | Reusable primitives |
| `src/components/layout/` | Layout shell |
| `src/pages/` | Route components |
| `vite.config.ts` | Dev server, build, aliases |
| `tailwind.config.js` | Theme, colors, plugins |