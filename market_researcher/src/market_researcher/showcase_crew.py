import os

from crewai import Agent, Crew, LLM, Process, Task
from crewai.agents.agent_builder.base_agent import BaseAgent
from crewai.project import CrewBase, agent, crew, task, tool
from crewai_tools import SerperDevTool

from market_researcher.schemas import DailyShowcasePicks


def _gemini_llm() -> LLM:
    raw = os.getenv("GEMINI_MODEL", "gemini/gemini-2.5-flash")
    model = raw if "/" in raw else f"gemini/{raw}"
    return LLM(model=model)


@CrewBase
class ShowcaseResearcher:
    """Single-agent crew: daily cross-sector spotlight via Serper + structured output."""

    agents: list[BaseAgent]
    tasks: list[Task]

    agents_config = "config/showcase_agents.yaml"
    tasks_config = "config/showcase_tasks.yaml"

    @tool
    def serper_search(self) -> SerperDevTool:
        return SerperDevTool()

    @agent
    def showcase_scout(self) -> Agent:
        return Agent(
            config=self.agents_config["showcase_scout"],  # type: ignore[index]
            verbose=True,
            llm=_gemini_llm(),
        )

    @task
    def daily_showcase_task(self) -> Task:
        return Task(
            config=self.tasks_config["daily_showcase_task"],  # type: ignore[index]
            output_pydantic=DailyShowcasePicks,
        )

    @crew
    def crew(self, cache: bool = True) -> Crew:
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=True,
            cache=cache,
        )
