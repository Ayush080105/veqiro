# from fastapi import APIRouter, HTTPException
# from pydantic import BaseModel
# import httpx
# import base64
# import os
# import uuid

# from fastapi.concurrency import run_in_threadpool
# from social_media_agent.agent.image_regen import ImageRegenTool

# router = APIRouter()


# # ---------------------------------------------------------
# # CONFIG
# # ---------------------------------------------------------
# OUTPUT_DIR = "generated_images"
# os.makedirs(OUTPUT_DIR, exist_ok=True)


# # ---------------------------------------------------------
# # REQUEST SCHEMA
# # ---------------------------------------------------------
# class ImageRegenRequest(BaseModel):
#     image_url: str   # R2 blob URL
#     prompt: str


# class ImagePreviewRequest(BaseModel):
#     image_url: str


# # ---------------------------------------------------------
# # FETCH FROM R2
# # ---------------------------------------------------------
# async def fetch_r2_image(url: str) -> bytes:
#     try:
#         async with httpx.AsyncClient(timeout=30.0) as client:
#             res = await client.get(url)

#             if res.status_code != 200:
#                 raise HTTPException(
#                     status_code=400,
#                     detail="Failed to fetch image from R2"
#                 )

#             if len(res.content) > 10 * 1024 * 1024:
#                 raise HTTPException(
#                     status_code=400,
#                     detail="Image too large (max 10MB)"
#                 )

#             return res.content

#     except Exception as e:
#         raise HTTPException(
#             status_code=500,
#             detail=f"Error fetching image: {str(e)}"
#         )


# # ---------------------------------------------------------
# # BASE64 PREVIEW ENDPOINT (INPUT IMAGE)
# # ---------------------------------------------------------
# @router.post("/preview-base64")
# async def preview_base64(req: ImagePreviewRequest):
#     try:
#         image_bytes = await fetch_r2_image(req.image_url)

#         base64_str = base64.b64encode(image_bytes).decode("utf-8")

#         return {
#             "status": "success",
#             "base64": base64_str,
#             "data_uri": f"data:image/png;base64,{base64_str}"
#         }

#     except Exception as e:
#         raise HTTPException(
#             status_code=500,
#             detail=str(e)
#         )


# # ---------------------------------------------------------
# # REGENERATE ENDPOINT (OUTPUT IMAGE)
# # ---------------------------------------------------------
# @router.post("/regenerate")
# async def regenerate_image(req: ImageRegenRequest):

#     try:
#         # 1. Fetch original image
#         image_bytes = await fetch_r2_image(req.image_url)

#         # 2. Run tool
#         result = await run_in_threadpool(
#             ImageRegenTool.run,
#             req.prompt,
#             image_bytes
#         )

#         # -------------------------------------------------
#         # HANDLE TOOL OUTPUT (UPDATED)
#         # -------------------------------------------------
#         generated_bytes = None

#         if isinstance(result, bytes):
#             generated_bytes = result

#         elif isinstance(result, str):
#             generated_bytes = await fetch_r2_image(result)

#         elif isinstance(result, dict):

#             # ✅ YOUR CASE
#             if "image_base64" in result:
#                 generated_bytes = base64.b64decode(result["image_base64"])

#             elif "image" in result:
#                 generated_bytes = base64.b64decode(result["image"])

#             elif "data" in result:
#                 generated_bytes = base64.b64decode(result["data"])

#             elif "url" in result:
#                 generated_bytes = await fetch_r2_image(result["url"])

#             else:
#                 raise HTTPException(
#                     status_code=500,
#                     detail=f"Unknown dict format from ImageRegenTool: {result.keys()}"
#                 )

#         else:
#             raise HTTPException(
#                 status_code=500,
#                 detail=f"Unsupported output type: {type(result)}"
#             )

#         # -------------------------------------------------
#         # CONVERT TO BASE64
#         # -------------------------------------------------
#         base64_str = base64.b64encode(generated_bytes).decode("utf-8")

#         # -------------------------------------------------
#         # SAVE LOCALLY
#         # -------------------------------------------------
#         filename = f"{uuid.uuid4()}.png"
#         file_path = os.path.join(OUTPUT_DIR, filename)

#         with open(file_path, "wb") as f:
#             f.write(generated_bytes)

#         # -------------------------------------------------
#         # RESPONSE
#         # -------------------------------------------------
#         return {
#             "status": "success",
#             "data": result,
#             "image_base64": base64_str,
#             "data_uri": f"data:image/png;base64,{base64_str}",
#             "saved_locally": file_path
#         }

#     except Exception as e:
#         raise HTTPException(
#             status_code=500,
#             detail=str(e)
#         )