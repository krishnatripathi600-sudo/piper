from __future__ import annotations
import json
import numpy as np
import pandas as pd
from pathlib import Path
from typing import List, Optional, Tuple

from backend.schemas import MeterInfo, SampleWindow, SampleResponse
from backend.model_loader import get_model_loader
from utils.constants import (
    METER_ID_COL, TIMESTAMP_COL, LEAK_FLAG_COL, CLS_FEATURE_COLS
)


class DataService:
    """Service for accessing test data and meter information."""

    def __init__(self, models_dir: Path, data_dir: Path):
        self.models_dir = models_dir
        self.data_dir = data_dir
        self._test_df: Optional[pd.DataFrame] = None
        self._meta: Optional[dict] = None
        self._feature_cols: Optional[List[str]] = None
        self._window: int = 48

    def _load_meta(self) -> dict:
        """Load model metadata."""
        if self._meta is None:
            meta_path = self.models_dir / "gru_cls_meta.json"
            with open(meta_path, "r", encoding="utf-8") as f:
                self._meta = json.load(f)
            self._feature_cols = list(self._meta.get("feature_cols", CLS_FEATURE_COLS))
            self._window = int(self._meta.get("window", 48))
        return self._meta

    def _load_test_data(self) -> pd.DataFrame:
        """Load frozen test parquet."""
        if self._test_df is None:
            test_path = self.models_dir / "artifacts" / "test_agg.parquet"
            if not test_path.exists():
                raise FileNotFoundError(f"Test data not found at {test_path}")
            self._test_df = pd.read_parquet(test_path)
            # Ensure sorted
            self._test_df = self._test_df.sort_values([METER_ID_COL, TIMESTAMP_COL]).reset_index(drop=True)
        return self._test_df

    def get_meters(self) -> List[MeterInfo]:
        """Get list of available meters with metadata."""
        # Try test data first
        try:
            df = self._load_test_data()
        except FileNotFoundError:
            # Fall back to raw CSV data
            df = self._load_raw_data()

        meters = []
        for meter_id, group in df.groupby(METER_ID_COL, sort=False):
            group = group.sort_values(TIMESTAMP_COL)
            meters.append(MeterInfo(
                meter_id=meter_id,
                n_readings=len(group),
                date_range={
                    "start": group[TIMESTAMP_COL].min().isoformat() if len(group) > 0 else None,
                    "end": group[TIMESTAMP_COL].max().isoformat() if len(group) > 0 else None,
                }
            ))
        return meters

    def _load_raw_data(self) -> pd.DataFrame:
        """Load raw CSV data from LeakageData directory."""
        from utils.DataAggregation import find_csvs, load_and_merge
        csv_paths = find_csvs(self.data_dir)
        df = load_and_merge(csv_paths)
        return df

    def get_sample_windows(
        self,
        n: int = 10,
        meter_ids: Optional[List[str]] = None,
        seed: int = 42,
    ) -> SampleResponse:
        """Get sample windows from test data for testing."""
        self._load_meta()
        test_df = self._load_test_data()

        if meter_ids:
            test_df = test_df[test_df[METER_ID_COL].isin(meter_ids)]

        if len(test_df) == 0:
            return SampleResponse(
                windows=[],
                feature_cols=self._feature_cols or CLS_FEATURE_COLS,
                window_size=self._window,
                total_available=0,
            )

        # Build windows - limit total windows to avoid timeout
        X_windows, meta_rows = [], []
        feature_cols = self._feature_cols or CLS_FEATURE_COLS
        max_total_windows = 5000  # Limit to prevent timeout

        for m, g in test_df.groupby(METER_ID_COL, sort=False):
            g = g.sort_values(TIMESTAMP_COL).reset_index(drop=True)
            if len(g) < self._window:
                continue
            
            # Calculate how many windows we can take from this meter
            meter_windows = len(g) - self._window + 1
            if meter_windows <= 0:
                continue
            
            # Sample windows from this meter (spread out)
            step = max(1, meter_windows // min(50, meter_windows))
            for end in range(self._window - 1, len(g), step):
                if len(X_windows) >= max_total_windows:
                    break
                sl = g.iloc[end - self._window + 1 : end + 1]
                X_windows.append(sl[feature_cols].to_numpy(dtype=np.float32))
                meta_rows.append({
                    "meter_id": m,
                    "timestamp_end": sl.iloc[-1][TIMESTAMP_COL],
                    "hour": int(sl.iloc[-1]["Hour"]) if "Hour" in sl.columns else -1,
                    "y_true": int(sl.iloc[-1][LEAK_FLAG_COL]),
                })
            if len(X_windows) >= max_total_windows:
                break

        if not X_windows:
            return SampleResponse(
                windows=[],
                feature_cols=feature_cols,
                window_size=self._window,
                total_available=0,
            )

        X_windows = np.stack(X_windows, axis=0)
        meta_df = pd.DataFrame(meta_rows)

        # Sample
        rng = np.random.default_rng(seed)
        total = len(X_windows)
        n = min(n, total)
        idx = rng.choice(total, size=n, replace=False)

        windows = []
        for i in idx:
            windows.append(SampleWindow(
                meter_id=meta_df.iloc[i]["meter_id"],
                timestamp_end=str(meta_df.iloc[i]["timestamp_end"]),
                hour=int(meta_df.iloc[i]["hour"]),
                y_true=int(meta_df.iloc[i]["y_true"]),
                features=X_windows[i].tolist(),
            ))

        return SampleResponse(
            windows=windows,
            feature_cols=feature_cols,
            window_size=self._window,
            total_available=total,
        )

    def get_batch_windows(
        self,
        meter_ids: Optional[List[str]] = None,
        max_windows_per_meter: int = 10,
    ) -> Tuple[np.ndarray, pd.DataFrame]:
        """Get windows for batch prediction from test data."""
        self._load_meta()
        test_df = self._load_test_data()

        if meter_ids:
            test_df = test_df[test_df[METER_ID_COL].isin(meter_ids)]

        feature_cols = self._feature_cols or CLS_FEATURE_COLS
        X_windows, meta_rows = [], []

        for m, g in test_df.groupby(METER_ID_COL, sort=False):
            g = g.sort_values(TIMESTAMP_COL).reset_index(drop=True)
            if len(g) < self._window:
                continue
            # Take up to max_windows_per_meter windows (spread out)
            ends = range(self._window - 1, len(g))
            if len(list(ends)) > max_windows_per_meter:
                step = max(1, len(list(ends)) // max_windows_per_meter)
                ends = range(self._window - 1, len(g), step)

            for end in ends:
                sl = g.iloc[end - self._window + 1 : end + 1]
                X_windows.append(sl[feature_cols].to_numpy(dtype=np.float32))
                meta_rows.append({
                    "meter_id": m,
                    "timestamp_end": sl.iloc[-1][TIMESTAMP_COL],
                    "y_true": int(sl.iloc[-1][LEAK_FLAG_COL]),
                })

        if not X_windows:
            return np.empty((0, self._window, len(feature_cols)), dtype=np.float32), pd.DataFrame()

        return np.stack(X_windows, axis=0), pd.DataFrame(meta_rows)


# Singleton
_data_service: Optional[DataService] = None


def get_data_service(
    models_dir: Optional[Path] = None,
    data_dir: Optional[Path] = None,
) -> DataService:
    global _data_service
    if _data_service is None:
        if models_dir is None:
            models_dir = Path(__file__).parent.parent / "models"
        if data_dir is None:
            data_dir = Path(__file__).parent.parent / "LeakageData"
        _data_service = DataService(models_dir, data_dir)
    return _data_service