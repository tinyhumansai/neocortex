"""Example: LangGraph agent with TinyHumanStore as the memory backend.

Prerequisites:
    pip install neocortex-langgraph[examples] langchain-openai

Environment variables:
    TINYHUMANS_TOKEN  — your TinyHumans API token
    TINYHUMANS_MODEL  — your TinyHumans model ID
    OPENAI_API_KEY    — OpenAI API key for the chat model
"""

from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.store.base import BaseStore

from tinyhumansai import TinyHumanMemoryClient
from neocortex_langgraph import TinyHumanStore

# --- Initialise the memory store ---

client = TinyHumanMemoryClient(
    token=os.environ["TINYHUMANS_TOKEN"],
    model_id=os.environ["TINYHUMANS_MODEL"],
)
store = TinyHumanStore(client=client)


# --- Define the graph ---

llm = ChatOpenAI(model="gpt-4o-mini")


def chatbot(state: MessagesState, *, store: BaseStore):
    """A simple chatbot node that persists user preferences."""
    user_id = "demo_user"
    namespace = ("user", user_id, "memories")

    # Recall relevant memories
    memories = store.search(namespace, query=state["messages"][-1].content)
    memory_text = "\n".join(f"- {m.value}" for m in memories) if memories else "None"

    system_msg = f"You are a helpful assistant. User memories:\n{memory_text}"
    response = llm.invoke([{"role": "system", "content": system_msg}] + state["messages"])

    # Store new memory from this interaction
    store.put(
        namespace,
        key=f"msg_{len(state['messages'])}",
        value={"content": state["messages"][-1].content},
    )

    return {"messages": [response]}


graph = StateGraph(MessagesState)
graph.add_node("chatbot", chatbot)
graph.add_edge(START, "chatbot")
graph.add_edge("chatbot", END)

app = graph.compile(store=store)


def main():
    print("LangGraph + TinyHumanStore demo (type 'quit' to exit)")
    while True:
        user_input = input("\nYou: ")
        if user_input.strip().lower() in ("quit", "exit"):
            break
        result = app.invoke({"messages": [{"role": "user", "content": user_input}]})
        print(f"Bot: {result['messages'][-1].content}")


if __name__ == "__main__":
    main()
