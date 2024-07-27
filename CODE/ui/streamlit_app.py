import streamlit as st
import json
from src.services import DocumentService
from src.utils import read_image

class StreamlitApp:
    def __init__(self):
        self.document_service = DocumentService()

    def run(self):
        st.title("Document Management System with OCR")

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
        doc_type = st.radio("Document Type", ["Text", "Image"])
        
        if doc_type == "Text":
            content = st.text_area("Enter document content")
        else:
            uploaded_file = st.file_uploader("Choose an image...", type=["jpg", "jpeg", "png"])
            if uploaded_file is not None:
                content = read_image(uploaded_file)
                st.image(content, caption='Uploaded Image', use_column_width=True)
            else:
                content = None

        metadata = st.text_input("Enter metadata (optional, in JSON format)")
        
        if st.button("Add Document"):
            try:
                metadata_dict = json.loads(metadata) if metadata else None
                if content is not None:
                    doc_id = self.document_service.add_document(content, metadata_dict, doc_type.lower())
                    st.success(f"Document added with ID: {doc_id}")
                else:
                    st.error("Please provide document content or upload an image.")
            except json.JSONDecodeError:
                st.error("Invalid JSON format for metadata. Please check and try again.")
            except Exception as e:
                st.error(f"An error occurred: {str(e)}")

    def search_documents_ui(self):
        st.header("Search Documents")
        query = st.text_input("Enter your search query")
        n_results = st.slider("Number of results", 1, 10, 5)
        if st.button("Search"):
            try:
                results = self.document_service.search_documents(query, n_results)
                if results:
                    for doc in results:
                        st.write(f"Content: {doc.content}")
                        st.write(f"Metadata: {doc.metadata}")
                        st.write(f"Document Type: {doc.doc_type}")
                        st.write("---")
                else:
                    st.info("No results found.")
            except Exception as e:
                st.error(f"An error occurred during search: {str(e)}")

    def update_document_ui(self):
        st.header("Update Document")
        doc_id = st.text_input("Enter document ID to update")
        if st.button("Fetch Document"):
            try:
                doc = self.document_service.get_document(doc_id)
                if doc:
                    st.session_state.current_doc = doc
                    st.success("Document fetched successfully.")
                else:
                    st.error("Document not found")
            except Exception as e:
                st.error(f"An error occurred while fetching the document: {str(e)}")
        
        if 'current_doc' in st.session_state:
            doc = st.session_state.current_doc
            new_doc_type = st.radio("Document Type", ["Text", "Image"], index=0 if doc.doc_type == 'text' else 1)
            
            if new_doc_type == "Text":
                new_content = st.text_area("Edit content", value=doc.content)
            else:
                uploaded_file = st.file_uploader("Choose a new image...", type=["jpg", "jpeg", "png"])
                if uploaded_file is not None:
                    new_content = read_image(uploaded_file)
                    st.image(new_content, caption='New Image', use_column_width=True)
                else:
                    new_content = None

            new_metadata = st.text_input("Edit metadata (in JSON format)", value=json.dumps(doc.metadata))
            
            if st.button("Update Document"):
                try:
                    new_metadata_dict = json.loads(new_metadata)
                    if new_content is not None:
                        self.document_service.update_document(doc_id, new_content, new_metadata_dict, new_doc_type.lower())
                        st.success("Document updated successfully")
                    else:
                        st.error("Please provide new document content or upload a new image.")
                except json.JSONDecodeError:
                    st.error("Invalid JSON format for metadata. Please check and try again.")
                except Exception as e:
                    st.error(f"An error occurred during update: {str(e)}")

    def delete_document_ui(self):
        st.header("Delete Document")
        doc_id = st.text_input("Enter document ID to delete")
        if st.button("Delete Document"):
            try:
                self.document_service.delete_document(doc_id)
                st.success("Document deleted successfully")
            except Exception as e:
                st.error(f"An error occurred while deleting the document: {str(e)}")

def main():
    app = StreamlitApp()
    app.run()

if __name__ == "__main__":
    main()