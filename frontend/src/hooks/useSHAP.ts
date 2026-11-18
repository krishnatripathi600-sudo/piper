import { useCallback, useState } from 'react'
import { apiEndpoints } from '@/api/client'
import type { SHAPExplainRequest, SHAPExplainResponse } from '@/types/api'

export function useSHAP() {
  const [data, setData] = useState<SHAPExplainResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const explain = useCallback(async (request: SHAPExplainRequest) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await apiEndpoints.shapExplain(request)
      setData(result)
      return result
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clear = useCallback(() => {
    setData(null)
    setError(null)
  }, [])

  return { data, isLoading, error, explain, clear }
}