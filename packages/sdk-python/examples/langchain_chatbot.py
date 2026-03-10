"""Example: LangChain chatbot with TinyHumanChatMessageHistory.

Prerequisites:
    pip install tinyhumansai[langchain] langchain-openai python-dotenv

Environment variables:
    TINYHUMANS_TOKEN  — your TinyHumans API token
    TINYHUMANS_MODEL  — your TinyHumans model ID
    OPENAI_API_KEY    — OpenAI API key for the chat model
"""

from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_openai import ChatOpenAI

from tinyhumansai import TinyHumanMemoryClient
from tinyhumansai.integrations import TinyHumanChatMessageHistory

# --- Initialise the memory client ---

client = TinyHumanMemoryClient(
    token=os.environ["TINYHUMANS_TOKEN"],
    model_id=os.environ["TINYHUMANS_MODEL"],
)

# --- Build the chain ---

llm = ChatOpenAI(model="gpt-4o-mini")

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant."),
    MessagesPlaceholder(variable_name="history"),
    ("human", "{input}"),
])

chain = prompt | llm


def get_session_history(session_id: str):
    return TinyHumanChatMessageHistory(
        client=client,
        session_id=session_id,
    )


chain_with_history = RunnableWithMessageHistory(
    chain,
    get_session_history,
    input_messages_key="input",
    history_messages_key="history",
)


def main():
    session_id = "demo-session"
    print("LangChain + TinyHumanChatMessageHistory demo (type 'quit' to exit)")
    while True:
        user_input = input("\nYou: ")
        if user_input.strip().lower() in ("quit", "exit"):
            break
        result = chain_with_history.invoke(
            {"input": user_input},
            config={"configurable": {"session_id": session_id}},
        )
        print(f"Bot: {result.content}")


if __name__ == "__main__":
    main()
