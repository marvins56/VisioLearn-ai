import os
from typing import Optional
from langchain.chat_models import ChatOpenAI

from src.utils import LLMUtility

# class AnswerValidator:
    # def __init__(self, llm_utility: LLMUtility):
    #     self.llm_utility = llm_utility
    #     self.llm_instance = self.llm_utility.get_llm_instance()
    
    # def validate_answer(self, question: str, summarized_response: str) -> str:
    #     """
    #     Validate if the summarized response answers the given question correctly and provide a more human-like response if needed.
    #     """
    #     prompt_template = (
    #         f"Question: {question}\n\n"
    #         f"Summarized Response: {summarized_response}\n\n"
    #         "Is this summarized response correct and sufficient to answer the question? If not, provide a more detailed and human-like answer."
    #     )
        
    #     # Get the model's response
    #     response = self.llm_instance(prompt=prompt_template)
        
    #     # Extract and return the response
    #     return response.get("choices")[0].get("text").strip()

from langchain.chat_models import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
class AnswerValidator:
    def __init__(self, llm_utility: LLMUtility):
        self.llm_utility = llm_utility

    def validate_answer(self, question: str, summary: str) -> str:
        """
        Validates if the provided summary correctly answers the given question and improves the summary if necessary.

        Parameters:
            question (str): The question that needs to be answered.
            summary (str): The summary to be validated.

        Returns:
            str: A more accurate and human-like answer if necessary, otherwise the original summary if it is correct.
        """
        
        # Get LLM instance
        llm = self.llm_utility.get_llm_instance()

        # Create prompt for validation
        prompt = (
            f"Evaluate whether the following summary answers the given question accurately. "
            f"If the summary is not sufficient or accurate, provide a more precise and human-like response.\n\n"
            f"Question: {question}\n\n"
            f"Summary: {summary}\n\n"
            f"Provide an improved answer if needed."
        )

        # Prepare messages for LLM
        messages = [
            SystemMessage(content="You are an assistant tasked with evaluating whether the provided summary correctly answers the question. If it does not, generate a more accurate and human-like answer."),
            HumanMessage(content=prompt)
        ]

        # Call the LLM and get the response
        response = llm.invoke(messages)

        # Extract and return the response content
        return response

