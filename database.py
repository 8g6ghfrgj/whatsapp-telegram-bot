from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.pool import QueuePool
from datetime import datetime
import config
import os

# استخدام PostgreSQL على Render، أو SQLite محليًا
if config.is_render:
    # على Render، استخدم PostgreSQL
    engine = create_engine(
        config.DATABASE_URL,
        poolclass=QueuePool,
        pool_size=5,
        max_overflow=10,
        pool_timeout=30,
        pool_recycle=1800
    )
else:
    # محليًا، استخدم SQLite
    engine = create_engine(
        config.DATABASE_URL,
        connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

# (بقية كود النماذج يبقى كما هو)
