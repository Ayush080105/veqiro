from pydantic import BaseModel


class BrandKitResponse(BaseModel):
    brand_kit: dict
    context_preview: str