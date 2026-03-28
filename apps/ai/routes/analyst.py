from fastapi import APIRouter, HTTPException, UploadFile, File
import uuid
from pathlib import Path
from data_analyst_agent.agent import AnalystAgent
from data_analyst_agent.tools.file_handler import save_upload
from data_analyst_agent.tools.schema_extractor import extract_schema
from data_analyst_agent.tools.auto_analysis import run_auto_analysis


router = APIRouter()

DATASETS = {}
agent = AnalystAgent()


@router.post("/upload")
async def upload(file: UploadFile = File(...)):
    dataset_id = str(uuid.uuid4())

    csv_path = await save_upload(file, dataset_id)
    DATASETS[dataset_id] = csv_path

    schema = extract_schema(csv_path)

    return {
        "dataset_id": dataset_id,
        "columns": schema["columns"],
        "row_count": schema["row_count"],
    }

@router.post("/do_analysis")
async def do_analysis(req: dict):
    if req["dataset_id"] not in DATASETS:
        raise HTTPException(status_code=404, detail="Dataset not found")

    csv_path = DATASETS[req["dataset_id"]]
    schema = extract_schema(csv_path)

    results = await run_auto_analysis(
        agent=agent,
        csv_path=csv_path,
        schema=schema
    )

    return {
        "dataset_id": req["dataset_id"],
        "analysis": results
    }

@router.post("/query")
async def query(req: dict):
    if req["dataset_id"] not in DATASETS:
        raise HTTPException(status_code=404, detail="Dataset not found")

    return await agent.run(
        csv_path=DATASETS[req["dataset_id"]],
        query=req["query"]
    )