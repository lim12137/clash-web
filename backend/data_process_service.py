import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI

from apps.data_process_app import router as data_process_router

# Load environment variables
load_dotenv()

app = FastAPI(root_path="/api")
app.include_router(data_process_router)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5012)
