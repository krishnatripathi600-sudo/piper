from __future__ import annotations
import os
import json
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import joblib
from pathlib import Path
from typing import Dict, Any, Optional, Tuple

from backend.schemas import ModelInfoResponse


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


class ModelLoader:
    """Loads and manages the GRU model for inference."""

    def __init__(self, models_dir: Path):
        self.models_dir = models_dir
        self.model: Optional[GRUHead] = None
        self.scaler = None
        self.meta: Dict[str, Any] = {}
        self.thr: float = 0.5
        self.feature_cols: list[str] = []
        self._loaded = False

    def load(self) -> bool:
        """Load model artifacts from disk."""
        try:
            meta_path = self.models_dir / "gru_cls_meta.json"
            scaler_path = self.models_dir / "gru_cls_scaler.joblib"
            state_path = self.models_dir / "gru_cls.pt"

            if not all(p.exists() for p in [meta_path, scaler_path, state_path]):
                raise FileNotFoundError(
                    f"Missing model artifacts in {self.models_dir}. "
                    f"Expected: gru_cls_meta.json, gru_cls_scaler.joblib, gru_cls.pt"
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

            # Initialize model architecture
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
            print(f"[ModelLoader] Failed to load model: {e}")
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
        metrics_path = self.models_dir / "gru_cls_metrics.json"
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


# Singleton instance
_model_loader: Optional[ModelLoader] = None


def get_model_loader(models_dir: Optional[Path] = None) -> ModelLoader:
    """Get or create the singleton model loader."""
    global _model_loader
    if _model_loader is None:
        if models_dir is None:
            models_dir = Path(__file__).parent.parent / "models"
        _model_loader = ModelLoader(models_dir)
    return _model_loader


def load_model(models_dir: Optional[Path] = None) -> bool:
    """Load the model (call on startup)."""
    loader = get_model_loader(models_dir)
    return loader.load()