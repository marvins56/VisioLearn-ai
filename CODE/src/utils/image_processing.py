import cv2
import numpy as np

def read_image(img_path: str) -> np.ndarray:
    img = cv2.imread(img_path)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    return img