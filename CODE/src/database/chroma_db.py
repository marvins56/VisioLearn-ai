from chromadb import PersistentClient
from chromadb.utils import embedding_functions

class ChromaDB:
    def __init__(self, persist_directory="./chroma_db"):
        self.client = PersistentClient(path=persist_directory)
        self.embedding_function = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")
        self.collection = self.client.get_or_create_collection(
            name="default_collection",
            embedding_function=self.embedding_function
        )

    def add_documents(self, documents, ids, metadatas=None):
        return self.collection.add(
            documents=documents,
            ids=ids,
            metadatas=metadatas
        )

    def get_document(self, doc_id):
        results = self.collection.get(ids=[doc_id])
        if results['documents']:
            return results['documents'][0], results['metadatas'][0]
        return None, None

    def update_document(self, doc_id, document, metadata=None):
        self.collection.update(
            ids=[doc_id],
            documents=[document],
            metadatas=[metadata] if metadata else None
        )

    def delete_document(self, doc_id):
        self.collection.delete(ids=[doc_id])

    def search_documents(self, query, n_results=5):
        results = self.collection.query(
            query_texts=[query],
            n_results=n_results
        )
        return results['documents'][0], results['metadatas'][0], results['distances'][0]