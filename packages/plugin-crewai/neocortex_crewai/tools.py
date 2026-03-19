"""Neocortex memory tools for CrewAI."""

from typing import Type, Optional
from pydantic import BaseModel, Field, PrivateAttr

from crewai.tools import BaseTool
from tinyhumansai import TinyHumanMemoryClient, MemoryItem, TinyHumanError


class SaveMemoryInput(BaseModel):
    """Input schema for NeocortexSaveMemoryTool"""
    key: str = Field(..., description="Unique identifier for this memory. Required.")
    content: str = Field(..., description="The memory content to store. Required.")
    namespace: Optional[str] = Field(None, description="Scope for organizing memories. Falls back to default if not provided.")
    metadata: Optional[dict] = Field(None, description="Key-value metadata.")


class NeocortexSaveMemoryTool(BaseTool):
    name: str = "Save Memory Tool"
    description: str = "Save or update a single memory in Neocortex. Use this when you learn a fact (e.g. user preference, context) that should persist."
    args_schema: Type[BaseModel] = SaveMemoryInput
    
    _client: TinyHumanMemoryClient = PrivateAttr()
    _default_namespace: str = PrivateAttr()

    def __init__(self, client: TinyHumanMemoryClient, default_namespace: str = "agent_memory", **kwargs):
        super().__init__(**kwargs)
        self._client = client
        self._default_namespace = default_namespace

    def _run(
        self,
        key: str,
        content: str,
        namespace: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> str:
        ns = namespace or self._default_namespace
        try:
            self._client.ingest_memory(
                item=MemoryItem(
                    key=key,
                    content=content,
                    namespace=ns,
                    metadata=metadata or {},
                )
            )
            return f"Saved memory '{key}' in namespace '{ns}'."
        except TinyHumanError as exc:
            return f"Failed to save memory: {exc}"


class RecallMemoryInput(BaseModel):
    """Input schema for NeocortexRecallMemoryTool"""
    prompt: str = Field(..., description="Natural-language query describing what you need. Required.")
    namespace: Optional[str] = Field(None, description="The namespace to search in. Falls back to default if not provided.")
    num_chunks: int = Field(10, description="Maximum number of memory chunks to retrieve.")


class NeocortexRecallMemoryTool(BaseTool):
    name: str = "Recall Memory Tool"
    description: str = "Recall relevant memories from Neocortex for a given question or topic. Use this to look up past facts before answering."
    args_schema: Type[BaseModel] = RecallMemoryInput
    
    _client: TinyHumanMemoryClient = PrivateAttr()
    _default_namespace: str = PrivateAttr()

    def __init__(self, client: TinyHumanMemoryClient, default_namespace: str = "agent_memory", **kwargs):
        super().__init__(**kwargs)
        self._client = client
        self._default_namespace = default_namespace

    def _run(
        self,
        prompt: str,
        namespace: Optional[str] = None,
        num_chunks: int = 10,
    ) -> str:
        ns = namespace or self._default_namespace
        try:
            resp = self._client.recall_memory(
                namespace=ns,
                prompt=prompt,
                num_chunks=num_chunks,
            )
            
            if not resp.items:
                return f"No memories found in namespace '{ns}' for that query."
                
            texts = [item.content for item in resp.items if item.content.strip()]
            return "\\n\\n".join(texts)
        except TinyHumanError as exc:
            return f"Failed to recall memory: {exc}"


class DeleteMemoryInput(BaseModel):
    """Input schema for NeocortexDeleteMemoryTool"""
    namespace: Optional[str] = Field(None, description="The namespace to clear. Falls back to default if not provided.")


class NeocortexDeleteMemoryTool(BaseTool):
    name: str = "Delete Memory Tool"
    description: str = "Delete all memories in a given namespace from Neocortex."
    args_schema: Type[BaseModel] = DeleteMemoryInput
    
    _client: TinyHumanMemoryClient = PrivateAttr()
    _default_namespace: str = PrivateAttr()

    def __init__(self, client: TinyHumanMemoryClient, default_namespace: str = "agent_memory", **kwargs):
        super().__init__(**kwargs)
        self._client = client
        self._default_namespace = default_namespace

    def _run(self, namespace: Optional[str] = None) -> str:
        ns = namespace or self._default_namespace
        try:
            self._client.delete_memory(namespace=ns, delete_all=True)
            return f"Deleted memories from namespace '{ns}'."
        except TinyHumanError as exc:
            return f"Failed to delete memory: {exc}"
