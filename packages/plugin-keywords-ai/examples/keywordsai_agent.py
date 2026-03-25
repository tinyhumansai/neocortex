"""Example demonstrating Neocortex memory tools with Keywords AI (OpenAI schema)."""

import os
import json
import time
from dotenv import load_dotenv

from tinyhumansai import TinyHumanMemoryClient
from neocortex_keywordsai import NeocortexMemoryTools

def main():
    load_dotenv()
    alpha_token = os.getenv("TINYHUMANS_API_KEY")
    kw_token = os.getenv("KEYWORDSAI_API_KEY")

    if not alpha_token or not kw_token:
        print("Please set TINYHUMANS_API_KEY and KEYWORDSAI_API_KEY")
        return

    memory_client = TinyHumanMemoryClient(token=alpha_token)
    memory_tools = NeocortexMemoryTools(client=memory_client, default_namespace="keywordsai_session")
    tools_list = memory_tools.get_tool_definitions()
    functions_map = memory_tools.get_tool_functions()
    namespace = f"keywords-session-{int(time.time())}"
    document_id = f"keywordsai-doc-{int(time.time())}"
    print(f"Loaded {len(tools_list)} tools")
    print(f"Using namespace: {namespace}")

    # Deterministic direct coverage for most tools
    print("\n--- save_memory ---")
    print(functions_map["save_memory"](key="favorite_author", content="My favorite author is Isaac Asimov.", namespace=namespace))
    print("\n--- recall_memory ---")
    print(functions_map["recall_memory"](prompt="favorite author", namespace=namespace, num_chunks=5))
    print("\n--- insert_document ---")
    print(functions_map["insert_document"](title="Favorite Author", content="My favorite author is Isaac Asimov.", namespace=namespace, source_type="doc", document_id=document_id))
    print("\n--- list_documents ---")
    print(functions_map["list_documents"](namespace=namespace, limit=10, offset=0))
    print("\n--- query_memory_context ---")
    print(functions_map["query_memory_context"](query="favorite author", namespace=namespace, max_chunks=5))
    print("\n--- record_interactions ---")
    print(functions_map["record_interactions"](namespace=namespace, entity_names_json=json.dumps(["isaac asimov", "favorite_author"]), interaction_levels_json=json.dumps(["read", "read"]), timestamp=int(time.time())))
    print("\n--- recall_thoughts ---")
    print(functions_map["recall_thoughts"](namespace=namespace, max_chunks=5))
    print("\n--- recall_memory_master ---")
    print(functions_map["recall_memory_master"](namespace=namespace, max_chunks=5))
    print("\n--- recall_memories ---")
    print(functions_map["recall_memories"](namespace=namespace, top_k=5, min_retention=0.0, as_of=int(time.time())))

    kw_client = None
    try:
        from keywordsai.main import KeywordsAI
        kw_client = KeywordsAI(api_key=kw_token)
    except ModuleNotFoundError:
        print("\nkeywordsai SDK not installed; skipping KeywordsAI chat-completions demo section.")
        print("Install with: pip install keywordsai")

    if kw_client:
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

    print("\n--- delete_memory ---")
    print(functions_map["delete_memory"](namespace=namespace))

if __name__ == "__main__":
    main()
