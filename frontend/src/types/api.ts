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
    action_priority_distribution?: Record<string, number>
  }
  thr_used: number
}

// Replay Mode types
export interface ReplayWindow extends SampleWindow {
  probability?: number
  prediction?: number
  actions?: {
    immediate: string[]
    short_term: string[]
    notifications: string[]
    priority: string
    sla_hours: number
    estimated_cost_tier: string
    simulated_response?: SimulatedResponse
  }
  metadata?: Record<string, unknown>
}

export interface SimulatedResponse {
  alert_type: string
  severity: string
  message: string
  channels: string[]
  auto_escalate_minutes: number
  acknowledgement_required: boolean
  escalation_contact: string
  template_id: string
}

export interface ReplayState {
  isPlaying: boolean
  speed: number
  currentIndex: number
  windows: ReplayWindow[]
  results: ReplayWindow[]
  currentWindow: ReplayWindow | null
  intervalMs: number
}

export interface ApiError {
  detail: string
  status: number
}

export type PredictionLabel = 'No Leak' | 'Leak'
export type PredictionStatus = 'correct' | 'incorrect' | 'unknown'

// SHAP Explainability types
export interface SHAPExplainRequest {
  windows: number[][][]
  feature_cols?: string[]
  method?: 'tree' | 'kernel'
  max_samples?: number
}

export interface SHAPExplainResponse {
  shap_values: number[][]
  base_value: number
  feature_names: string[]
  data: number[][]
  aggregated_importance: Record<string, number>
}