"""Example demonstrating Neocortex memory tools with CrewAI."""

import os
from dotenv import load_dotenv

from crewai import Agent, Task, Crew, Process
from tinyhumansai import TinyHumanMemoryClient
from neocortex_crewai import (
    NeocortexSaveMemoryTool,
    NeocortexRecallMemoryTool,
)

def main():
    load_dotenv()
    token = os.getenv("ALPHAHUMAN_API_KEY")
    if not token:
        print("Please set ALPHAHUMAN_API_KEY")
        return

    # Initialize Memory Client
    memory_client = TinyHumanMemoryClient(token=token)

    # Initialize Tools
    save_tool = NeocortexSaveMemoryTool(client=memory_client, default_namespace="crew_memory")
    recall_tool = NeocortexRecallMemoryTool(client=memory_client, default_namespace="crew_memory")

    # Create Agent
    researcher = Agent(
        role='Memory Researcher',
        goal='Store facts and recall them accurately.',
        backstory='You are an AI assistant that can persist thoughts and retrieve them later.',
        verbose=True,
        allow_delegation=False,
        tools=[save_tool, recall_tool],
    )

    # Create Tasks
    task1 = Task(
        description="Save the fact: 'The secret code is 42' into memory using the key 'secret_code'.",
        expected_output="Confirmation that the memory was saved.",
        agent=researcher,
    )

    task2 = Task(
        description="Recall the secret code from memory and tell me what it is.",
        expected_output="The secret code retrieved from memory.",
        agent=researcher,
    )

    # Assemble Crew
    crew = Crew(
        agents=[researcher],
        tasks=[task1, task2],
        process=Process.sequential,
    )

    # Run
    print("Starting Crew...")
    result = crew.kickoff()
    print("Final Result:", result)

if __name__ == "__main__":
    main()
