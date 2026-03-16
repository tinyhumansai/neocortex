"""Example demonstrating Neocortex memory tools with CAMEL AI."""

import os
from dotenv import load_dotenv

from camel.agents import ChatAgent
from camel.messages import BaseMessage
from camel.models import ModelFactory
from camel.types import ModelPlatformType, ModelType

from tinyhumansai import TinyHumanMemoryClient
from neocortex_camelai import NeocortexToolkit

def main():
    load_dotenv()
    token = os.getenv("ALPHAHUMAN_API_KEY")
    if not token:
        print("Please set ALPHAHUMAN_API_KEY")
        return

    # Initialize Memory Client
    memory_client = TinyHumanMemoryClient(token=token)

    # Initialize Tools Wrapper
    toolkit = NeocortexToolkit(client=memory_client, default_namespace="camel_session")
    tools = toolkit.get_tools()

    # Configure LLM
    model = ModelFactory.create(
        model_platform=ModelPlatformType.OPENAI,
        model_type=ModelType.GPT_4O_MINI,
        api_key=os.getenv("OPENAI_API_KEY")
    )

    # Create Agent
    system_msg = BaseMessage.make_assistant_message(
        role_name="Memory Assistant",
        content="You are a helpful assistant with persistent memory. Use your memory tools to save important facts, and recall them when asked."
    )
    
    agent = ChatAgent(
        system_message=system_msg,
        model=model,
        tools=tools,
    )

    # Run
    print("--- Saving memory ---")
    user_msg1 = BaseMessage.make_user_message(
        role_name="User",
        content="Please remember that my favorite author is Isaac Asimov. Use the save_memory tool."
    )
    response1 = agent.step(user_msg1)
    print("Agent:", response1.msgs[0].content)

    print("\n\n--- Recalling memory ---")
    user_msg2 = BaseMessage.make_user_message(
        role_name="User",
        content="Who is my favorite author? Use the recall_memory tool to find out."
    )
    
    # Normally we would clear history here to prove it works, but re-instantiating the agent is easiest
    agent2 = ChatAgent(
        system_message=system_msg,
        model=model,
        tools=tools,
    )
    response2 = agent2.step(user_msg2)
    print("Agent:", response2.msgs[0].content)

if __name__ == "__main__":
    main()
