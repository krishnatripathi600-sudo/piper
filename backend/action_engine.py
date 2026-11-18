from __future__ import annotations
import yaml
from pathlib import Path
from typing import Dict, Any, List, Optional, Union
from dataclasses import dataclass, field
import logging

logger = logging.getLogger(__name__)


@dataclass
class ProbabilityTier:
    name: str
    min_prob: float
    max_prob: float
    priority: int
    color: str
    label: str


@dataclass
class DegradationTier:
    name: str
    min_score: float
    max_score: float
    label: str


@dataclass
class ActionRule:
    id: str
    condition: Dict[str, Any]
    actions: Dict[str, Any]
    simulated_response: Optional[Dict[str, Any]] = None


@dataclass
class ActionResult:
    """Result of action evaluation."""
    rule_id: str
    leak_tier: str
    degradation_tier: Optional[str]
    probability: float
    degradation_score: Optional[float]
    binary_prediction: int
    actions: Dict[str, Any]
    metadata: Dict[str, Any] = field(default_factory=dict)


class ActionEngine:
    """
    Evaluates leak predictions against configured action rules.
    
    Loads rules from YAML config and determines appropriate operational
    actions based on leak probability tier and degradation tier.
    """
    
    def __init__(self, config_path: Union[str, Path]):
        self.config_path = Path(config_path)
        self.probability_tiers: List[ProbabilityTier] = []
        self.degradation_tiers: List[DegradationTier] = []
        self.action_rules: List[ActionRule] = []
        self._load_config()
    
    def _load_config(self) -> None:
        """Load and parse action configuration from YAML."""
        if not self.config_path.exists():
            raise FileNotFoundError(f"Action config not found: {self.config_path}")
        
        with open(self.config_path, 'r') as f:
            config = yaml.safe_load(f)
        
        # Load probability tiers
        self.probability_tiers = [
            ProbabilityTier(**tier) for tier in config.get('probability_tiers', [])
        ]
        # Sort by priority (lower number = higher priority)
        self.probability_tiers.sort(key=lambda x: x.priority)
        
        # Load degradation tiers
        self.degradation_tiers = [
            DegradationTier(**tier) for tier in config.get('degradation_tiers', [])
        ]
        
        # Load action rules
        self.action_rules = [
            ActionRule(**rule) for rule in config.get('action_rules', [])
        ]
        
        logger.info(f"Loaded {len(self.probability_tiers)} probability tiers, "
                   f"{len(self.degradation_tiers)} degradation tiers, "
                   f"{len(self.action_rules)} action rules")
    
    def get_leak_tier(self, probability: float) -> str:
        """Determine leak tier from probability score."""
        for tier in self.probability_tiers:
            if tier.min_prob <= probability <= tier.max_prob:
                return tier.name
        return "UNKNOWN"
    
    def get_leak_tier_info(self, probability: float) -> ProbabilityTier:
        """Get full tier info for probability."""
        for tier in self.probability_tiers:
            if tier.min_prob <= probability <= tier.max_prob:
                return tier
        return ProbabilityTier(
            name="UNKNOWN", min_prob=0, max_prob=1, priority=99,
            color="gray", label="Unknown"
        )
    
    def get_degradation_tier(self, degradation_score: Optional[float]) -> Optional[str]:
        """Determine degradation tier from score."""
        if degradation_score is None:
            return None
        
        for tier in self.degradation_tiers:
            if tier.min_score <= degradation_score <= tier.max_score:
                return tier.name
        return "UNKNOWN"
    
    def _match_condition(
        self, 
        condition: Dict[str, Any], 
        leak_tier: str, 
        degradation_tier: Optional[str]
    ) -> bool:
        """Check if a rule condition matches the current prediction."""
        # Empty condition = matches everything (fallback)
        if not condition:
            return True
        
        # Check leak tier condition
        if 'leak_tier' in condition:
            expected = condition['leak_tier']
            if isinstance(expected, list):
                if leak_tier not in expected:
                    return False
            elif leak_tier != expected:
                return False
        
        # Check degradation tier condition
        if 'degradation_tier' in condition:
            if degradation_tier is None:
                return False
            expected = condition['degradation_tier']
            if isinstance(expected, list):
                if degradation_tier not in expected:
                    return False
            elif degradation_tier != expected:
                return False
        
        return True
    
    def evaluate(
        self,
        probability: float,
        binary_prediction: int,
        degradation_score: Optional[float] = None,
        threshold: float = 0.5
    ) -> ActionResult:
        """
        Evaluate prediction against action rules.
        
        Args:
            probability: Leak probability [0, 1]
            binary_prediction: Binary prediction (0 or 1)
            degradation_score: Optional degradation score [0, 1]
            threshold: Classification threshold used
            
        Returns:
            ActionResult with matched rule and recommended actions
        """
        # Determine tiers
        leak_tier = self.get_leak_tier(probability)
        degradation_tier = self.get_degradation_tier(degradation_score)
        leak_tier_info = self.get_leak_tier_info(probability)
        
        # Find first matching rule
        matched_rule = None
        for rule in self.action_rules:
            if self._match_condition(rule.condition, leak_tier, degradation_tier):
                matched_rule = rule
                break
        
        if matched_rule is None:
            # Should not happen if DEFAULT_FALLBACK exists
            logger.warning("No action rule matched! Using minimal fallback.")
            actions = {
                "immediate": ["Log for manual review"],
                "short_term": ["Investigate rule configuration"],
                "notifications": ["System Administrator"],
                "priority": "UNKNOWN",
                "sla_hours": 24,
                "estimated_cost_tier": "UNKNOWN"
            }
            rule_id = "NO_MATCH"
        else:
            actions = matched_rule.actions.copy()
            rule_id = matched_rule.id
            # Include simulated_response if present
            if matched_rule.simulated_response:
                actions["simulated_response"] = matched_rule.simulated_response
        
        # Build metadata
        metadata = {
            "leak_tier": leak_tier,
            "leak_tier_label": leak_tier_info.label,
            "leak_tier_color": leak_tier_info.color,
            "leak_tier_priority": leak_tier_info.priority,
            "degradation_tier": degradation_tier,
            "degradation_score": degradation_score,
            "threshold_used": threshold,
            "rule_matched": rule_id,
            "probability": probability,
            "binary_prediction": binary_prediction,
        }
        
        return ActionResult(
            rule_id=rule_id,
            leak_tier=leak_tier,
            degradation_tier=degradation_tier,
            probability=probability,
            degradation_score=degradation_score,
            binary_prediction=binary_prediction,
            actions=actions,
            metadata=metadata
        )
    
    def reload_config(self) -> None:
        """Reload configuration from disk (useful for hot-reload)."""
        logger.info("Reloading action configuration...")
        self._load_config()


# Singleton instance
_action_engine: Optional[ActionEngine] = None


def get_action_engine(config_path: Optional[Union[str, Path]] = None) -> ActionEngine:
    """Get or create the singleton action engine."""
    global _action_engine
    if _action_engine is None:
        if config_path is None:
            config_path = Path(__file__).parent / "action_config.yaml"
        _action_engine = ActionEngine(config_path)
    return _action_engine


def reset_action_engine() -> None:
    """Reset singleton (useful for testing)."""
    global _action_engine
    _action_engine = None