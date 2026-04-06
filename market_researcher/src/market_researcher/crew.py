import os

from crewai import Agent, Crew, LLM, Process, Task
from crewai.agents.agent_builder.base_agent import BaseAgent
from crewai.project import CrewBase, agent, crew, task, tool
from crewai_tools import SerperDevTool
from market_researcher.schemas import InvestmentRecommendation


def _gemini_llm() -> LLM:
    raw = os.getenv("GEMINI_MODEL", "gemini/gemini-2.5-flash")
    model = raw if "/" in raw else f"gemini/{raw}"
    return LLM(model=model)


@CrewBase
class MarketResearcher:
    """Market research crew: market context, public financial signals, investment recommendation."""

    agents: list[BaseAgent]
    tasks: list[Task]

    @tool
    def serper_search(self) -> SerperDevTool:
        return SerperDevTool()

    @agent
    def market_researcher(self) -> Agent:
        return Agent(
            config=self.agents_config["market_researcher"],  # type: ignore[index]
            verbose=True,
            llm=_gemini_llm(),
        )

    @agent
    def financial_analyst(self) -> Agent:
        return Agent(
            config=self.agents_config["financial_analyst"],  # type: ignore[index]
            verbose=True,
            llm=_gemini_llm(),
        )

    @agent
    def investment_strategist(self) -> Agent:
        return Agent(
            config=self.agents_config["investment_strategist"],  # type: ignore[index]
            verbose=True,
            llm=_gemini_llm(),
        )

    @task
    def market_landscape_task(self) -> Task:
        return Task(
            config=self.tasks_config["market_landscape_task"],  # type: ignore[index]
        )

    @task
    def financial_signals_task(self) -> Task:
        return Task(
            config=self.tasks_config["financial_signals_task"],  # type: ignore[index]
        )

    @task
    def investment_recommendation_task(self) -> Task:
        return Task(
            config=self.tasks_config["investment_recommendation_task"],  # type: ignore[index]
            output_pydantic=InvestmentRecommendation,
            output_file="investment_report.json",
        )

    @crew
    def crew(self, cache: bool = True) -> Crew:
        """Use cache=False from the HTTP API so in-memory tool results stay fresh."""
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=True,
            cache=cache,
        )
