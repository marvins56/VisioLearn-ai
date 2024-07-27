from langchain_core.documents import Document

class DocumentModel:
    def __init__(self, content, metadata=None):
        self.content = content
        self.metadata = metadata or {}

    def to_langchain_document(self):
        return Document(page_content=self.content, metadata=self.metadata)

    @classmethod
    def from_langchain_document(cls, doc):
        return cls(doc.page_content, doc.metadata)