"""Example demonstrating Neocortex memory tools with AutoGen."""

import os
from dotenv import load_dotenv

import autogen
from tinyhumansai import TinyHumanMemoryClient
from neocortex_autogen import NeocortexMemoryTools, register_neocortex_tools

def main():
    load_dotenv()
    token = os.getenv("ALPHAHUMAN_API_KEY")
    if not token:
        print("Please set ALPHAHUMAN_API_KEY")
        return

    # Initialize Memory Client
    memory_client = TinyHumanMemoryClient(token=token)

    # Initialize Tools Wrapper
    memory_tools = NeocortexMemoryTools(client=memory_client, default_namespace="autogen_session")

    # Configure LLM
    llm_config = {
        "config_list": [{"model": "gpt-4o-mini", "api_key": os.getenv("OPENAI_API_KEY")}],
        "cache_seed": None, # Disable cache for testing
    }

    # Create Agents
    assistant = autogen.AssistantAgent(
        name="assistant",
        system_message="You are a helpful assistant with persistent memory. Use your memory tools to save important facts, and recall them when asked. Always reply 'TERMINATE' when the task is done.",
        llm_config=llm_config,
    )

    user_proxy = autogen.UserProxyAgent(
        name="user_proxy",
        is_termination_msg=lambda x: x.get("content", "") and x.get("content", "").rstrip().endswith("TERMINATE"),
        human_input_mode="NEVER",
        max_consecutive_auto_reply=10,
        code_execution_config=False,
    )

    # Register tools
    # The assistant proposes tools, the user_proxy executes them
    register_neocortex_tools(tools=memory_tools, caller=assistant, executor=user_proxy)

    # Run
    print("--- Saving memory ---")
    user_proxy.initiate_chat(
        assistant,
        message="Please remember that my favorite author is Isaac Asimov. Use the save_memory tool. Then say TERMINATE.",
    )

    print("\n\n--- Recalling memory ---")
    user_proxy.initiate_chat(
        assistant,
        message="Who is my favorite author? Use the recall_memory tool to find out. Then say TERMINATE.",
        clear_history=True, # Clear chat history to force tool usage
    )

if __name__ == "__main__":
    main()
