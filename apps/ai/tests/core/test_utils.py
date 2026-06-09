from core.utils import downsample_points, safe_json_loads


def test_downsample_returns_original_when_under_cap():
    pts = [{"date": f"2025-01-{i:02d}", "value": i} for i in range(1, 11)]
    assert downsample_points(pts, 200) == pts


def test_downsample_caps_and_preserves_endpoints():
    pts = [{"date": str(i), "value": i} for i in range(1000)]
    out = downsample_points(pts, 100)
    assert len(out) <= 100
    assert out[0] == pts[0]
    assert out[-1] == pts[-1]


def test_downsample_handles_tiny_cap():
    pts = [{"v": i} for i in range(50)]
    out = downsample_points(pts, 1)
    assert len(out) >= 1


def test_safe_json_loads_plain_object():
    assert safe_json_loads('{"a": 1}') == {"a": 1}


def test_safe_json_loads_with_markdown_fences():
    assert safe_json_loads('```json\n{"a": 1}\n```') == {"a": 1}


def test_safe_json_loads_recovers_from_surrounding_prose():
    raw = 'Here is the result: {"a": 1, "b": [2, 3]} - hope that helps!'
    assert safe_json_loads(raw) == {"a": 1, "b": [2, 3]}


def test_safe_json_loads_raises_on_garbage():
    import pytest

    with pytest.raises(Exception):
        safe_json_loads("not json at all")
