import os
import uuid
import base64

from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from google import genai
from google.genai import types

# ============================================================
# Load Environment
# ============================================================

load_dotenv()

client = genai.Client()  # Reads GEMINI_API_KEY from .env

# ============================================================
# FastAPI
# ============================================================

app = FastAPI(
    title="Gemini Omni Video API",
    version="1.0.0"
)

OUTPUT_DIR = "outputs"
os.makedirs(OUTPUT_DIR, exist_ok=True)


# ============================================================
# Helpers
# ============================================================

def save_video(video_base64: str) -> str:
    """
    Decode base64 video returned by Gemini Omni
    and save it locally.
    """

    filename = f"{uuid.uuid4()}.mp4"
    filepath = os.path.join(OUTPUT_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(base64.b64decode(video_base64))

    return filename


# ============================================================
# Text -> Video
# ============================================================

@app.post("/text-to-video")
async def text_to_video(
    prompt: str = Form(...)
):
    try:

        interaction = client.interactions.create(
            model="gemini-omni-flash-preview",
            input=prompt,
        )

        if getattr(interaction, "output_video", None) is None:
            raise HTTPException(
                status_code=500,
                detail="No video returned by Gemini."
            )

        filename = save_video(interaction.output_video.data)

        return {
            "success": True,
            "interaction_id": interaction.id,
            "filename": filename,
            "video_url": f"/video/{filename}"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# Image -> Video
# ============================================================

@app.post("/image-to-video")
async def image_to_video(
    image: UploadFile = File(...),
    prompt: str = Form(...)
):
    try:

        image_bytes = await image.read()
        base64_image = base64.b64encode(image_bytes).decode("utf-8")


        interaction = client.interactions.create(
            model="gemini-omni-flash-preview",
            input=[
                {
                    "type": "image",
                    "data": base64_image,
                    "mime_type": image.content_type,
                },
                {
                    "type": "text",
                    "text": prompt,
                },
            ],
        )

        if getattr(interaction, "output_video", None) is None:
            raise HTTPException(
                status_code=500,
                detail="No video returned by Gemini."
            )

        filename = save_video(interaction.output_video.data)

        return {
            "success": True,
            "interaction_id": interaction.id,
            "filename": filename,
            "video_url": f"/video/{filename}"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# Download Video
# ============================================================

@app.get("/video/{filename}")
async def get_video(filename: str):

    filepath = os.path.join(OUTPUT_DIR, filename)

    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Video not found")

    return FileResponse(
        path=filepath,
        media_type="video/mp4",
        filename=filename,
    )


# ============================================================
# Health Check
# ============================================================

@app.get("/")
def home():
    return {
        "message": "Gemini Omni Video API Running"
    }


# ============================================================
# Run
# ============================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",      # Change "main" if your filename is different
        host="0.0.0.0",
        port=8000,
        reload=True,
    )