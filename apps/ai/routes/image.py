# from fastapi import APIRouter, HTTPException
# import httpx

# from schemas.image import RegenRequest, RegenResponse
# from tools.regenerate_tool import RegenerateTool

# router = APIRouter()


# async def fetch_image(url: str):
#     async with httpx.AsyncClient() as client:
#         res = await client.get(url)
#         if res.status_code != 200:
#             raise HTTPException(status_code=400, detail="Invalid image URL")
#         return res.content


# @router.post("/regenerate", response_model=RegenResponse)
# async def regenerate(req: RegenRequest):
#     try:
#         image_bytes = await fetch_image(req.image_url)

#         from fastapi.concurrency import run_in_threadpool

#         result = await run_in_threadpool(
#             RegenerateTool.run,
#             prompt=req.prompt,
#             image_bytes=image_bytes
#         )

#         return result

#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))