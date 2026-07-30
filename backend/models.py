from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from .database import Base


class Droid(Base):
    __tablename__ = "droids"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    aruco_id = Column(Integer, index=True)
    color_hex = Column(String, default="#ffffff")

    laps = relationship("Lap", back_populates="droid")

class AppSetting(Base):
    __tablename__ = "app_settings"
    key = Column(String, primary_key=True, index=True)
    value = Column(String)

class Season(Base):
    __tablename__ = "seasons"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    races = relationship("Race", back_populates="season")

class Race(Base):
    __tablename__ = "races"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    status = Column(String, default="pending") # pending, active, finished
    start_time = Column(DateTime, nullable=True)

    # Race Rules
    race_type = Column(String, default="time") # 'time' or 'laps'
    duration_seconds = Column(Integer, default=240) # Default 4 mins
    max_laps = Column(Integer, default=10) # Default 10 laps

    # Season properties
    season_id = Column(Integer, ForeignKey("seasons.id"), nullable=True)
    race_class = Column(String, default="adhoc") # 'adhoc', 'heat', 'final'

    season = relationship("Season", back_populates="races")
    laps = relationship("Lap", back_populates="race")
    entries = relationship("RaceEntry", back_populates="race")

class RaceEntry(Base):
    __tablename__ = "race_entries"

    id = Column(Integer, primary_key=True, index=True)
    race_id = Column(Integer, ForeignKey("races.id"))
    droid_id = Column(Integer, ForeignKey("droids.id"))

    race = relationship("Race", back_populates="entries")
    droid = relationship("Droid")

class Lap(Base):
    __tablename__ = "laps"

    id = Column(Integer, primary_key=True, index=True)
    race_id = Column(Integer, ForeignKey("races.id"))
    droid_id = Column(Integer, ForeignKey("droids.id"))
    lap_number = Column(Integer)
    timestamp = Column(DateTime, default=datetime.utcnow)
    lap_time_ms = Column(Integer)

    race = relationship("Race", back_populates="laps")
    droid = relationship("Droid", back_populates="laps")
