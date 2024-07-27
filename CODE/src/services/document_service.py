import uuid
from src.database.chroma_db import ChromaDB
from src.models.document import DocumentModel

class DocumentService:
    def __init__(self):
        self.db = ChromaDB()

    def add_document(self, content, metadata=None):
        doc = DocumentModel(content, metadata)
        doc_id = str(uuid.uuid4())
        self.db.add_documents([doc.to_langchain_document()], [doc_id])
        return doc_id

    def get_document(self, doc_id):
        content, metadata = self.db.get_document(doc_id)
        if content:
            return DocumentModel(content, metadata)
        return None

    def update_document(self, doc_id, new_content, new_metadata=None):
        doc = DocumentModel(new_content, new_metadata)
        self.db.update_document(doc_id, doc.to_langchain_document())

    def delete_document(self, doc_id):
        self.db.delete_document(doc_id)

    def search_documents(self, query, n_results=5):
        results = self.db.search_documents(query, n_results)
        return [DocumentModel.from_langchain_document(doc) for doc in results]