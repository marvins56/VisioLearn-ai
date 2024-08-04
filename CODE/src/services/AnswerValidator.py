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


class AnswerValidator:
    def __init__(self, llm_utility: LLMUtility):
        self.llm_utility = llm_utility

    def validate_answer(self, question: str, summary: str) -> str:
        # Get LLM instance
        llm = self.llm_utility.get_llm_instance()

        # Create prompt for validation
        prompt = f"Validate if the following summary answers the question correctly:\n\nQuestion: {question}\n\nSummary: {summary}\n\nProvide a more accurate and human-like answer if necessary."

        # Prepare messages for LLM
        messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt}
        ]

        # Call the LLM and get the response
        response = llm.predict(messages=messages)

        # Extract and return the response content
        return response.get("content", "").strip()
