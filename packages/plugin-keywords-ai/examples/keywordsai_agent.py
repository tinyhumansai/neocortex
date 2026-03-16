"""Example demonstrating Neocortex memory tools with Keywords AI (OpenAI schema)."""

import os
import json
from dotenv import load_dotenv
from keywordsai.main import KeywordsAI

from tinyhumansai import TinyHumanMemoryClient
from neocortex_keywordsai import NeocortexMemoryTools

def main():
    load_dotenv()
    alpha_token = os.getenv("ALPHAHUMAN_API_KEY")
    kw_token = os.getenv("KEYWORDSAI_API_KEY")

    if not alpha_token or not kw_token:
        print("Please set ALPHAHUMAN_API_KEY and KEYWORDSAI_API_KEY")
        return

    # Initialize Memory Client
    memory_client = TinyHumanMemoryClient(token=alpha_token)

    # Initialize Tools Wrapper
    memory_tools = NeocortexMemoryTools(client=memory_client, default_namespace="keywordsai_session")
    
    tools_list = memory_tools.get_tool_definitions()
    functions_map = memory_tools.get_tool_functions()

    kw_client = KeywordsAI(api_key=kw_token)

    messages = [
        {"role": "system", "content": "You are a helpful assistant with persistent memory. Save important facts, and recall them when asked."},
        {"role": "user", "content": "Please remember that my favorite color is cerulean blue. Use the save_memory tool."}
    ]

    print("--- Saving memory ---")
    response = kw_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        tools=tools_list,
        tool_choice="auto"
    )

    choice = response.choices[0]
    
    # Handle Tool Call for Saving
    if choice.finish_reason == "tool_calls" and choice.message.tool_calls:
        for tool_call in choice.message.tool_calls:
            name = tool_call.function.name
            args = json.loads(tool_call.function.arguments)
            print(f"Executing {name} with args: {args}")
            
            if name in functions_map:
                result = functions_map[name](**args)
                print(f"Result: {result}")
            else:
                print(f"Unknown tool: {name}")

            # Note: In a real app, you would append the tool result to messages and call the model again.

    print("\n\n--- Recalling memory ---")
    # Simulate a new session asking about the saved fact
    messages2 = [
        {"role": "system", "content": "You are a helpful assistant with persistent memory. Always check your memory before answering questions about the user."},
        {"role": "user", "content": "What is my favorite color?"}
    ]

    response2 = kw_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages2,
        tools=tools_list,
        tool_choice="auto"
    )

    choice2 = response2.choices[0]
    
    # Handle Tool Call for Recalling
    if choice2.finish_reason == "tool_calls" and choice2.message.tool_calls:
        for tool_call in choice2.message.tool_calls:
            name = tool_call.function.name
            args = json.loads(tool_call.function.arguments)
            print(f"Executing {name} with args: {args}")
            
            if name in functions_map:
                result = functions_map[name](**args)
                print(f"Result: {result}")
                
                # Append tool result
                messages2.append(choice2.message)
                messages2.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": result,
                })
            
        # Call model again with the context
        final_response = kw_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages2,
        )
        print("\nFinal Model Answer:", final_response.choices[0].message.content)

if __name__ == "__main__":
    main()
