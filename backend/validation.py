"""Utilities for validating deterministic RAG outputs."""

import hashlib
import json
from typing import Any


def hash_output(output: dict) -> str:
    """Generate a deterministic hash of a RAG output for validation.
    
    Args:
        output: Dict with 'answer', 'citations', and 'chunks' keys
        
    Returns:
        SHA256 hash of the normalized output
    """
    # Normalize the output for hashing
    normalized = {
        "answer": output.get("answer", ""),
        "citations": sorted(
            output.get("citations", []),
            key=lambda c: (c.get("file", ""), c.get("start_line", 0), c.get("end_line", 0))
        ),
        "chunks": sorted(
            output.get("chunks", []),
            key=lambda c: (c.get("file", ""), c.get("start_line", 0), c.get("end_line", 0))
        ),
    }
    # Convert to JSON string with sorted keys for determinism
    json_str = json.dumps(normalized, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(json_str.encode()).hexdigest()


def validate_deterministic(
    outputs: list[dict],
    tolerance: int = 0
) -> tuple[bool, str | None]:
    """Validate that multiple RAG outputs are identical (deterministic).
    
    Args:
        outputs: List of output dicts from multiple runs
        tolerance: Number of allowed differences (0 = must be identical)
        
    Returns:
        (is_deterministic, error_message)
    """
    if len(outputs) < 2:
        return True, None
    
    hashes = [hash_output(out) for out in outputs]
    unique_hashes = set(hashes)
    
    if len(unique_hashes) > tolerance + 1:
        return False, f"Found {len(unique_hashes)} different outputs (expected ≤{tolerance + 1})"
    
    # Check answer text consistency
    answers = [out.get("answer", "") for out in outputs]
    unique_answers = set(answers)
    if len(unique_answers) > tolerance + 1:
        return False, f"Found {len(unique_answers)} different answers (expected ≤{tolerance + 1})"
    
    return True, None
