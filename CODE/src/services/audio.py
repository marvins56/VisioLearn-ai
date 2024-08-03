import os
import logging
from dotenv import load_dotenv
from elevenlabs import play
from elevenlabs.client import ElevenLabs
import whisper

class AudioService:
    def __init__(self) -> None:
        load_dotenv()

        self.logger = self.setup_logger()
        self.model = whisper.load_model("base")
        self.tts_tool = ElevenLabs(api_key=os.environ["ELEVEN_API_KEY"])
    
    def setup_logger(self):
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )
        logger = logging.getLogger(__name__)

        return logger
    
    def transcribe(self, file_path: str) -> str:
        content = self.model.transcribe(file_path)
        return content

    def text_to_audio(self, text: str):
        content = self.tts_tool.generate(
            text=text,
            voice="Will",
            model="eleven_multilingual_v2"
        )
        # play(content)
        return content

    def audio_to_text(self, file_path: str) -> str:
        return self.transcribe(file_path)