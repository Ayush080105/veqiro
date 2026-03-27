from pydantic import BaseModel


class RegenRequest(BaseModel):
    image_url: str
    prompt: str


class ImageVariation(BaseModel):
    base64: str


class RegenResponse(BaseModel):
    session_id: str
    model_used: str
    prompt_used: str
    variations: list[ImageVariation]