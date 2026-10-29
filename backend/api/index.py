from mangum import Mangum
from app.main import app

handler = Mangum(app, lifespan="off")

# Also expose the ASGI app so Vercel can detect it if needed
app = app