from langchain_core.documents import Document

class DocumentModel:
    def __init__(self, content, metadata=None, doc_type='text'):
        self.content = content
        self.metadata = metadata or {}
        self.doc_type = doc_type  # 'text' or 'image'

    def to_langchain_document(self):
        return Document(page_content=self.content, metadata={**self.metadata, 'doc_type': self.doc_type})

    @classmethod
    def from_langchain_document(cls, doc):
        return cls(doc.page_content, doc.metadata, doc.metadata.get('doc_type', 'text'))