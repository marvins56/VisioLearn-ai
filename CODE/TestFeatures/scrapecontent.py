import os
import sys
import logging
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup
from webdriver_manager.chrome import ChromeDriverManager
from langchain.llms import OpenAI
from langchain.chains.summarize import load_summarize_chain
from langchain.docstore.document import Document
from langchain.utilities import GoogleSearchAPIWrapper

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Set up OpenAI API key
os.environ["OPENAI_API_KEY"] = "your-openai-api-key"

# Set up Google Search API credentials
os.environ["GOOGLE_CSE_ID"] = "your-google-cse-id"
os.environ["GOOGLE_API_KEY"] = "your-google-api-key"

def install_chromedriver():
    logger.info("Checking ChromeDriver installation")
    try:
        driver_path = ChromeDriverManager().install()
        logger.info(f"ChromeDriver installed successfully at: {driver_path}")
        return driver_path
    except Exception as e:
        logger.error(f"Failed to install ChromeDriver: {str(e)}")
        raise

def setup_driver(driver_path):
    logger.info("Setting up WebDriver")
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    try:
        service = Service(driver_path)
        driver = webdriver.Chrome(service=service, options=chrome_options)
        logger.info("WebDriver set up successfully")
        return driver
    except Exception as e:
        logger.error(f"Failed to set up WebDriver: {str(e)}")
        raise

def scrape_website(url, driver):
    logger.info(f"Attempting to scrape: {url}")
    try:
        driver.get(url)
        logger.info("Successfully navigated to the URL")
        
        # Wait for the page to load
        logger.info("Waiting for page to load")
        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        logger.info("Page loaded")
        
        # Scroll to the bottom of the page to trigger any lazy-loaded content
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(2)  # Wait for any animations or lazy-loading to complete
        
        # Get all elements
        elements = driver.find_elements(By.XPATH, "//*[not(self::script or self::style)]")
        
        data = []
        for i, element in enumerate(elements, 1):
            try:
                text = element.text.strip()
                if text:
                    data.append(text)
                    logger.info(f"Scraped item {i}: {text[:50]}...")
            except Exception as e:
                logger.warning(f"Could not scrape element {i}: {str(e)}")
        
        logger.info(f"Total items scraped: {len(data)}")
        return " ".join(data)
    except Exception as e:
        logger.error(f"Error during scraping: {str(e)}")
        return ""

def summarize_text(text):
    llm = OpenAI(temperature=0)
    chain = load_summarize_chain(llm, chain_type="map_reduce")
    doc = Document(page_content=text)
    summary = chain.run([doc])
    return summary

def search_and_summarize(query):
    search = GoogleSearchAPIWrapper()
    search_results = search.results(query, num_results=5)
    
    driver_path = install_chromedriver()
    driver = setup_driver(driver_path)
    
    summaries = []
    
    for result in search_results:
        url = result['link']
        title = result['title']
        logger.info(f"Processing: {title}")
        
        scraped_text = scrape_website(url, driver)
        if scraped_text:
            summary = summarize_text(scraped_text)
            summaries.append(f"Title: {title}\nURL: {url}\nSummary: {summary}\n")
    
    driver.quit()
    
    return "\n".join(summaries)

# Main process
if __name__ == "__main__":
    search_query = input("Enter your search query: ")
    results = search_and_summarize(search_query)
    
    print("\nSearch Results and Summaries:")
    print(results)
    
    # Save results to a file
    with open('search_summaries.txt', 'w', encoding='utf-8') as f:
        f.write(results)
    logger.info("Results saved in 'search_summaries.txt'")

print("Script execution completed. Check the logs for details.")