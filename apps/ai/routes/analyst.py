import io
import sqlite3
import uuid

import pandas as pd
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse

from data_analyst_agent.agent import AnalystAgent
from data_analyst_agent.dataset_registry import (
    dataset_exists,
    get_dataset,
    list_datasets,
    register_dataset,
)
from data_analyst_agent.tools.auto_analysis import run_auto_analysis
from data_analyst_agent.tools.data_profiler import profile_dataset
from data_analyst_agent.tools.file_handler import save_upload
from data_analyst_agent.tools.schema_extractor import extract_schema

router = APIRouter()
agent = AnalystAgent()


@router.post("/upload")
async def upload(file: UploadFile = File(...)):
    dataset_id = str(uuid.uuid4())

    _, db_path = await save_upload(file, dataset_id)
    schema = extract_schema(db_path)

    register_dataset(
        dataset_id=dataset_id,
        db_path=db_path,
        name=file.filename or dataset_id,
        row_count=schema["row_count"],
        schema=schema,
    )

    return {
        "dataset_id": dataset_id,
        "columns": schema["columns"],
        "row_count": schema["row_count"],
    }


@router.post("/do_analysis")
async def do_analysis(req: dict):
    if not dataset_exists(req["dataset_id"]):
        raise HTTPException(status_code=404, detail="Dataset not found")

    entry = get_dataset(req["dataset_id"])
    db_path = entry["db_path"]
    schema = extract_schema(db_path)

    results = await run_auto_analysis(
        agent=agent,
        db_path=db_path,
        schema=schema,
    )

    return {
        "dataset_id": req["dataset_id"],
        "analysis": results,
    }


@router.post("/query")
async def query(req: dict):
    if not dataset_exists(req["dataset_id"]):
        raise HTTPException(status_code=404, detail="Dataset not found")

    entry = get_dataset(req["dataset_id"])
    return await agent.run(
        db_path=entry["db_path"],
        query=req["query"],
    )


@router.get("/datasets")
async def list_all_datasets():
    """List all registered datasets."""
    return {"datasets": list_datasets()}


@router.post("/profile")
async def profile(req: dict):
    """Return a statistical data quality profile for a dataset."""
    if not dataset_exists(req["dataset_id"]):
        raise HTTPException(status_code=404, detail="Dataset not found")

    entry = get_dataset(req["dataset_id"])
    result = profile_dataset(entry["db_path"])

    return {"dataset_id": req["dataset_id"], "profile": result}


@router.get("/export/{dataset_id}")
async def export_dataset(dataset_id: str):
    """Download the dataset as a CSV file."""
    if not dataset_exists(dataset_id):
        raise HTTPException(status_code=404, detail="Dataset not found")

    entry = get_dataset(dataset_id)
    db_path = entry["db_path"]

    conn = sqlite3.connect(db_path, check_same_thread=False)
    df = pd.read_sql_query("SELECT * FROM dataset", conn)
    conn.close()

    output = io.StringIO()
    df.to_csv(output, index=False)
    output.seek(0)

    filename = entry.get("name", dataset_id).replace(" ", "_")
    if not filename.endswith(".csv"):
        filename += ".csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
