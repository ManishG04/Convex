import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    SOCKET_PORT: int = int(os.getenv("SOCKET_PORT", "3001"))

    # Timer settings (in minutes)
    FOCUS_DURATION: int = 25
    BREAK_DURATION: int = 5


settings = Settings()
