"""Example: LiveKit-oriented workflow with Neocortex memory tools.

Run with:
  export ALPHAHUMAN_API_KEY=""
  export ALPHAHUMAN_BASE_URL=""
  python example.py
"""

import os

from neocortex_livekit import NeocortexLiveKitTools


def main() -> None:
    token = os.environ.get("ALPHAHUMAN_API_KEY")
    if not token:
        print("Set ALPHAHUMAN_API_KEY to run this example.")
        return

    tools = NeocortexLiveKitTools(
        token=token,
        base_url=os.environ.get("ALPHAHUMAN_BASE_URL"),
        namespace="livekit-demo-room",
    )

    tools.save_memory(
        key="user-name",
        content="The user's name is Alex.",
    )
    tools.save_memory(
        key="user-preference-theme",
        content="The user prefers dark mode.",
    )

    recalled = tools.recall_memory(prompt="What do we know about this user?")
    final_prompt = tools.build_prompt_with_memory(
        base_instructions="You are a concise assistant.",
        user_prompt="Greet me using my saved context.",
    )

    print("--- Recalled Memory ---")
    print(recalled)
    print()
    print("--- Prompt With Memory ---")
    print(final_prompt)

    tools.close()


if __name__ == "__main__":
    main()
