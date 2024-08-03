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

class WebScraper:
    def __init__(self):
        self.logger = self.setup_logger()
        self.driver_path = self.install_chromedriver()
        self.driver = self.setup_driver(self.driver_path)

    def setup_logger(self):
        logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
        logger = logging.getLogger(__name__)
        return logger

    def install_chromedriver(self):
        self.logger.info("Checking ChromeDriver installation")
        try:
            driver_path = ChromeDriverManager().install()
            self.logger.info(f"ChromeDriver installed successfully at: {driver_path}")
            return driver_path
        except Exception as e:
            self.logger.error(f"Failed to install ChromeDriver: {str(e)}")
            raise

    def setup_driver(self, driver_path):
        self.logger.info("Setting up WebDriver")
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        try:
            service = Service(driver_path)
            driver = webdriver.Chrome(service=service, options=chrome_options)
            self.logger.info("WebDriver set up successfully")
            return driver
        except Exception as e:
            self.logger.error(f"Failed to set up WebDriver: {str(e)}")
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
            
            # Scroll to the bottom of the page to trigger any lazy-loaded content
            self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)  # Wait for any animations or lazy-loading to complete
            
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
            return data
        except Exception as e:
            self.logger.error(f"Error during scraping: {str(e)}")
            return []

    def close(self):
        if self.driver:
          self.driver.quit()
          self.logger.info("WebDriver closed")


# # Example usage
# if __name__ == "__main__":
#     scraper = WebScraper()
#     url = "http://example.com"
#     scraped_data = scraper.scrape_website(url)
#     scraper.close()
#     print(scraped_data)

