
from langchain.text_splitter import CharacterTextSplitter
from langchain.prompts import PromptTemplate
from langchain.chains.summarize import load_summarize_chain
import tiktoken
from langchain.docstore.document import Document


class Summarizer:
    def __init__(self, llm, max_tokens=3000):
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

    def summarize_map_reduce(self, text, query):
        docs = self.text_splitter.create_documents([text])
        print("--------------------------------------------------------------------------------")
        self.log_tokens(text, "Input text")
        self.log_tokens(query, "Query")
        print("--------------------------------------------------------------------------------")

        map_prompt_template = """
        Summarize the following text in the context of the query: {query}

        Text: {text}

        Summary:
        """
        map_prompt = PromptTemplate(template=map_prompt_template, input_variables=["text", "query"])
        
        combine_prompt_template = """
        Combine the following summaries into a coherent summary addressing the query: {query}

        Summaries: {text}

        Combined summary:
        """
        combine_prompt = PromptTemplate(template=combine_prompt_template, input_variables=["text", "query"])
        print("**********************************************************************************************************************")
        self.log_tokens(map_prompt_template, "Map prompt template")
        self.log_tokens(combine_prompt_template, "Combine prompt template")
        print("**********************************************************************************************************************")

        chain = load_summarize_chain(
            self.llm,
            chain_type="map_reduce",
            map_prompt=map_prompt,
            combine_prompt=combine_prompt,
            verbose=True
        )
        
        # Truncate each document if it exceeds the max token limit
        truncated_docs = [self.truncate_text(doc.page_content, self.max_tokens) for doc in docs]
        docs = [Document(page_content=doc) for doc in truncated_docs]

        result = chain.run({"input_documents": docs, "query": query})
        self.log_tokens(result, "Final summary")
        return result

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