from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import config

engine = create_engine(config.DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(Integer, unique=True, index=True)
    username = Column(String(100))
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # العلاقات
    whatsapp_sessions = relationship("WhatsAppSession", back_populates="user")
    ads = relationship("Advertisement", back_populates="user")
    links = relationship("Link", back_populates="user")

class WhatsAppSession(Base):
    __tablename__ = "whatsapp_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    session_name = Column(String(100))
    phone_number = Column(String(20))
    is_active = Column(Boolean, default=True)
    last_active = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # العلاقات
    user = relationship("User", back_populates="whatsapp_sessions")

class Link(Base):
    __tablename__ = "links"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    url = Column(String(500), unique=True)
    link_type = Column(String(50))  # whatsapp, telegram, other
    source = Column(String(100))  # group, private, etc.
    extracted_at = Column(DateTime, default=datetime.utcnow)
    
    # العلاقات
    user = relationship("User", back_populates="links")

class Advertisement(Base):
    __tablename__ = "advertisements"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String(200))
    content = Column(Text)
    media_type = Column(String(50))  # text, photo, video, contact
    media_path = Column(String(500))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # العلاقات
    user = relationship("User", back_populates="ads")

class AutoReply(Base):
    __tablename__ = "auto_replies"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    trigger_type = Column(String(50))  # private, group
    keyword = Column(String(200))
    response_type = Column(String(50))  # text, ad
    response_content = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class PublishedGroup(Base):
    __tablename__ = "published_groups"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    group_id = Column(String(200))
    ad_id = Column(Integer, ForeignKey("advertisements.id"))
    published_at = Column(DateTime, default=datetime.utcnow)

# إنشاء الجداول
Base.metadata.create_all(bind=engine)
