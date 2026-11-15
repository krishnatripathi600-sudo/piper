import { useState, useEffect, useCallback, useRef } from 'react'
import { apiEndpoints } from '@/api/client'
import type {
  BatchPredictResponse,
  PredictRequest,
  PredictResponse,
} from '@/types/api'

interface UseApiState<T> {
  data: T | null
  error: Error | null
  isLoading: boolean
  isRefreshing: boolean
}

interface UseApiOptions {
  /** Skip initial fetch (for manual triggering) */
  manual?: boolean
  /** Dependencies that should trigger a refetch when changed */
  deps?: unknown[]
}

function useApi<T>(
  fetcher: () => Promise<T>,
  options: UseApiOptions = {}
): UseApiState<T> & { refetch: () => void } {
  const { manual = false, deps = [] } = options
  
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    error: null,
    isLoading: !manual,
    isRefreshing: false,
  })

  const isMountedRef = useRef(true)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const fetch = useCallback(async (isRefresh = false) => {
    if (!isMountedRef.current) return
    
    if (isRefresh) {
      setState(prev => ({ ...prev, isRefreshing: true, error: null }))
    } else {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
    }
    
    try {
      const data = await fetcherRef.current()
      if (!isMountedRef.current) return
      setState({ data, error: null, isLoading: false, isRefreshing: false })
    } catch (err) {
      if (!isMountedRef.current) return
      setState({ 
        data: null, 
        error: err as Error, 
        isLoading: false, 
        isRefreshing: false 
      })
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    isMountedRef.current = true
    if (!manual) {
      fetch(false)
    }
    return () => {
      isMountedRef.current = false
    }
  }, [fetch, manual])

  // Refetch when deps change
  useEffect(() => {
    if (manual) return
    if (deps.length === 0) return
    
    const fetchWithRefresh = async () => {
      await fetch(true)
    }
    fetchWithRefresh()
  }, [...deps, fetch])

  return { ...state, refetch: () => fetch(true) }
}

// Stable fetcher functions to prevent unnecessary refetches
const healthFetcher = () => apiEndpoints.health()
const modelInfoFetcher = () => apiEndpoints.modelInfo()
const metersFetcher = () => apiEndpoints.meters()

export function useHealth() {
  return useApi(healthFetcher)
}

export function useModelInfo() {
  return useApi(modelInfoFetcher)
}

export function useMeters() {
  return useApi(metersFetcher)
}

export function useSampleWindows(n = 10, meterIds?: string[], seed = 42) {
  const deps = [n, meterIds?.join(','), seed]
  const fetcher = useCallback(() => apiEndpoints.sampleWindows(n, meterIds, seed), [n, meterIds, seed])
  return useApi(fetcher, { deps })
}

export function usePredict() {
  const [state, setState] = useState<{
    data: PredictResponse | null
    error: Error | null
    isLoading: boolean
  }>({
    data: null,
    error: null,
    isLoading: false,
  })

  const predict = useCallback(async (request: PredictRequest) => {
    setState({ data: null, error: null, isLoading: true })
    try {
      const data = await apiEndpoints.predict(request)
      setState({ data, error: null, isLoading: false })
      return data
    } catch (err) {
      setState({ data: null, error: err as Error, isLoading: false })
      throw err
    }
  }, [])

  return { ...state, predict }
}

export function useBatchPredict() {
  const [state, setState] = useState<{
    data: BatchPredictResponse | null
    error: Error | null
    isLoading: boolean
  }>({
    data: null,
    error: null,
    isLoading: false,
  })

  const predict = useCallback(async (request: {
    meter_ids?: string[]
    max_windows_per_meter?: number
    thr?: number
  }) => {
    setState({ data: null, error: null, isLoading: true })
    try {
      const data = await apiEndpoints.batchPredict(request)
      setState({ data, error: null, isLoading: false })
      return data
    } catch (err) {
      setState({ data: null, error: err as Error, isLoading: false })
      throw err
    }
  }, [])

  return { ...state, predict }
}