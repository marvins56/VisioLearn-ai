# import os
# from langchain.utilities import GoogleSearchAPIWrapper

# from src.services.summarizer import Summarizer
# from src.services.webScrapper import WebScraper
# from src.utils import LLMUtility

# class WebSearchAndSummarize:
#     def __init__(self):

#         google_api_key = os.getenv("GOOGLE_API_KEY")
#         google_cse_id = os.getenv("GOOGLE_CSE_ID")
      
#         if not google_api_key:
#             raise ValueError("GOOGLE_API_KEY not set in environment variables")
#         if not google_cse_id:
#             raise ValueError("GOOGLE_CSE_ID not set in environment variables")
#         # Initialize LLMUtility
#         self.llm_utility = LLMUtility()
#         self.llm = self.llm_utility.get_llm_instance()
#         self.search = GoogleSearchAPIWrapper(google_api_key=google_api_key, google_cse_id=google_cse_id)
#         self.scraper = WebScraper()
#         self.summarizer = Summarizer(self.llm)

#     def process_query(self, query):
#         search_results = self.search.results(query, 5)  # Get top 5 results
#         summaries = []

#         for result in search_results:
#             url = result["link"]
#             title = result["title"]
#             scraped_text = self.scraper.scrape_website(url)
            
#             if scraped_text:
#                 full_text = f"Title: {title}\n\nContent: {scraped_text}"
#                 summary = self.summarizer.summarize_map_reduce(full_text, query)
#                 summaries.append({"title": title, "url": url, "summary": summary})

#         return summaries

#     def close(self):
#         self.scraper.close()
import os
from langchain.utilities import GoogleSearchAPIWrapper
from src.services.summarizer import Summarizer
from src.services.webScrapper import WebScraper
from src.utils import LLMUtility
import logging

class WebSearchAndSummarize:
    def __init__(self):
        # Configure logging
        logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
        self.logger = logging.getLogger(__name__)

        # Retrieve API keys and configuration from environment variables
        google_api_key = os.getenv("GOOGLE_API_KEY")
        google_cse_id = os.getenv("GOOGLE_CSE_ID")
        
        if not google_api_key:
            raise ValueError("GOOGLE_API_KEY not set in environment variables")
        if not google_cse_id:
            raise ValueError("GOOGLE_CSE_ID not set in environment variables")

        # Initialize LLMUtility
        self.llm_utility = LLMUtility()
        self.llm = self.llm_utility.get_llm_instance()
        self.search = GoogleSearchAPIWrapper(google_api_key=google_api_key, google_cse_id=google_cse_id)
        self.scraper = WebScraper()
        self.summarizer = Summarizer(self.llm)

    def process_query(self, query):
        try:
            search_results = self.search.results(query, 1)  # Get top 5 results
            summaries = []

            for result in search_results:
                url = result["link"]
                title = result["title"]
                self.logger.info(f"Processing URL: {url}")

                scraped_text = self.scraper.scrape_website(url)
                if scraped_text:
                    full_text = f"Title: {title}\n\nContent: {scraped_text}"
                    summary = self.summarizer.summarize_map_reduce(full_text, query)
                    summaries.append({"title": title, "url": url, "summary": summary})
            
            return summaries
        except Exception as e:
            self.logger.error(f"Error processing query: {str(e)}")
            return []

    def close(self):
        self.scraper.close()
