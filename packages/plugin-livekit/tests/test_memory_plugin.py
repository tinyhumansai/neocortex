from neocortex_livekit.tools import NeocortexLiveKitTools


class _FakeClient:
    def __init__(self) -> None:
        self.insert_calls = []
        self.query_calls = []
        self.delete_calls = []

    def insert_memory(self, *, title, content, namespace, metadata):
        self.insert_calls.append(
            {
                "title": title,
                "content": content,
                "namespace": namespace,
                "metadata": metadata,
            }
        )
        return {"status": "inserted"}

    def query_memory(self, *, query, namespace, max_chunks):
        self.query_calls.append(
            {"query": query, "namespace": namespace, "max_chunks": max_chunks}
        )
        return {"llmContextMessage": "remembered context"}

    def delete_memory(self, *, namespace):
        self.delete_calls.append({"namespace": namespace})
        return {"nodesDeleted": 2}

    def close(self):
        return None


def test_save_memory_uses_default_namespace():
    tools = NeocortexLiveKitTools(token="x", namespace="room-1")
    fake = _FakeClient()
    tools._client = fake  # test injection

    msg = tools.save_memory(key="pref-theme", content="User prefers dark mode")

    assert "pref-theme" in msg
    assert fake.insert_calls[0]["namespace"] == "room-1"


def test_recall_memory_and_prompt_builder():
    tools = NeocortexLiveKitTools(token="x", namespace="room-2")
    fake = _FakeClient()
    tools._client = fake  # test injection

    memory = tools.recall_memory(prompt="What do we know?", num_chunks=7)
    prompt = tools.build_prompt_with_memory(
        base_instructions="You are concise.",
        user_prompt="What do we know?",
        num_chunks=7,
    )

    assert memory == "remembered context"
    assert "Relevant memory context:" in prompt
    assert fake.query_calls[0]["max_chunks"] == 7


def test_delete_memory_requires_delete_all_true():
    tools = NeocortexLiveKitTools(token="x", namespace="room-3")
    fake = _FakeClient()
    tools._client = fake  # test injection

    msg = tools.delete_memory(delete_all=True)

    assert "Deleted 2 memory node(s)" in msg
    assert fake.delete_calls == [{"namespace": "room-3"}]
