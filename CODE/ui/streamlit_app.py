import streamlit as st
from src.services.document_service import DocumentService

class StreamlitApp:
    def __init__(self):
        self.document_service = DocumentService()

    def run(self):
        st.title("Chroma DB CRUD Application")

        operation = st.sidebar.selectbox("Select Operation", ["Add", "Search", "Update", "Delete"])

        if operation == "Add":
            self.add_document_ui()
        elif operation == "Search":
            self.search_documents_ui()
        elif operation == "Update":
            self.update_document_ui()
        elif operation == "Delete":
            self.delete_document_ui()

    def add_document_ui(self):
        st.header("Add New Document")
        content = st.text_area("Enter document content")
        metadata = st.text_input("Enter metadata (optional, in JSON format)")
        if st.button("Add Document"):
            doc_id = self.document_service.add_document(content, eval(metadata) if metadata else None)
            st.success(f"Document added with ID: {doc_id}")

    def search_documents_ui(self):
        st.header("Search Documents")
        query = st.text_input("Enter your search query")
        n_results = st.slider("Number of results", 1, 10, 5)
        if st.button("Search"):
            results = self.document_service.search_documents(query, n_results)
            for doc in results:
                st.write(f"Content: {doc.content}")
                st.write(f"Metadata: {doc.metadata}")
                st.write("---")

    def update_document_ui(self):
        st.header("Update Document")
        doc_id = st.text_input("Enter document ID to update")
        if st.button("Fetch Document"):
            doc = self.document_service.get_document(doc_id)
            if doc:
                st.session_state.current_content = doc.content
                st.session_state.current_metadata = doc.metadata
            else:
                st.error("Document not found")
        
        if 'current_content' in st.session_state:
            new_content = st.text_area("Edit content", value=st.session_state.current_content)
            new_metadata = st.text_input("Edit metadata (in JSON format)", value=str(st.session_state.current_metadata))
            if st.button("Update Document"):
                self.document_service.update_document(doc_id, new_content, eval(new_metadata))
                st.success("Document updated successfully")

    def delete_document_ui(self):
        st.header("Delete Document")
        doc_id = st.text_input("Enter document ID to delete")
        if st.button("Delete Document"):
            self.document_service.delete_document(doc_id)
            st.success("Document deleted successfully")