import sys
import json
from datetime import datetime

sys.path.append('.')
from backend.database import SessionLocal
from backend import models
from fastapi.encoders import jsonable_encoder

db = SessionLocal()
race = db.query(models.Race).order_by(models.Race.id.desc()).first()
if race:
    print(json.dumps(jsonable_encoder(race), indent=2))
else:
    print("No race found")
