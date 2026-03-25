"""Example demonstrating Neocortex memory with LlamaIndex."""

import os
from dotenv import load_dotenv

from llama_index.llms.openai import OpenAI
from llama_index.core.memory import ChatMemoryBuffer
from llama_index.core.agent import ReActAgent
from llama_index.core.tools import FunctionTool

from tinyhumansai import TinyHumanMemoryClient
from neocortex_llamaindex import NeocortexChatStore, NeocortexToolSpec


def get_current_time() -> str:
    """Returns the current dummy time."""
    return "12:00 PM"

def main():
    load_dotenv()
    token = os.getenv("TINYHUMANS_API_KEY")
    if not token:
        print("Please set TINYHUMANS_API_KEY")
        return

    # Initialize Memory Client
    memory_client = TinyHumanMemoryClient(token=token)

    # 1. Setup Chat Store for automatic message history
    chat_store = NeocortexChatStore(client=memory_client)
    memory = ChatMemoryBuffer.from_defaults(
        chat_store=chat_store, chat_store_key="user_123", token_limit=3000
    )

    # 2. Setup Explicit Memory Tools
    default_namespace = "agent_memory"
    tool_spec = NeocortexToolSpec(client=memory_client, default_namespace=default_namespace)
    memory_tools = tool_spec.to_tool_list()

    # 3. Explicit document memory example (document_id is required)
    document_id = "llamaindex-example-doc-001"
    insert_result = tool_spec.insert_document(
        title="User profile",
        content="The user's favorite color is cerulean blue.",
        document_id=document_id,
        namespace=default_namespace,
        source_type="doc",
    )
    print("\nInserted document:", insert_result)

    docs_result = tool_spec.list_documents(namespace=default_namespace, limit=10)
    print("Documents in namespace:", docs_result)
    
    # Optional: other tools
    time_tool = FunctionTool.from_defaults(fn=get_current_time)
    tools = memory_tools + [time_tool]

    # Initialize Agent
    llm = OpenAI(model="gpt-4o-mini")
    agent = ReActAgent.from_tools(tools, llm=llm, memory=memory, verbose=True)

    # 4. Agent test
    print("Agent prompt: 'Remember that my favorite color is cerulean blue.'")
    response = agent.chat("Remember that my favorite color is cerulean blue.")
    print("Response:", response)

    print("\nAgent prompt: 'What is my favorite color?'")
    response = agent.chat("What is my favorite color?")
    print("Response:", response)

if __name__ == "__main__":
    main()
