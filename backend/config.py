from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost:5432/security_investigator"
    chroma_persist_dir: str = "./chroma_data"
    upload_dir: str = "../uploads"
    processed_dir: str = "../processed_videos"
    models_dir: str = "../models"
    secret_key: str = "dev-secret-key-change-in-production"
    openai_api_key: str = ""
    ollama_base_url: str = "http://localhost:11434"
    use_ollama: bool = False
    frame_sample_rate: int = 2
    confidence_threshold: float = 0.4
    use_deepsort: bool = False
    cors_origins: str = "http://localhost:3000"
    access_token_expire_minutes: int = 60 * 24

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def ensure_dirs(self) -> None:
        for d in [self.upload_dir, self.processed_dir, self.models_dir, self.chroma_persist_dir]:
            Path(d).mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_dirs()
