from src.services import DocumentService
from src.utils import LLMUtility

class QuestionGenerator:
    def __init__(self, llm_utility: LLMUtility) -> None:
        self.llm_utility = llm_utility
        self.document_service = DocumentService()

    def generate_qa(self, topic: str):
        llm = self.llm_utility.get_llm_instance()

        documents = self.document_service.search_documents(topic)

        context = "\n\n".join([
            f"Document {idx + 1}: {doc.content}" for idx, doc in enumerate(documents)
        ])

        prompt = f"Based on the following context: \n{context}\nGenerate 10 questions related to topic: {topic}. Separate each question by a new line."

        response = llm.predict(text=prompt)

        return response