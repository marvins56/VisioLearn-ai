from langchain.prompts import PromptTemplate
from langchain.chains.combine_documents.stuff import StuffDocumentsChain
from langchain.chains import MapReduceDocumentsChain, ReduceDocumentsChain
from langchain.chains.llm import LLMChain
from langchain.chains.summarize import load_summarize_chain
from langchain_text_splitters import CharacterTextSplitter

class Summarizer:
    def __init__(self, llm_utility):
        self.llm = llm_utility.get_llm_instance()
        self.text_splitter = CharacterTextSplitter.from_tiktoken_encoder(chunk_size=1000, chunk_overlap=0)
    
    # def load_text(self, texts):
    #     self.docs = [{"text": text} for text in texts]
    #     self.split_docs = self.text_splitter.split_documents(self.docs)
    #     print("text spliting complete")
    def load_text(self, texts):
        if isinstance(texts, list) and all(isinstance(text, str) for text in texts):
        # Convert list of strings to the format expected by the text splitter
            self.docs = [{"page_content": self.clean_text(text)} for text in texts]
            self.split_docs = self.text_splitter.split_documents(self.docs)
            print("Text splitting complete")
        else:
            raise ValueError("Input texts must be a list of strings")

    def clean_text(self, text):
        # Basic text cleaning
        import re
        # Remove emojis
        text = re.sub(r'[^\u0000-\uFFFF]', '', text)
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        # Add more cleaning steps as needed
        return text

    def stuff_summary(self):
        prompt_template = """Write a concise summary of the following:
        "{text}"
        CONCISE SUMMARY:"""
        prompt = PromptTemplate.from_template(prompt_template)
        llm_chain = LLMChain(llm=self.llm, prompt=prompt)
        stuff_chain = StuffDocumentsChain(llm_chain=llm_chain, document_variable_name="text")
        return stuff_chain.invoke(self.docs)["output_text"]

    def map_reduce_summary(self):
        map_template = """The following is a set of documents:
        {docs}
        Based on this list of docs, please identify the main themes.
        Helpful Answer:"""
        map_prompt = PromptTemplate.from_template(map_template)
        map_chain = LLMChain(llm=self.llm, prompt=map_prompt)

        reduce_template = """The following is a set of summaries:
        {docs}
        Take these and distill them into a final, consolidated summary of the main themes.
        Helpful Answer:"""
        reduce_prompt = PromptTemplate.from_template(reduce_template)
        reduce_chain = LLMChain(llm=self.llm, prompt=reduce_prompt)
        combine_documents_chain = StuffDocumentsChain(llm_chain=reduce_chain, document_variable_name="docs")
        reduce_documents_chain = ReduceDocumentsChain(combine_documents_chain=combine_documents_chain, collapse_documents_chain=combine_documents_chain, token_max=4000)
        map_reduce_chain = MapReduceDocumentsChain(llm_chain=map_chain, reduce_documents_chain=reduce_documents_chain, document_variable_name="docs")
        return map_reduce_chain.invoke(self.split_docs)["output_text"]

    def refine_summary(self):
        refine_template = (
            "Your job is to produce a final summary\n"
            "We have provided an existing summary up to a certain point: {existing_answer}\n"
            "We have the opportunity to refine the existing summary"
            "(only if needed) with some more context below.\n"
            "------------\n"
            "{text}\n"
            "------------\n"
            "Given the new context, refine the original summary."
        )
        refine_prompt = PromptTemplate.from_template(refine_template)
        chain = load_summarize_chain(self.llm, chain_type="refine", refine_prompt=refine_prompt)
        return chain.invoke({"input_documents": self.split_docs})["output_text"]

    def summarize(self, method="stuff"):
        print("------------************-----------"+ method + "--------------------********************************")
        if method == "stuff":
            return self.stuff_summary()
        elif method == "map_reduce":
            return self.map_reduce_summary()
        elif method == "refine":
            return self.refine_summary()
        else:
            raise ValueError("Invalid method. Choose 'stuff', 'map_reduce', or 'refine'.")








# class Summarizer:
#     def __init__(self, llm_utility):
#         self.llm = llm_utility.get_llm_instance()
#         self.text_splitter = CharacterTextSplitter.from_tiktoken_encoder(chunk_size=1000, chunk_overlap=0)
    
#     def load_text(self, texts):
#         self.docs = [{"text": text} for text in texts]
#         self.split_docs = self.text_splitter.split_documents(self.docs)

#     def stuff_summary(self):
#         prompt_template = """Write a concise summary of the following:
#         "{text}"
#         CONCISE SUMMARY:"""
#         prompt = PromptTemplate.from_template(prompt_template)
#         llm_chain = LLMChain(llm=self.llm, prompt=prompt)
#         stuff_chain = StuffDocumentsChain(llm_chain=llm_chain, document_variable_name="text")
#         return stuff_chain.invoke(self.docs)["output_text"]

#     def map_reduce_summary(self):
#         map_template = """The following is a set of documents:
#         {docs}
#         Based on this list of docs, please identify the main themes.
#         Helpful Answer:"""
#         map_prompt = PromptTemplate.from_template(map_template)
#         map_chain = LLMChain(llm=self.llm, prompt=map_prompt)

#         reduce_template = """The following is a set of summaries:
#         {docs}
#         Take these and distill them into a final, consolidated summary of the main themes.
#         Helpful Answer:"""
#         reduce_prompt = PromptTemplate.from_template(reduce_template)
#         reduce_chain = LLMChain(llm=self.llm, prompt=reduce_prompt)
#         combine_documents_chain = StuffDocumentsChain(llm_chain=reduce_chain, document_variable_name="docs")
#         reduce_documents_chain = ReduceDocumentsChain(combine_documents_chain=combine_documents_chain, collapse_documents_chain=combine_documents_chain, token_max=4000)
#         map_reduce_chain = MapReduceDocumentsChain(llm_chain=map_chain, reduce_documents_chain=reduce_documents_chain, document_variable_name="docs")
#         return map_reduce_chain.invoke(self.split_docs)["output_text"]

#     def refine_summary(self):
#         refine_template = (
#             "Your job is to produce a final summary\n"
#             "We have provided an existing summary up to a certain point: {existing_answer}\n"
#             "We have the opportunity to refine the existing summary"
#             "(only if needed) with some more context below.\n"
#             "------------\n"
#             "{text}\n"
#             "------------\n"
#             "Given the new context, refine the original summary."
#         )
#         refine_prompt = PromptTemplate.from_template(refine_template)
#         chain = load_summarize_chain(self.llm, chain_type="refine", refine_prompt=refine_prompt)
#         return chain.invoke({"input_documents": self.split_docs})["output_text"]

#     def summarize(self, method="stuff"):
#         if method == "stuff":
#             return self.stuff_summary()
#         elif method == "map_reduce":
#             return self.map_reduce_summary()
#         elif method == "refine":
#             return self.refine_summary()
#         else:
#             raise ValueError("Invalid method. Choose 'stuff', 'map_reduce', or 'refine'.")

# Example Usage
# from your_llm_utility_file import LLMUtility

# llm_utility = LLMUtility(api_key="your_api_key", base_url="your_base_url")
# summarizer = Summarizer(llm_utility)
# texts = [
#     "Text 1 content here...",
#     "Text 2 content here...",
#     "Text 3 content here..."
# ]
# summarizer.load_text(texts)
# print("Stuff Summary:\n", summarizer.summarize(method="stuff"))
# print("\nMap-Reduce Summary:\n", summarizer.summarize(method="map_reduce"))
# print("\nRefine Summary:\n", summarizer.summarize(method="refine"))