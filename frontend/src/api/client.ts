import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import type {
  PredictRequest,
  PredictResponse,
  ModelInfoResponse,
  HealthResponse,
  MetersResponse,
  SampleResponse,
  BatchPredictRequest,
  BatchPredictResponse,
  SHAPExplainRequest,
  SHAPExplainResponse,
} from '@/types/api'

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '/api/v1'

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

    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        // Add request timestamp for debugging
        (config as any).metadata = { startTime: Date.now() }
        return config
      },
      (error: AxiosError) => Promise.reject(error)
    )

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 503) {
          console.warn('Service unavailable - model may not be loaded')
        }
        return Promise.reject(error)
      }
    )
  }

  async healthCheck(): Promise<HealthResponse> {
    const { data } = await this.client.get<HealthResponse>('/health')
    return data
  }

  async getModelInfo(): Promise<ModelInfoResponse> {
    const { data } = await this.client.get<ModelInfoResponse>('/model/info')
    return data
  }

  async predict(request: PredictRequest): Promise<PredictResponse> {
    const { data } = await this.client.post<PredictResponse>('/predict', request)
    return data
  }

  async getMeters(): Promise<MetersResponse> {
    const { data } = await this.client.get<MetersResponse>('/meters')
    return data
  }

  async getSampleWindows(
    n: number = 10,
    meterIds?: string[],
    seed: number = 42
  ): Promise<SampleResponse> {
    const params = new URLSearchParams()
    params.set('n', n.toString())
    if (meterIds?.length) params.set('meter_ids', meterIds.join(','))
    params.set('seed', seed.toString())

    const { data } = await this.client.get<SampleResponse>(`/data/sample?${params}`)
    return data
  }

  async batchPredict(request: BatchPredictRequest): Promise<BatchPredictResponse> {
    const { data } = await this.client.post<BatchPredictResponse>('/predict/batch', request)
    return data
  }

  async shapExplain(request: SHAPExplainRequest): Promise<SHAPExplainResponse> {
    const { data } = await this.client.post<SHAPExplainResponse>('/explain/shap', request)
    return data
  }
}

export const api = new ApiClient()

// Type-safe API functions for React Query or direct use
export const apiEndpoints = {
  health: () => api.healthCheck(),
  modelInfo: () => api.getModelInfo(),
  predict: (request: PredictRequest) => api.predict(request),
  meters: () => api.getMeters(),
  sampleWindows: (n?: number, meterIds?: string[], seed?: number) =>
    api.getSampleWindows(n, meterIds, seed),
  batchPredict: (request: BatchPredictRequest) => api.batchPredict(request),
  shapExplain: (request: SHAPExplainRequest) => api.shapExplain(request),
}