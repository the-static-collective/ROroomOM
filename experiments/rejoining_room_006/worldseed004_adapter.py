"""Optional strict WORLDSEED-004 import boundary for Room 006.

Requires separately available WORLDSEED-004 Python specimen. Seals and root ID
MUST come from independently trusted input; never copy pins from an untrusted
bundle and call them independently verified. This grants NO execution authority.
"""
from pathlib import Path
from engine import JointAnchor, anchor_from_verified_joint


def load_verified_anchor(
    home: Path, *, root_seal: str, a_seal: str, b_seal: str,
    joint_seal: str, root_state_id: str,
) -> JointAnchor:
    from static_workbench.experimental.worldseed_003 import import_seed
    from static_workbench.experimental.worldseed_rejoin_004 import verify_joint

    home = Path(home)
    root = import_seed(home / 'root', pinned_seal=root_seal,
                       trusted_root_state_id=root_state_id)
    a = import_seed(home / 'A', pinned_seal=a_seal,
                    trusted_root_state_id=root_state_id, parent=root)
    b = import_seed(home / 'B', pinned_seal=b_seal,
                    trusted_root_state_id=root_state_id, parent=root)
    node = verify_joint(home / 'joint', externally_pinned_seal=joint_seal,
                        root=root, a=a, b=b)
    return anchor_from_verified_joint(node, joint_seal)
