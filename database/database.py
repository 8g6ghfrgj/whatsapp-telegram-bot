from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import config

Base = declarative_base()
engine = create_engine(config.Config.DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

class User(Base):
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True)
    telegram_id = Column(String, unique=True, nullable=False)
    username = Column(String)
    first_name = Column(String)
    last_name = Column(String)
    session_active = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    groups = relationship("Group", back_populates="user")
    messages = relationship("Message", back_populates="user")

class Group(Base):
    __tablename__ = 'groups'
    
    id = Column(Integer, primary_key=True)
    whatsapp_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    invite_link = Column(String)
    user_id = Column(Integer, ForeignKey('users.id'))
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    user = relationship("User", back_populates="groups")
    messages = relationship("Message", back_populates="group")

class Message(Base):
    __tablename__ = 'messages'
    
    id = Column(Integer, primary_key=True)
    content = Column(Text, nullable=False)
    status = Column(String, default='pending')  # pending, sent, failed
    scheduled_time = Column(DateTime)
    sent_at = Column(DateTime)
    user_id = Column(Integer, ForeignKey('users.id'))
    group_id = Column(Integer, ForeignKey('groups.id'))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="messages")
    group = relationship("Group", back_populates="messages")

def init_db():
    Base.metadata.create_all(engine)
    print("✅ Database initialized successfully")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
