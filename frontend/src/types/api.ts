export interface PredictRequest {
  windows: number[][][]
  feature_cols?: string[]
  thr?: number
}

export interface PredictResponse {
  probs: number[]
  preds: number[]
  thr: number
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
  f2?: number
  ap?: number
  cm?: number[][]
  thr: number
}

export interface HealthResponse {
  status: string
  model_loaded: boolean
  model_type?: string
}

export interface MeterInfo {
  meter_id: string
  n_readings: number
  date_range: {
    start: string | null
    end: string | null
  }
}

export interface MetersResponse {
  meters: MeterInfo[]
  total: number
}

export interface SampleWindow {
  meter_id: string
  timestamp_end: string
  hour: number
  y_true: number
  features: number[][]
}

export interface SampleResponse {
  windows: SampleWindow[]
  feature_cols: string[]
  window_size: number
  total_available: number
}

export interface BatchPredictRequest {
  meter_ids?: string[]
  max_windows_per_meter?: number
  thr?: number
}

export interface BatchPredictResult {
  meter_id: string
  timestamp_end: string
  y_true: number
  prob: number
  pred: number
}

export interface BatchPredictResponse {
  results: BatchPredictResult[]
  summary: {
    total: number
    leaks_detected: number
    actual_leaks: number
    correct_predictions: number
    accuracy: number
  }
  thr_used: number
}

export interface ApiError {
  detail: string
  status: number
}

export type PredictionLabel = 'No Leak' | 'Leak'
export type PredictionStatus = 'correct' | 'incorrect' | 'unknown'