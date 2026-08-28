"""Covers the MCP tool-list cache key (core/mcp/cache.py).

The key used to be "{org}:{agent}" alone, ignoring both the connection set and
reserved_tools — even though `get_mcp_tools` filters on the first and computes
its truncation budget from the second. A call made with a narrowed connection
list therefore populated the entry that every later, wider call then read back
for the rest of the 30-minute TTL.

That was latent while only `mcp_tool_preference` narrowed the list. It becomes
deterministic once the run executor narrows per step, so the key now covers
everything that changes the result.
"""

import pytest

from core.mcp import cache as mcp_cache


@pytest.fixture(autouse=True)
def _clear_cache():
    """Module-global cache — leaks across tests without this."""
    mcp_cache._cache.clear()
    yield
    mcp_cache._cache.clear()


@pytest.fixture
def fake_backend(monkeypatch):
    """One tool per connection, named after its id."""
    calls: list[str] = []

    async def fake_list(organization_id, connection_id):
        calls.append(connection_id)
        return [{
            "name": f"{connection_id.upper()}_DO_THING",
            "description": "x",
            "inputSchema": {"type": "object", "properties": {}},
            "isWrite": False,
            "important": True,
        }]

    monkeypatch.setattr(mcp_cache.mcp_client, "list_connection_tools", fake_list)
    return calls


def _conns(*ids):
    return [{"connectionId": i, "integrationSlug": i} for i in ids]


@pytest.mark.asyncio
async def test_narrowed_call_does_not_poison_the_full_one(fake_backend):
    """The regression this key change exists for."""
    narrow, _ = await mcp_cache.get_mcp_tools("org", "sage", _conns("gmail"))
    assert [t.name for t in narrow] == ["mcp_gmail_GMAIL_DO_THING"]

    full, _ = await mcp_cache.get_mcp_tools("org", "sage", _conns("gmail", "linear"))
    names = sorted(t.name for t in full)
    assert names == ["mcp_gmail_GMAIL_DO_THING", "mcp_linear_LINEAR_DO_THING"], (
        "the narrowed entry was served to a call that asked for more connections"
    )


@pytest.mark.asyncio
async def test_same_inputs_are_served_from_cache(fake_backend):
    await mcp_cache.get_mcp_tools("org", "sage", _conns("gmail"))
    assert fake_backend == ["gmail"]
    await mcp_cache.get_mcp_tools("org", "sage", _conns("gmail"))
    assert fake_backend == ["gmail"], "second identical call should not refetch"


@pytest.mark.asyncio
async def test_connection_order_does_not_split_the_entry(fake_backend):
    await mcp_cache.get_mcp_tools("org", "sage", _conns("gmail", "linear"))
    before = len(fake_backend)
    await mcp_cache.get_mcp_tools("org", "sage", _conns("linear", "gmail"))
    assert len(fake_backend) == before, "key must be order-independent"


@pytest.mark.asyncio
async def test_reserved_tools_splits_the_entry(fake_backend):
    """Different reserved_tools means a different truncation budget."""
    await mcp_cache.get_mcp_tools("org", "sage", _conns("gmail"), reserved_tools=0)
    await mcp_cache.get_mcp_tools("org", "sage", _conns("gmail"), reserved_tools=40)
    assert len(mcp_cache._cache) == 2


@pytest.mark.asyncio
async def test_orgs_and_agents_stay_separate(fake_backend):
    await mcp_cache.get_mcp_tools("org-a", "sage", _conns("gmail"))
    await mcp_cache.get_mcp_tools("org-b", "sage", _conns("gmail"))
    await mcp_cache.get_mcp_tools("org-a", "vega", _conns("gmail"))
    assert len(mcp_cache._cache) == 3


@pytest.mark.asyncio
async def test_invalidate_still_matches_the_longer_key(fake_backend):
    await mcp_cache.get_mcp_tools("org-a", "sage", _conns("gmail"))
    await mcp_cache.get_mcp_tools("org-a", "vega", _conns("linear"))
    await mcp_cache.get_mcp_tools("org-b", "sage", _conns("gmail"))

    mcp_cache.invalidate("org-a")
    assert all(k.startswith("org-b:") for k in mcp_cache._cache)


def test_eviction_bounds_the_cache(monkeypatch):
    monkeypatch.setattr(mcp_cache, "_MAX_CACHE_ENTRIES", 3)
    for i in range(10):
        mcp_cache._cache[f"k{i}"] = (1_000_000 + i, [], {})
        mcp_cache._evict_if_needed()
    assert len(mcp_cache._cache) <= 3
    # Oldest expiry goes first, so the newest survive.
    assert "k9" in mcp_cache._cache
