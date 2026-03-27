from app import create_app
from routes import image_regen
from routes import chat, brand, analyst

app = create_app()

app.include_router(chat.router, prefix="/chat", tags=["Chat"])
app.include_router(brand.router, prefix="/brand", tags=["Brand"])
app.include_router(analyst.router, prefix="/analyst", tags=["Analyst"])
app.include_router(image_regen.router, prefix="/image", tags=["Image"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", reload=True)