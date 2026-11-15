import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { Predict } from '@/pages/Predict'
import { Performance } from '@/pages/Performance'
import { DataExplorer } from '@/pages/DataExplorer'
import { Settings } from '@/pages/Settings'
import { Help } from '@/pages/Help'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="predict" element={<Predict />} />
        <Route path="performance" element={<Performance />} />
        <Route path="data" element={<DataExplorer />} />
        <Route path="settings" element={<Settings />} />
        <Route path="help" element={<Help />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}