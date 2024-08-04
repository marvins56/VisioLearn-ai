from langchain_core.documents import Document

# class DocumentModel:
#     def __init__(self, content, metadata=None, doc_type='text'):
#         self.content = content
#         self.metadata = metadata or {}
#         self.doc_type = doc_type  # 'text' or 'image'

#     def to_langchain_document(self):
#         return Document(page_content=self.content, metadata={**self.metadata, 'doc_type': self.doc_type})

#     @classmethod
#     def from_langchain_document(cls, doc):
#         return cls(doc.page_content, doc.metadata, doc.metadata.get('doc_type', 'text'))
import json
class DocumentModel:
    def __init__(self, content, metadata=None, doc_type='text'):
        self.content = content
        self.metadata = metadata or {}
        self.doc_type = doc_type

    @classmethod
    def from_langchain_document(cls, langchain_doc):
        return cls(
            langchain_doc.page_content,
            json.loads(langchain_doc.metadata.get("metadata", "{}")),
            langchain_doc.metadata.get("doc_type", "text")
        )

    def to_langchain_document(self):
        from langchain.schema import Document
        return Document(
            page_content=self.content,
            metadata={
                "metadata": json.dumps(self.metadata),
                "doc_type": self.doc_type
            }
        )