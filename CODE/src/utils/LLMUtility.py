import os
from langchain_openai import ChatOpenAI
from typing import Optional

class LLMUtility:
    def __init__(self, streaming: bool = True, api_key: Optional[str] = None, 
                 base_url: Optional[str] = None, model_name: Optional[str] = None):
        self.api_key = api_key or os.getenv('AI71_API_KEY')
        if not self.api_key:
            raise ValueError("AI71_API_KEY not provided and not set in environment variables")
        
        self.base_url = base_url or os.getenv("AI71_BASE_URL")
        if not self.base_url:
            raise ValueError("AI71_BASE_URL not provided and not set in environment variables")
        
        self.model_name = model_name or os.getenv("AI71_MODAL_NAME")
        if not self.model_name:
            raise ValueError("AI71_MODAL_NAME not provided and not set in environment variables")
        
        self.streaming = streaming

    def get_llm_instance(self, **kwargs):
        default_params = {
            "model": self.model_name,
            "api_key": self.api_key,
            "base_url": self.base_url,
            "streaming": self.streaming,
        }
        # Override default parameters with any provided kwargs
        params = {**default_params, **kwargs}
        return ChatOpenAI(**params)