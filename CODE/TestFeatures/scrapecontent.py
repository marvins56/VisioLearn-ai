import os
import time
import logging
from langchain.chains.summarize import load_summarize_chain
from langchain.docstore.document import Document
from langchain.prompts import PromptTemplate
from langchain.text_splitter import CharacterTextSplitter
from langchain.utilities import GoogleSearchAPIWrapper
from selenium import webdriver
from selenium.webdriver.edge.service import Service as EdgeService
from selenium.webdriver.edge.options import Options as EdgeOptions
from webdriver_manager.microsoft import EdgeChromiumDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

class WebScraper:
    def __init__(self):
        self.logger = self.setup_logger()
        self.driver = self.setup_driver()

    def setup_logger(self):
        logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
        return logging.getLogger(__name__)

    def setup_driver(self):
        self.logger.info("Setting up Edge WebDriver")
        edge_options = EdgeOptions()
        edge_options.add_argument("--headless")
        try:
            driver_path = EdgeChromiumDriverManager().install()
            self.logger.info(f"EdgeDriver installed/found at: {driver_path}")
            service = EdgeService(driver_path)
            driver = webdriver.Edge(service=service, options=edge_options)
            self.logger.info("Edge WebDriver set up successfully")
            return driver
        except Exception as e:
            self.logger.error(f"Failed to set up Edge WebDriver: {str(e)}")
            raise

    def scrape_website(self, url):
        self.logger.info(f"Attempting to scrape: {url}")
        try:
            self.driver.get(url)
            self.logger.info("Successfully navigated to the URL")
            
            # Wait for the page to load
            self.logger.info("Waiting for page to load")
            WebDriverWait(self.driver, 20).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            self.logger.info("Page loaded")
            
            # Dynamic scroll to capture all content
            last_height = self.driver.execute_script("return document.body.scrollHeight")
            while True:
                self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(2)  # Wait for new content to load
                new_height = self.driver.execute_script("return document.body.scrollHeight")
                if new_height == last_height:
                    break
                last_height = new_height

            # Get all elements
            elements = self.driver.find_elements(By.XPATH, "//*[not(self::script or self::style)]")
            
            data = []
            for i, element in enumerate(elements, 1):
                try:
                    text = element.text.strip()
                    if text:
                        data.append(text)
                        self.logger.info(f"Scraped item {i}: {text[:50]}...")
                except Exception as e:
                    self.logger.warning(f"Could not scrape element {i}: {str(e)}")
            
            self.logger.info(f"Total items scraped: {len(data)}")
            return " ".join(data)
        except Exception as e:
            self.logger.error(f"Error during scraping: {str(e)}")
            return None

    def close(self):
        if self.driver:
            self.driver.quit()
            self.logger.info("WebDriver closed")
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_value, traceback):
        self.close()



class WebSearchAndSummarize:
    def __init__(self, openai_api_key, google_api_key, google_cse_id):
        os.environ["OPENAI_API_KEY"] = openai_api_key
        # Initialize LLMUtility
        self.llm_utility = LLMUtility(api_key=openai_api_key)
        self.llm = self.llm_utility.get_llm_instance()
        self.search = GoogleSearchAPIWrapper(google_api_key=google_api_key, google_cse_id=google_cse_id)
        self.scraper = WebScraper()
        self.summarizer = Summarizer(self.llm)

    def process_query(self, query):
        search_results = self.search.results(query, 5)  # Get top 5 results
        summaries = []

        for result in search_results:
            url = result["link"]
            title = result["title"]
            scraped_text = self.scraper.scrape_website(url)
            
            if scraped_text:
                full_text = f"Title: {title}\n\nContent: {scraped_text}"
                summary = self.summarizer.summarize_map_reduce(full_text, query)
                summaries.append({"title": title, "url": url, "summary": summary})

        return summaries

    def close(self):
        self.scraper.close()

# Example usage
if __name__ == "__main__":
    openai_api_key = "your-openai-api-key"
    google_api_key = "your-google-api-key"
    google_cse_id = "your-google-cse-id"

    searcher = WebSearchAndSummarize(openai_api_key, google_api_key, google_cse_id)

    query = "What are the latest advancements in quantum computing?"
    results = searcher.process_query(query)

    print(f"Query: {query}\n")
    for i, result in enumerate(results, 1):
        print(f"Result {i}:")
        print(f"Title: {result['title']}")
        print(f"URL: {result['url']}")
        print(f"Summary: {result['summary']}\n")

    searcher.close()
