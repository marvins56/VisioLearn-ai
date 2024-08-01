import os
import cv2
import easyocr
from typing import List, Union
import numpy as np
import torch
from dotenv import load_dotenv

class OCR:
    def __init__(self, is_cuda=None):
        # Load environment variables
        load_dotenv()
        
        # Set up the model path
        current_dir = os.path.dirname(os.path.abspath(__file__))
        self.model_path = os.path.join(current_dir, 'OCR_models')
        
        # Create the OCR_models directory if it doesn't exist
        if not os.path.exists(self.model_path):
            os.makedirs(self.model_path)
            print(f"Created OCR_models directory at: {self.model_path}")
        
        # Determine if CUDA is available if is_cuda is not explicitly set
        if is_cuda is None:
            is_cuda = torch.cuda.is_available()
        
        # Initialize the EasyOCR reader
        self.reader = easyocr.Reader(
            ['en'], 
            gpu=is_cuda, 
            model_storage_directory=self.model_path,
            download_enabled=True  # Set to True to allow downloading if models are missing
        )
    # def __init__(self, is_cuda=False):
    #     # Load environment variables
    #     load_dotenv()
        
    #     # Set up the model path
    #     current_dir = os.path.dirname(os.path.abspath(__file__))
    #     self.model_path = os.path.join(current_dir, 'OCR_models')
        
    #     # Create the OCR_models directory if it doesn't exist
    #     if not os.path.exists(self.model_path):
    #         os.makedirs(self.model_path)
    #         print(f"Created OCR_models directory at: {self.model_path}")
        
    #     # Initialize the EasyOCR reader
    #     self.reader = easyocr.Reader(
    #         ['en'], 
    #         gpu=is_cuda, 
    #         model_storage_directory=self.model_path,
    #         download_enabled=True  # Set to True to allow downloading if models are missing
    #     )

    def extract_text(self, img: Union[str, np.ndarray]) -> List[str]:
        if isinstance(img, str):
            img = self._read_img(img)
        result = self.reader.readtext(img)
        extracted_text = [text[1] for text in result if text[2] > 0.45]
        return extracted_text

    @staticmethod
    def _read_img(img_path: str) -> np.ndarray:
        img = cv2.imread(img_path)
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        return img