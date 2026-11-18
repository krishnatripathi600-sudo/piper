from __future__ import annotations
import os
import json
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import joblib
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, Union, List

from backend.schemas import ModelInfoResponse
from backend.action_engine import get_action_engine, ActionEngine


class GRUHead(nn.Module):
    """
    Minimal GRU -> Linear head for per-timestep logits.
    We use the last timestep's logit for binary classification.
    """
    def __init__(
        self,
        in_dim: int,
        hidden: int = 64,
        num_layers: int = 2,
        bidirectional: bool = False,
        dropout: float = 0.2,
    ):
        super().__init__()
        self.gru = nn.GRU(
            input_size=in_dim,
            hidden_size=hidden,
            num_layers=num_layers,
            batch_first=True,
            bidirectional=bidirectional,
            dropout=0.0 if num_layers == 1 else dropout,
        )
        out_dim = hidden * (2 if bidirectional else 1)
        self.fc = nn.Linear(out_dim, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: float tensor of shape [B, T, F]
        Returns:
            logits: float tensor of shape [B, T] (one logit per timestep)
        """
        out, _ = self.gru(x)
        out = self.fc(out)
        return out.squeeze(-1)


class LSTMHead(nn.Module):
    """
    Minimal LSTM -> Linear head for per-timestep logits.
    We use the last timestep's logit for binary classification.
    """
    def __init__(
        self,
        in_dim: int,
        hidden: int = 96,
        num_layers: int = 2,
        bidirectional: bool = False,
        dropout: float = 0.36,
    ):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=in_dim,
            hidden_size=hidden,
            num_layers=num_layers,
            batch_first=True,
            bidirectional=bidirectional,
            dropout=0.0 if num_layers == 1 else dropout,
        )
        out_dim = hidden * (2 if bidirectional else 1)
        self.fc = nn.Linear(out_dim, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: float tensor of shape [B, T, F]
        Returns:
            logits: float tensor of shape [B, T] (one logit per timestep)
        """
        out, _ = self.lstm(x)
        out = self.fc(out)
        return out.squeeze(-1)


ModelType = Union[GRUHead, LSTMHead]


class ModelLoader:
    """Loads and manages the model (GRU or LSTM) for inference."""

    def __init__(self, models_dir: Path, model_name: str = "gru"):
        """
        Args:
            models_dir: Directory containing model artifacts
            model_name: Which model to load ("gru" or "lstm")
        """
        self.models_dir = models_dir
        self.model_name = model_name.lower()
        self.model: Optional[ModelType] = None
        self.scaler = None
        self.meta: Dict[str, Any] = {}
        self.thr: float = 0.5
        self.feature_cols: list[str] = []
        self._loaded = False
        
        # Initialize action engine (look in backend directory)
        action_config_path = Path(__file__).parent / "action_config.yaml"
        if action_config_path.exists():
            self.action_engine: Optional[ActionEngine] = get_action_engine(action_config_path)
        else:
            self.action_engine = None
            print(f"[ModelLoader] Warning: Action config not found at {action_config_path}")

    def _get_artifact_paths(self) -> Tuple[Path, Path, Path]:
        """Get paths for meta, scaler, and state files based on model name."""
        if self.model_name == "lstm":
            return (
                self.models_dir / "lstm_cls_meta.json",
                self.models_dir / "lstm_cls_scaler.joblib",
                self.models_dir / "lstm_cls.pt",
            )
        else:  # default to gru
            return (
                self.models_dir / "gru_cls_meta.json",
                self.models_dir / "gru_cls_scaler.joblib",
                self.models_dir / "gru_cls.pt",
            )

    def load(self) -> bool:
        """Load model artifacts from disk."""
        try:
            meta_path, scaler_path, state_path = self._get_artifact_paths()

            if not all(p.exists() for p in [meta_path, scaler_path, state_path]):
                raise FileNotFoundError(
                    f"Missing {self.model_name.upper()} model artifacts in {self.models_dir}. "
                    f"Expected: {meta_path.name}, {scaler_path.name}, {state_path.name}"
                )

            # Load metadata
            with open(meta_path, "r", encoding="utf-8") as f:
                self.meta = json.load(f)

            self.feature_cols = list(self.meta["feature_cols"])
            in_dim = int(self.meta.get("in_dim", len(self.feature_cols)))
            hidden = int(self.meta["hidden"])
            num_layers = int(self.meta["num_layers"])
            bidirectional = bool(self.meta["bidirectional"])
            dropout = float(self.meta["dropout"])

            # Load threshold (allow env override like SageMaker)
            thr_env = os.environ.get("THR_OVERRIDE", "")
            self.thr = float(thr_env) if thr_env else float(self.meta.get("thr", 0.5))

            # Initialize model architecture based on type
            model_type = self.meta.get("model", "GRUHead")
            if model_type == "LSTMHead" or self.model_name == "lstm":
                self.model = LSTMHead(
                    in_dim=in_dim,
                    hidden=hidden,
                    num_layers=num_layers,
                    bidirectional=bidirectional,
                    dropout=dropout,
                )
            else:  # GRUHead
                self.model = GRUHead(
                    in_dim=in_dim,
                    hidden=hidden,
                    num_layers=num_layers,
                    bidirectional=bidirectional,
                    dropout=dropout,
                )

            # Load weights
            state = torch.load(state_path, map_location="cpu")
            self.model.load_state_dict(state)
            self.model.eval()

            # Load scaler
            self.scaler = joblib.load(scaler_path)

            self._loaded = True
            return True

        except Exception as e:
            print(f"[ModelLoader] Failed to load {self.model_name.upper()} model: {e}")
            self._loaded = False
            return False

    def is_loaded(self) -> bool:
        return self._loaded

    def get_model_info(self) -> ModelInfoResponse:
        """Get model metadata for API response."""
        if not self._loaded:
            raise RuntimeError("Model not loaded")

        # Try to load test metrics if available
        metrics = None
        metrics_name = f"{self.model_name}_cls_metrics.json"
        metrics_path = self.models_dir / metrics_name
        if metrics_path.exists():
            with open(metrics_path, "r") as f:
                metrics = json.load(f)

        return ModelInfoResponse(
            model=self.meta.get("model", "GRUHead"),
            task=self.meta.get("task", "cls"),
            window=int(self.meta.get("window", 48)),
            stride=int(self.meta.get("stride", 1)),
            in_dim=int(self.meta.get("in_dim", len(self.feature_cols))),
            feature_cols=self.feature_cols,
            hidden=int(self.meta["hidden"]),
            num_layers=int(self.meta["num_layers"]),
            bidirectional=bool(self.meta["bidirectional"]),
            dropout=float(self.meta["dropout"]),
            thr=self.thr,
            metrics=metrics,
        )

    def predict(
        self,
        X: np.ndarray,  # [B, W, F] raw features
        thr: Optional[float] = None,
        client_feats: Optional[list[str]] = None,
    ) -> Tuple[list[float], list[int], float]:
        """
        Run inference on batch of windows.

        Args:
            X: Raw features [B, W, F]
            thr: Optional threshold override
            client_feats: Optional feature order from client (must match training)

        Returns:
            (probs, preds, threshold_used)
        """
        if not self._loaded:
            raise RuntimeError("Model not loaded. Call load() first.")

        # Validate feature count
        B, W, F = X.shape
        if F != len(self.feature_cols):
            raise ValueError(
                f"Feature count mismatch: got F={F}, expected {len(self.feature_cols)}"
            )

        # Validate feature order if provided
        if client_feats is not None:
            if list(client_feats) != list(self.feature_cols):
                raise ValueError(
                    f"Feature order mismatch.\nExpected: {self.feature_cols}\nGot:      {client_feats}"
                )

        # Use request threshold or default
        threshold = float(thr) if thr is not None else self.thr

        # Flatten [B, W, F] -> [B*W, F] for scaling
        flat = X.reshape(B * W, F)
        df = pd.DataFrame(flat, columns=self.feature_cols)

        # Apply training scaler
        flat_scaled = self.scaler.transform(df).astype(np.float32)

        # Back to [B, W, F]
        xb = torch.from_numpy(flat_scaled.reshape(B, W, F))

        # Inference
        with torch.no_grad():
            logits_bt = self.model(xb).detach().numpy()  # [B, W]

        # Use last timestep logit for classification
        last_logits = logits_bt[:, -1]  # [B]

        # Sigmoid with clipping for numerical stability
        last_logits = np.clip(last_logits, -20.0, 20.0)
        probs = 1.0 / (1.0 + np.exp(-last_logits))  # [B] in [0, 1]
        preds = (probs >= threshold).astype(np.int32)  # [B] 0/1

        return probs.tolist(), preds.tolist(), threshold

    def predict_with_actions(
        self,
        X: np.ndarray,  # [B, W, F] raw features
        thr: Optional[float] = None,
        client_feats: Optional[list[str]] = None,
        degradation_scores: Optional[List[float]] = None,
    ) -> Tuple[list[float], list[int], float, list[dict], list[dict]]:
        """
        Run inference and generate action recommendations.
        
        Args:
            X: Raw features [B, W, F]
            thr: Optional threshold override
            client_feats: Optional feature order from client (must match training)
            degradation_scores: Optional degradation scores per window [0, 1]
            
        Returns:
            (probs, preds, threshold_used, actions_list, metadata_list)
        """
        # Get base predictions
        probs, preds, threshold = self.predict(X, thr, client_feats)
        
        # Generate actions if action engine is available
        if self.action_engine is not None:
            actions_list = []
            metadata_list = []
            
            for i, (prob, pred) in enumerate(zip(probs, preds)):
                degradation = degradation_scores[i] if degradation_scores and i < len(degradation_scores) else None
                
                result = self.action_engine.evaluate(
                    probability=prob,
                    binary_prediction=pred,
                    degradation_score=degradation,
                    threshold=threshold
                )
                
                # Convert ActionResult to dict for JSON serialization
                action_dict = {
                    "immediate": result.actions.get("immediate", []),
                    "short_term": result.actions.get("short_term", []),
                    "notifications": result.actions.get("notifications", []),
                    "priority": result.actions.get("priority", "UNKNOWN"),
                    "sla_hours": result.actions.get("sla_hours", 24),
                    "estimated_cost_tier": result.actions.get("estimated_cost_tier", "UNKNOWN"),
                    "simulated_response": result.actions.get("simulated_response")
                }
                actions_list.append(action_dict)
                metadata_list.append(result.metadata)
            
            return probs, preds, threshold, actions_list, metadata_list
        else:
            # No action engine - return empty actions
            empty_actions = [{
                "immediate": ["Action engine not configured"],
                "short_term": [],
                "notifications": [],
                "priority": "UNKNOWN",
                "sla_hours": 24,
                "estimated_cost_tier": "UNKNOWN"
            } for _ in probs]
            
            empty_metadata = [{
                "leak_tier": "UNKNOWN",
                "degradation_tier": None,
                "rule_matched": "NO_ENGINE",
                "probability": p,
                "binary_prediction": pred,
            } for p, pred in zip(probs, preds)]
            
            return probs, preds, threshold, empty_actions, empty_metadata


# Singleton instances for each model type
_model_loaders: Dict[str, ModelLoader] = {}


def get_model_loader(models_dir: Optional[Path] = None, model_name: str = "gru") -> ModelLoader:
    """Get or create the singleton model loader for the specified model type."""
    global _model_loaders
    if model_name not in _model_loaders:
        if models_dir is None:
            models_dir = Path(__file__).parent.parent / "models"
        _model_loaders[model_name] = ModelLoader(models_dir, model_name)
    
    loader = _model_loaders[model_name]
    if not loader.is_loaded():
        loader.load()
    return loader


def load_model(models_dir: Optional[Path] = None, model_name: str = "gru") -> bool:
    """Load the specified model (call on startup)."""
    loader = get_model_loader(models_dir, model_name)
    return loader.load()


def load_all_models(models_dir: Optional[Path] = None) -> Dict[str, bool]:
    """Load all available models (GRU and LSTM)."""
    results = {}
    for model_name in ["gru", "lstm"]:
        results[model_name] = load_model(models_dir, model_name)
    return results