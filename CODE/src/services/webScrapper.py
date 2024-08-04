import logging
import time
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
        self.driver = None

    def setup_logger(self):
        logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
        return logging.getLogger(__name__)

    def setup_driver(self):
        if self.driver is None:
            self.logger.info("Setting up Edge WebDriver")
            edge_options = EdgeOptions()
            edge_options.add_argument("--headless")
            try:
                driver_path = EdgeChromiumDriverManager().install()
                self.logger.info(f"EdgeDriver installed/found at: {driver_path}")
                service = EdgeService(driver_path)
                self.driver = webdriver.Edge(service=service, options=edge_options)
                self.logger.info("Edge WebDriver set up successfully")
            except Exception as e:
                self.logger.error(f"Failed to set up Edge WebDriver: {str(e)}")
                raise

    def scrape_website(self, url):
        self.setup_driver()  # Ensure driver is set up before scraping
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
                        # self.logger.info(f"Scraped item {i}: {text[:50]}...")
                except Exception as e:
                    self.logger.warning(f"Could not scrape element {i}: {str(e)}")
            
            self.logger.info(f"Total items scraped: {len(data)}")
            return " ".join(data)
        except Exception as e:
            self.logger.error(f"Error during scraping: {str(e)}")
            self.driver = None  # Reset driver on error
            return None

    def close(self):
        if self.driver:
            self.driver.quit()
            self.driver = None
            self.logger.info("WebDriver closed")
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_value, traceback):
        self.close()
