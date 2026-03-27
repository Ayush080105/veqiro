from pydantic import BaseModel
from typing import List


class QueryRequest(BaseModel):
    dataset_id: str
    query: str


class InsightsRequest(BaseModel):
    dataset_id: str


class UploadResponse(BaseModel):
    dataset_id: str
    columns: List[str]
    row_count: int