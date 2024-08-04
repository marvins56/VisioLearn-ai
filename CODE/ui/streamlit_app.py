import streamlit as st
import json
import os
import tempfile
from src.services import DocumentService
from src.services import AudioService
from src.services import WebScraper
from src.services.WebSearchAndSummarize import WebSearchAndSummarize
from src.services.summarizer import Summarizer
from src.services import QuestionGenerator
from src.utils.LLMUtility import LLMUtility
from src.utils import read_image
from src.services.webScrapper import WebScraper
from src.utils.LLMUtility import LLMUtility
from src.services.AnswerValidator import AnswerValidator
# from TestFeatures.summaryAgent import Summarizer

class StreamlitApp:
    def __init__(self):
        self.document_service = DocumentService()
        self.audio_service = AudioService()
        self.temp_dir = tempfile.mkdtemp()
        self.llm_utility = LLMUtility()
        self.scraper = WebScraper()
        self.web_search_and_summarize = WebSearchAndSummarize()
        self.question_generator = QuestionGenerator(self.llm_utility)
        self.answerValidator = AnswerValidator(self.llm_utility)

    def run(self):
        st.title("Document Management System with OCR")

        operation = st.sidebar.selectbox("Select Operation", ["Add", "Search", "Update", "Delete", "Scrape and Summarize"])

        if operation == "Add":
            self.add_document_ui()
        elif operation == "Search":
            self.search_documents_ui()
        elif operation == "Update":
            self.update_document_ui()
        elif operation == "Delete":
            self.delete_document_ui()
        elif operation == "Scrape and Summarize":
            self.search_and_summarize_ui()

    def save_uploaded_file(self, uploaded_file):
        if uploaded_file is not None:
            file_path = os.path.join(self.temp_dir, uploaded_file.name)
            with open(file_path, "wb") as f:
                f.write(uploaded_file.getbuffer())
            return file_path
        return None

    def add_document_ui(self):
        st.header("Add New Document")
        doc_type = st.radio("Document Type", ["Text", "Image"])
        
        if doc_type == "Text":
            content = st.text_area("Enter document content")
        else:
            uploaded_file = st.file_uploader("Choose an image...", type=["jpg", "jpeg", "png"])
            if uploaded_file is not None:
                file_path = self.save_uploaded_file(uploaded_file)
                content = file_path
                st.image(read_image(file_path), caption='Uploaded Image', use_column_width=True)
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
    
    def search_and_summarize_ui(self):
        st.header("Search and Summarize Web Content")
        query = st.text_input("Enter your search query")
        
        if st.button("Search and Summarize"):
            try:
                # Perform web search and summarization
                summaries = self.web_search_and_summarize.process_query(query)
                
                # Display results and save non-empty summaries
                saved_count = 0
                for i, summary in enumerate(summaries, 1):
                    st.subheader(f"Result {i}")
                    st.write(f"Title: {summary['title']}")
                    st.write(f"URL: {summary['url']}")
                    st.text_area("Summary", summary['summary'], height=150)
                    st.write("---")

                    # Automatically save non-empty summaries
                    if summary['summary'].strip():  # Check if summary is not just whitespace
                        metadata = {
                            "source_url": summary['url'],
                            "original_title": summary['title'],
                            "search_query": query
                        }
                        doc_id = self.document_service.add_document(summary['summary'], metadata, "text")
                        saved_count += 1
                        st.success(f"Summary {i} automatically saved as document with ID: {doc_id}")

                if saved_count > 0:
                    st.info(f"{saved_count} non-empty summaries were automatically saved.")
                else:
                    st.warning("No non-empty summaries were found to save.")

            except Exception as e:
                st.error(f"An error occurred: {str(e)}")
            finally:
                self.web_search_and_summarize.close()

        #         def search_and_summarize_ui(self):
        #     st.header("Search and Summarize Web Content")
        # query = st.text_input("Enter your search query")
        
        # if st.button("Search and Summarize"):
        #     try:
        #         # Perform web search and summarization
        #         summaries = self.web_search_and_summarize.process_query(query)
                
        #         # Display results and save non-empty summaries
        #         saved_count = 0
        #         for i, summary in enumerate(summaries, 1):
        #             st.subheader(f"Result {i}")
        #             st.write(f"Title: {summary['title']}")
        #             st.write(f"URL: {summary['url']}")

        #             # Validate and improve summary
        #             validated_summary = self.answerValidator.validate_answer(query, summary['summary'])
        #             st.text_area("Summary", validated_summary, height=150)
                    
        #             st.write("---")

        #             # Automatically save non-empty summaries
        #             if validated_summary.strip():  # Check if summary is not just whitespace
        #                 metadata = {
        #                     "source_url": summary['url'],
        #                     "original_title": summary['title'],
        #                     "search_query": query
        #                 }
        #                 doc_id = self.document_service.add_document(validated_summary, metadata, "text")
        #                 saved_count += 1
        #                 st.success(f"Summary {i} automatically saved as document with ID: {doc_id}")

        #         if saved_count > 0:
        #             st.info(f"{saved_count} non-empty summaries were automatically saved.")
        #         else:
        #             st.warning("No non-empty summaries were found to save.")

        #     except Exception as e:
        #         st.error(f"An error occurred: {str(e)}")
        #     finally:
        #         self.web_search_and_summarize.close()

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
                        if doc.doc_type == 'image':
                            # st.write(doc.content)
                            # st.image(read_image(doc.content), caption='Document Image', use_column_width=True)
                            st.write("---image data ---\n")
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
                new_content = st.text_area("Edit content", value=doc.content if doc.doc_type == 'text' else "")
            else:
                uploaded_file = st.file_uploader("Choose a new image...", type=["jpg", "jpeg", "png"])
                if uploaded_file is not None:
                    file_path = self.save_uploaded_file(uploaded_file)
                    new_content = file_path
                    st.image(read_image(file_path), caption='New Image', use_column_width=True)
                else:
                    new_content = doc.content if doc.doc_type == 'image' else None
                    if new_content:
                        st.image(read_image(new_content), caption='Current Image', use_column_width=True)

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