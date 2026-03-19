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
    token = os.getenv("ALPHAHUMAN_API_KEY")
    if not token:
        print("Please set ALPHAHUMAN_API_KEY")
        return

    # Initialize Memory Client
    memory_client = TinyHumanMemoryClient(token=token)

    # 1. Setup Chat Store for automatic message history
    chat_store = NeocortexChatStore(client=memory_client)
    memory = ChatMemoryBuffer.from_defaults(
        chat_store=chat_store, chat_store_key="user_123", token_limit=3000
    )

    # 2. Setup Explicit Memory Tools
    memory_tools = NeocortexToolSpec(client=memory_client, default_namespace="agent_memory").to_tool_list()
    
    # Optional: other tools
    time_tool = FunctionTool.from_defaults(fn=get_current_time)
    tools = memory_tools + [time_tool]

    # Initialize Agent
    llm = OpenAI(model="gpt-4o-mini")
    agent = ReActAgent.from_tools(tools, llm=llm, memory=memory, verbose=True)

    # Test
    print("Agent prompt: 'Remember that my favorite color is cerulean blue.'")
    response = agent.chat("Remember that my favorite color is cerulean blue.")
    print("Response:", response)

    print("\nAgent prompt: 'What is my favorite color?'")
    response = agent.chat("What is my favorite color?")
    print("Response:", response)

if __name__ == "__main__":
    main()
