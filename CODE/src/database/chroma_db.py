from langchain_community.embeddings import SentenceTransformerEmbeddings
from langchain_community.vectorstores import Chroma

class ChromaDB:
    def __init__(self, persist_directory="./chroma_db"):
        self.embedding_function = SentenceTransformerEmbeddings(model_name="all-MiniLM-L6-v2")
        self.client = Chroma(persist_directory=persist_directory, embedding_function=self.embedding_function)

    def add_documents(self, documents, ids):
        return self.client.add_documents(documents=documents, ids=ids)

    def get_document(self, doc_id):
        results = self.client.get(ids=[doc_id])
        if results['documents']:
            return results['documents'][0], results['metadatas'][0]
        return None, None

    def update_document(self, doc_id, document, metadata=None):
        self.client.update_document(doc_id, document, metadata)

    def delete_document(self, doc_id):
        self.client.delete(ids=[doc_id])

    def search_documents(self, query, n_results=5):
        return self.client.similarity_search(query, k=n_results)