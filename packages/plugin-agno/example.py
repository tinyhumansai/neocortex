"""Example: Agno agent with Neocortex (Alphahuman) memory tools.

Run with:
  export ALPHAHUMAN_API_KEY=""
  export ALPHAHUMAN_BASE_URL=""
  export OPENAI_API_KEY=""
  python example.py
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
            "Use the memory tools to remember and recall user preferences and context. "
            "When the user tells you something to remember, use save_memory. "
            "When answering questions that might use stored context, use recall_memory first."
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


if __name__ == "__main__":
    main()
