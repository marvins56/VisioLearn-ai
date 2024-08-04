
from langchain.text_splitter import CharacterTextSplitter
from langchain.prompts import PromptTemplate
from langchain.chains.summarize import load_summarize_chain
import tiktoken
from langchain.docstore.document import Document

import time
import logging
from typing import List

class Summarizer:
    def __init__(self, llm, max_tokens=2000):
        self.llm = llm
        self.text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        self.tokenizer = tiktoken.get_encoding("cl100k_base")
        self.max_tokens = max_tokens

    def count_tokens(self, text):
        return len(self.tokenizer.encode(text))

    def log_tokens(self, text, description):
        token_count = self.count_tokens(text)
        print(f"{description}: {token_count} tokens")

    def truncate_text(self, text, max_tokens):
        tokens = self.tokenizer.encode(text)
        if len(tokens) > max_tokens:
            truncated_tokens = tokens[:max_tokens]
            return self.tokenizer.decode(truncated_tokens)
        return text
    

    def summarize_map_reduce(self, text: str, query: str) -> str:
        # Set up logging
        logging.basicConfig(level=logging.INFO)
        
        # Step 1: Split the text into smaller chunks
        docs = self.text_splitter.create_documents([text])
        
        # Limit to the first 5 chunks if there are more
        num_chunks_to_process = min(len(docs), 5)
        docs = docs[:num_chunks_to_process]

        # Log the number of chunks created and processed
        logging.info(f"--------------------Number of chunks created: {len(docs)} ------------------")
        logging.info(f"--------------------Number of chunks processed: {num_chunks_to_process} ------------------")
        
        # Step 2: Log tokens for the input text and query
        logging.info("--------------------------------------------------------------------------------")
        self.log_tokens(text, "Input text")
        self.log_tokens(query, "Query")
        logging.info("--------------------------------------------------------------------------------")

        # Define the prompt template for summarizing chunks
        map_prompt_template = """
        Summarize the following text in the context of the query: {query}

        Text: {text}

        Summary:
        """
        map_prompt = PromptTemplate(template=map_prompt_template, input_variables=["text", "query"])

        logging.info("**********************************************************************************************************************")
        self.log_tokens(map_prompt_template, "Map prompt template")
        logging.info("**********************************************************************************************************************")

        # Load the summarization chain for individual summaries
        chain = load_summarize_chain(
            self.llm,
            chain_type="map_reduce",
            map_prompt=map_prompt,
            verbose=True
        )
        
        # Step 3: Summarize each chunk separately
        summaries = []
        for i, doc in enumerate(docs):
            logging.info(f"-------------Processing chunk {i + 1} of {num_chunks_to_process}------------------")
            # Truncate the document if it exceeds the max token limit
            truncated_doc = self.truncate_text(doc.page_content, self.max_tokens)
            doc = Document(page_content=truncated_doc)
            
            # Summarize the document
            logging.info(f"--------------Summarizing chunk {i + 1}-----------------")
            try:
                summary = chain.run({"input_documents": [doc], "query": query})
                summaries.append(summary)
                self.log_tokens(summary, f"Chunk {i + 1} summary")
            except Exception as e:
                logging.error(f"Error summarizing chunk {i + 1}: {str(e)}")

        # Log the number of summaries generated
        logging.info(f"----------------Generated {len(summaries)} individual summaries-------------------")

        # Step 4: Combine all individual summaries into one document
        combined_summary = "\n".join(summaries)
        logging.info("------------Combined all individual summaries into a single document-----------------")

        # Truncate the combined summary if it exceeds the max token limit
        truncated_combined_summary = self.truncate_text(combined_summary, self.max_tokens)
        logging.info(f"------------Truncated combined summary to fit within token limit-----------------")

        # Step 5: Further summarize the combined summary based on the query
        final_summary_chain = load_summarize_chain(
            self.llm,
            chain_type="map_reduce",  # Use 'map_reduce' instead of 'combine'
            map_prompt=map_prompt,
            verbose=True
        )
        
        logging.info("---------------Summarizing the combined summary based on the query-------------")
        attempt = 0
        max_retries = 1
        while attempt < max_retries:
            try:
                result = final_summary_chain.run({"input_documents": [Document(page_content=truncated_combined_summary)], "query": query})
                self.log_tokens(result, "Final summary")
                logging.info("Final summary generated")
                return result
            except Exception as e:
                logging.error(f"Error processing final summary: {str(e)}")
                attempt += 1
                sleep_time = 2 ** attempt  # Exponential backoff
                logging.info(f"Retrying in {sleep_time} seconds...")
                time.sleep(sleep_time)
        
        logging.error("Failed to generate final summary after retries.")
        return "Error: Unable to generate final summary."

    
    # def summarize_map_reduce(self, text, query):
    #     docs = self.text_splitter.create_documents([text])
    #     print("--------------------------------------------------------------------------------")
    #     self.log_tokens(text, "Input text")
    #     self.log_tokens(query, "Query")
    #     print("--------------------------------------------------------------------------------")

    #     map_prompt_template = """
    #     Summarize the following text in the context of the query: {query}

    #     Text: {text}

    #     Summary:
    #     """
    #     map_prompt = PromptTemplate(template=map_prompt_template, input_variables=["text", "query"])
        
    #     combine_prompt_template = """
    #     Combine the following summaries into a coherent summary addressing the query: {query}

    #     Summaries: {text}

    #     Combined summary:
    #     """
    #     combine_prompt = PromptTemplate(template=combine_prompt_template, input_variables=["text", "query"])
    #     print("**********************************************************************************************************************")
    #     self.log_tokens(map_prompt_template, "Map prompt template")
    #     self.log_tokens(combine_prompt_template, "Combine prompt template")
    #     print("**********************************************************************************************************************")

    #     chain = load_summarize_chain(
    #         self.llm,
    #         chain_type="map_reduce",
    #         map_prompt=map_prompt,
    #         combine_prompt=combine_prompt,
    #         verbose=True
    #     )
        
    #     # Truncate each document if it exceeds the max token limit
    #     truncated_docs = [self.truncate_text(doc.page_content, self.max_tokens) for doc in docs]
    #     docs = [Document(page_content=doc) for doc in truncated_docs]

    #     result = chain.run({"input_documents": docs, "query": query})
    #     self.log_tokens(result, "Final summary")
    #     return result

# class Summarizer:
#     def __init__(self, llm):
#         self.llm = llm
#         self.text_splitter = CharacterTextSplitter()

#     def summarize_map_reduce(self, text, query):
#         docs = self.text_splitter.create_documents([text])
#         print("--------------------------------------------------------------------------------")
        

#         print("--------------------------------------------------------------------------------")

#         map_prompt_template = """
#         The following text is scraped web content. Summarize it in the context of the user's query: {query}

#         Text: {text}

#         Summary:
#         """
#         map_prompt = PromptTemplate(template=map_prompt_template, input_variables=["text", "query"])
        
#         combine_prompt_template = """
#         The following are summaries of scraped web content. Combine them into a coherent summary that addresses the user's query: {query}

#         Summaries: {text}

#         Combined summary:
#         """
#         combine_prompt = PromptTemplate(template=combine_prompt_template, input_variables=["text", "query"])
#         print("**********************************************************************************************************************")
        

#         print("**********************************************************************************************************************")

#         chain = load_summarize_chain(
#             self.llm,
#             chain_type="map_reduce",
#             map_prompt=map_prompt,
#             combine_prompt=combine_prompt,
#             verbose=True
#         )
        
#         return chain.run({"input_documents": docs, "query": query})