"""Example: Agno agent with Neocortex (Alphahuman) memory tools.

Run with:
  export ALPHAHUMAN_API_KEY=""
  export ALPHAHUMAN_BASE_URL=""
  export OPENAI_API_KEY=""
  python example.py

This example demonstrates both:
- Saving/recalling simple memories (preferences)
- Document + context workflows (insert/list/get documents, query/chat context,
  record interactions, and recall thoughts)
"""

import os

from agno.agent import Agent
from agno.models.openai import OpenAIResponses
from neocortex_agno import NeocortexTools


def main() -> None:
    token = os.environ.get("ALPHAHUMAN_API_KEY")
    if not token:
        print("Set ALPHAHUMAN_API_KEY to run this example.")
        return

    agent = Agent(
        model=OpenAIResponses(id="gpt-4o-mini"),
        tools=[
            NeocortexTools(
                token=token,
                base_url=os.environ.get("ALPHAHUMAN_BASE_URL"),
            )
        ],
        instructions=(
            "Use the memory tools to remember and recall user preferences and context.\n"
            "When the user tells you something to remember, use save_memory.\n"
            "When answering questions that might use stored context, use recall_memory first.\n"
            "If the user asks about documents or document-backed context, use:\n"
            "- insert_document / insert_documents_batch\n"
            "- list_documents / get_document\n"
            "- query_memory_context (POST /v1/memory/queries)\n"
            "- chat_memory_context (POST /v1/memory/conversations)\n"
            "If the user asks to track signal-level memory, use record_interactions.\n"
            "If the user asks for reflective/summary insights from memory, use recall_thoughts."
        ),
        markdown=True,
    )

    print("Agent with Neocortex memory ready. Try:")
    print('  agent.print_response("Remember that I prefer dark mode.", stream=True)')
    print('  agent.print_response("What theme do I prefer?", stream=True)')
    print()

    agent.print_response(
        "Remember that I prefer dark mode and my name is Alex.",
        stream=True,
    )
    agent.print_response("What theme do I prefer?", stream=True)

    print()
    print("Document + context workflow:")
    agent.print_response(
        "Create a document in namespace 'agno-docs' titled 'Alex Preferences'. "
        "Store the content: 'Alex prefers dark mode and wants succinct answers.'. "
        "Next, query_memory_context in 'agno-docs' for: 'What does Alex prefer?' "
        "and use that output to answer. "
        "Then call chat_memory_context with messages=[{'role':'user','content':'What does Alex prefer?'}] "
        "using the same namespace 'agno-docs' context. "
        "After that, call record_interactions in 'agno-docs' with "
        "entity_names=['ENTITY-AGNO-A','ENTITY-AGNO-B'] and interaction_level='engage'. "
        "Finally, call recall_thoughts for 'agno-docs' with max_chunks=5. "
        "Return a short summary of each step's outcome.",
        stream=True,
    )


if __name__ == "__main__":
    main()
