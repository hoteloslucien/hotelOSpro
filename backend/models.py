"""Hotel OS V2 — All models: Socle + Métier + Attendance + Conversations"""
from sqlalchemy import Column, Integer, String, Text, Boolean, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base
import enum

class UserRole(str, enum.Enum):
    technicien="technicien"; gouvernante="gouvernante"; reception="reception"; responsable="responsable"; direction="direction"; responsable_technique="responsable_technique"
class RoomStatus(str, enum.Enum):
    libre="libre"; occupee="occupee"; en_menage="en_menage"; sale="sale"; bloquee="bloquee"; prete="prete"
class TaskStatus(str, enum.Enum):
    a_faire="a_faire"; en_cours="en_cours"; pause="pause"; terminee="terminee"; validee="validee"; refusee="refusee"
class TaskPriority(str, enum.Enum):
    basse="basse"; normale="normale"; haute="haute"; urgente="urgente"
class InterventionStatus(str, enum.Enum):
    nouvelle="nouvelle"; en_attente="en_attente"; prise="prise"; en_cours="en_cours"; pause="pause"; terminee="terminee"; cloturee="cloturee"; duplicate="duplicate"
class RoundStatus(str, enum.Enum):
    planifiee="planifiee"; en_cours="en_cours"; pause="pause"; terminee="terminee"
class EquipmentStatus(str, enum.Enum):
    operationnel="operationnel"; en_panne="en_panne"; maintenance="maintenance"; hors_service="hors_service"

# ═══ SOCLE ═══
class Hotel(Base):
    __tablename__="hotels"
    id=Column(Integer,primary_key=True,index=True); name=Column(String(150),nullable=False)
    code=Column(String(20),unique=True,nullable=False); address=Column(Text,nullable=True)
    city=Column(String(100),nullable=True); country=Column(String(60),default="France")
    brand=Column(String(100),nullable=True)
    phone=Column(String(30),nullable=True); email=Column(String(150),nullable=True)
    logo_url=Column(String(300),nullable=True)
    timezone=Column(String(50),default="Europe/Paris")
    language=Column(String(10),default="fr")
    is_active=Column(Boolean,default=True)
    created_at=Column(DateTime(timezone=True),server_default=func.now())
    updated_at=Column(DateTime(timezone=True),onupdate=func.now())
    zones=relationship("Zone",back_populates="hotel"); services=relationship("Service",back_populates="hotel")

class Zone(Base):
    __tablename__="zones"
    id=Column(Integer,primary_key=True,index=True); name=Column(String(100),nullable=False)
    code=Column(String(30),nullable=True); type=Column(String(30),nullable=True)  # zone, lieu, etage, secteur, batiment, aile
    parent_id=Column(Integer,ForeignKey("zones.id"),nullable=True)
    hotel_id=Column(Integer,ForeignKey("hotels.id"),nullable=False)
    description=Column(Text,nullable=True); is_active=Column(Boolean,default=True)
    created_at=Column(DateTime(timezone=True),server_default=func.now())
    hotel=relationship("Hotel",back_populates="zones"); parent=relationship("Zone",remote_side=[id])

class Service(Base):
    __tablename__="services"
    id=Column(Integer,primary_key=True,index=True); name=Column(String(100),nullable=False)
    code=Column(String(30),unique=True,nullable=False); hotel_id=Column(Integer,ForeignKey("hotels.id"),nullable=False)
    color=Column(String(7),nullable=True); icon=Column(String(10),nullable=True); is_active=Column(Boolean,default=True)
    created_at=Column(DateTime(timezone=True),server_default=func.now())
    hotel=relationship("Hotel",back_populates="services")

class AuditLog(Base):
    __tablename__="audit_logs"
    id=Column(Integer,primary_key=True,index=True); user_id=Column(Integer,ForeignKey("users.id"),nullable=True)
    hotel_id=Column(Integer,ForeignKey("hotels.id"),nullable=True); action=Column(String(50),nullable=False)
    entity_type=Column(String(50),nullable=True); entity_id=Column(Integer,nullable=True); detail=Column(Text,nullable=True)
    created_at=Column(DateTime(timezone=True),server_default=func.now())
    user=relationship("User")

# ═══ MÉTIER ═══
class User(Base):
    __tablename__="users"
    id=Column(Integer,primary_key=True,index=True); name=Column(String(100),nullable=False)
    email=Column(String(150),unique=True,nullable=False,index=True); password_hash=Column(String(255),nullable=False)
    role=Column(String(20),default="technicien"); service=Column(String(50),nullable=True)
    is_active=Column(Boolean,default=True); avatar_url=Column(String(300),nullable=True)
    hotel_id=Column(Integer,ForeignKey("hotels.id"),nullable=True)
    created_at=Column(DateTime(timezone=True),server_default=func.now()); updated_at=Column(DateTime(timezone=True),onupdate=func.now())
    tasks_assigned=relationship("Task",foreign_keys="Task.assigned_to_id",back_populates="assigned_to")
    tasks_created=relationship("Task",foreign_keys="Task.created_by_id",back_populates="created_by")
    interventions=relationship("Intervention",foreign_keys="Intervention.taken_by_id",back_populates="taken_by")
    rounds=relationship("Round",back_populates="assigned_to")
    # messages_sent: legacy — ne plus utiliser, voir Conversations
    messages_sent=relationship("Message",foreign_keys="Message.sender_id",back_populates="sender")
    hotel=relationship("Hotel")

class Room(Base):
    __tablename__="rooms"
    id=Column(Integer,primary_key=True,index=True); number=Column(String(10),nullable=False)
    floor=Column(Integer,default=1); type=Column(String(50),default="standard")
    status=Column(String(20),default="sale"); is_available=Column(Boolean,default=True)
    notes=Column(Text,nullable=True); last_cleaned=Column(DateTime(timezone=True),nullable=True)
    qr_token=Column(String(64),unique=True,nullable=True)
    hotel_id=Column(Integer,ForeignKey("hotels.id"),nullable=True); zone_id=Column(Integer,ForeignKey("zones.id"),nullable=True)
    created_at=Column(DateTime(timezone=True),server_default=func.now()); updated_at=Column(DateTime(timezone=True),onupdate=func.now())
    tasks=relationship("Task",back_populates="room"); interventions=relationship("Intervention",back_populates="room")
    round_rooms=relationship("RoundRoom",back_populates="room"); reviews=relationship("ClientReview",back_populates="room")
    checkouts=relationship("QRCheckout",back_populates="room"); zone=relationship("Zone")

class Task(Base):
    __tablename__="tasks"
    id=Column(Integer,primary_key=True,index=True); title=Column(String(200),nullable=False)
    description=Column(Text,nullable=True); status=Column(String(20),default="a_faire")
    priority=Column(String(10),default="normale"); service=Column(String(50),nullable=True)
    due_date=Column(DateTime(timezone=True),nullable=True); started_at=Column(DateTime(timezone=True),nullable=True)
    completed_at=Column(DateTime(timezone=True),nullable=True); validated_at=Column(DateTime(timezone=True),nullable=True)
    pause_reason=Column(Text,nullable=True); validation_note=Column(Text,nullable=True)
    hotel_id=Column(Integer,ForeignKey("hotels.id"),nullable=True); room_id=Column(Integer,ForeignKey("rooms.id"),nullable=True)
    assigned_to_id=Column(Integer,ForeignKey("users.id"),nullable=True); created_by_id=Column(Integer,ForeignKey("users.id"),nullable=False)
    created_at=Column(DateTime(timezone=True),server_default=func.now()); updated_at=Column(DateTime(timezone=True),onupdate=func.now())
    room=relationship("Room",back_populates="tasks")
    assigned_to=relationship("User",foreign_keys=[assigned_to_id],back_populates="tasks_assigned")
    created_by=relationship("User",foreign_keys=[created_by_id],back_populates="tasks_created")

class Intervention(Base):
    __tablename__="interventions"
    id=Column(Integer,primary_key=True,index=True); title=Column(String(200),nullable=False)
    description=Column(Text,nullable=True); zone=Column(String(100),nullable=True)
    status=Column(String(20),default="nouvelle"); priority=Column(String(10),default="normale")
    source=Column(String(20),default="staff"); cost=Column(Float,default=0.0)
    resolution_note=Column(Text,nullable=True); photo_url=Column(String(300),nullable=True)
    started_at=Column(DateTime(timezone=True),nullable=True); completed_at=Column(DateTime(timezone=True),nullable=True)
    hotel_id=Column(Integer,ForeignKey("hotels.id"),nullable=True); zone_id=Column(Integer,ForeignKey("zones.id"),nullable=True)
    room_id=Column(Integer,ForeignKey("rooms.id"),nullable=True)
    taken_by_id=Column(Integer,ForeignKey("users.id"),nullable=True); created_by_id=Column(Integer,ForeignKey("users.id"),nullable=True)
    # ── Doublons ──
    is_duplicate=Column(Boolean,default=False,nullable=False)
    duplicate_of_id=Column(Integer,ForeignKey("interventions.id"),nullable=True)
    duplicate_reason=Column(Text,nullable=True)
    duplicate_reported_by=Column(Integer,ForeignKey("users.id"),nullable=True)
    duplicate_marked_at=Column(DateTime(timezone=True),nullable=True)
    # ── Lien équipement V2 ──
    equipment_item_id=Column(Integer,ForeignKey("equipment_items.id"),nullable=True)
    created_at=Column(DateTime(timezone=True),server_default=func.now()); updated_at=Column(DateTime(timezone=True),onupdate=func.now())
    room=relationship("Room",back_populates="interventions")
    taken_by=relationship("User",foreign_keys=[taken_by_id],back_populates="interventions")
    created_by=relationship("User",foreign_keys=[created_by_id]); stock_movements=relationship("StockMovement",back_populates="intervention")
    duplicate_of=relationship("Intervention",remote_side=[id],foreign_keys=[duplicate_of_id])
    equipment_item=relationship("EquipmentItem",foreign_keys=[equipment_item_id])

class Round(Base):
    __tablename__="rounds"
    id=Column(Integer,primary_key=True,index=True); name=Column(String(100),nullable=False)
    date=Column(DateTime(timezone=True),nullable=False); status=Column(String(20),default="planifiee")
    notes=Column(Text,nullable=True); started_at=Column(DateTime(timezone=True),nullable=True)
    completed_at=Column(DateTime(timezone=True),nullable=True)
    hotel_id=Column(Integer,ForeignKey("hotels.id"),nullable=True); assigned_to_id=Column(Integer,ForeignKey("users.id"),nullable=True)
    created_at=Column(DateTime(timezone=True),server_default=func.now())
    assigned_to=relationship("User",back_populates="rounds"); rooms=relationship("RoundRoom",back_populates="round",order_by="RoundRoom.order")

class RoundRoom(Base):
    __tablename__="round_rooms"
    id=Column(Integer,primary_key=True,index=True); order=Column(Integer,default=0)
    status=Column(String(20),default="en_attente"); note=Column(Text,nullable=True)
    completed_at=Column(DateTime(timezone=True),nullable=True)
    round_id=Column(Integer,ForeignKey("rounds.id")); room_id=Column(Integer,ForeignKey("rooms.id"))
    round=relationship("Round",back_populates="rooms"); room=relationship("Room",back_populates="round_rooms")

# ═══ LEGACY — Message (remplacé par Conversations) — ne plus enrichir ═══
class Message(Base):
    __tablename__="messages"
    id=Column(Integer,primary_key=True,index=True); content=Column(Text,nullable=False)
    channel=Column(String(50),default="general"); is_urgent=Column(Boolean,default=False); is_read=Column(Boolean,default=False)
    hotel_id=Column(Integer,ForeignKey("hotels.id"),nullable=True)
    sender_id=Column(Integer,ForeignKey("users.id"),nullable=False); recipient_id=Column(Integer,ForeignKey("users.id"),nullable=True)
    created_at=Column(DateTime(timezone=True),server_default=func.now())
    sender=relationship("User",foreign_keys=[sender_id],back_populates="messages_sent")
    recipient=relationship("User",foreign_keys=[recipient_id])

class QRCheckout(Base):
    __tablename__="qr_checkouts"
    id=Column(Integer,primary_key=True,index=True); token=Column(String(64),unique=True,nullable=False)
    scanned_at=Column(DateTime(timezone=True),nullable=True); guest_name=Column(String(100),nullable=True)
    guest_comment=Column(Text,nullable=True); room_id=Column(Integer,ForeignKey("rooms.id"),nullable=False)
    created_at=Column(DateTime(timezone=True),server_default=func.now())
    room=relationship("Room",back_populates="checkouts")

class ClientReview(Base):
    __tablename__="client_reviews"
    id=Column(Integer,primary_key=True,index=True); rating=Column(Integer,nullable=False)
    category=Column(String(50),nullable=True); comment=Column(Text,nullable=True)
    guest_name=Column(String(100),nullable=True); status=Column(String(20),default="nouveau")
    action_taken=Column(Text,nullable=True); resolved_at=Column(DateTime(timezone=True),nullable=True)
    hotel_id=Column(Integer,ForeignKey("hotels.id"),nullable=True); room_id=Column(Integer,ForeignKey("rooms.id"),nullable=True)
    created_at=Column(DateTime(timezone=True),server_default=func.now())
    room=relationship("Room",back_populates="reviews")

# ═══ LEGACY — Equipment (remplacé par EquipmentFamily/Type/Item) — ne plus enrichir ═══
class Equipment(Base):
    __tablename__="equipment"
    id=Column(Integer,primary_key=True,index=True); name=Column(String(150),nullable=False)
    category=Column(String(50),nullable=True); brand=Column(String(100),nullable=True)
    model=Column(String(100),nullable=True); serial_number=Column(String(100),nullable=True)
    location=Column(String(100),nullable=True); status=Column(String(20),default="operationnel")
    purchase_date=Column(DateTime(timezone=True),nullable=True)
    last_maintenance=Column(DateTime(timezone=True),nullable=True); next_maintenance=Column(DateTime(timezone=True),nullable=True)
    notes=Column(Text,nullable=True); hotel_id=Column(Integer,ForeignKey("hotels.id"),nullable=True)
    zone_id=Column(Integer,ForeignKey("zones.id"),nullable=True); room_id=Column(Integer,ForeignKey("rooms.id"),nullable=True)
    created_at=Column(DateTime(timezone=True),server_default=func.now()); updated_at=Column(DateTime(timezone=True),onupdate=func.now())

# ═══ EQUIPMENT V2 — Familles / Types / Items ═══

class EquipmentFamily(Base):
    __tablename__="equipment_families"
    id=Column(Integer,primary_key=True,index=True)
    code=Column(String(50),unique=True,nullable=False)
    name=Column(String(100),nullable=False)
    sort_order=Column(Integer,default=0,nullable=False)

class EquipmentType(Base):
    __tablename__="equipment_types"
    id=Column(Integer,primary_key=True,index=True)
    family_id=Column(Integer,ForeignKey("equipment_families.id"),nullable=False)
    code=Column(String(50),unique=True,nullable=False)
    name=Column(String(100),nullable=False)
    is_active=Column(Boolean,default=True,nullable=False)
    family=relationship("EquipmentFamily")

class EquipmentItem(Base):
    __tablename__="equipment_items"
    id=Column(Integer,primary_key=True,index=True)
    hotel_id=Column(Integer,ForeignKey("hotels.id"),nullable=False)
    family_id=Column(Integer,ForeignKey("equipment_families.id"),nullable=False)
    type_id=Column(Integer,ForeignKey("equipment_types.id"),nullable=False)
    room_id=Column(Integer,ForeignKey("rooms.id"),nullable=True)
    zone_id=Column(Integer,ForeignKey("zones.id"),nullable=True)
    name=Column(String(150),nullable=False)
    asset_code=Column(String(50),nullable=True)
    brand=Column(String(100),nullable=True)
    model=Column(String(100),nullable=True)
    floor=Column(String(10),nullable=True)
    status=Column(String(20),default="ok",nullable=False)
    notes=Column(Text,nullable=True)
    installed_at=Column(DateTime(timezone=True),nullable=True)
    created_at=Column(DateTime(timezone=True),server_default=func.now())
    updated_at=Column(DateTime(timezone=True),onupdate=func.now())
    family=relationship("EquipmentFamily")
    type=relationship("EquipmentType")
    hotel=relationship("Hotel")
    room=relationship("Room")
    zone=relationship("Zone")

class StockItem(Base):
    __tablename__="stock_items"
    id=Column(Integer,primary_key=True,index=True); name=Column(String(150),nullable=False)
    reference=Column(String(50),nullable=True); category=Column(String(50),nullable=True)
    unit=Column(String(20),default="unite"); quantity=Column(Float,default=0.0)
    threshold_min=Column(Float,default=5.0); location=Column(String(100),nullable=True); unit_cost=Column(Float,default=0.0)
    hotel_id=Column(Integer,ForeignKey("hotels.id"),nullable=True)
    is_active=Column(Boolean,default=True,nullable=False)
    created_at=Column(DateTime(timezone=True),server_default=func.now()); updated_at=Column(DateTime(timezone=True),onupdate=func.now())
    movements=relationship("StockMovement",back_populates="item")
    @property
    def is_low(self): return self.quantity<=self.threshold_min

class StockMovement(Base):
    __tablename__="stock_movements"
    id=Column(Integer,primary_key=True,index=True); type=Column(String(20),nullable=False)
    quantity=Column(Float,nullable=False); note=Column(Text,nullable=True)
    item_id=Column(Integer,ForeignKey("stock_items.id"),nullable=False)
    intervention_id=Column(Integer,ForeignKey("interventions.id"),nullable=True)
    user_id=Column(Integer,ForeignKey("users.id"),nullable=True)
    created_at=Column(DateTime(timezone=True),server_default=func.now())
    item=relationship("StockItem",back_populates="movements"); intervention=relationship("Intervention",back_populates="stock_movements"); user=relationship("User")

# ═══ ATTENDANCE ═══
class AttendanceShift(Base):
    __tablename__="attendance_shifts"
    id=Column(Integer,primary_key=True,index=True); user_id=Column(Integer,ForeignKey("users.id"),nullable=False)
    hotel_id=Column(Integer,ForeignKey("hotels.id"),nullable=True); service=Column(String(50),nullable=True)
    shift_date=Column(String(10),nullable=False); scheduled_start=Column(String(5),nullable=True); scheduled_end=Column(String(5),nullable=True)
    actual_start=Column(DateTime(timezone=True),nullable=True); actual_end=Column(DateTime(timezone=True),nullable=True)
    status=Column(String(20),default="scheduled"); late_minutes=Column(Integer,default=0); notes=Column(Text,nullable=True)
    created_at=Column(DateTime(timezone=True),server_default=func.now()); updated_at=Column(DateTime(timezone=True),onupdate=func.now())
    user=relationship("User",backref="attendance_shifts"); events=relationship("AttendanceEvent",back_populates="shift",order_by="AttendanceEvent.event_time")

class AttendanceEvent(Base):
    __tablename__="attendance_events"
    id=Column(Integer,primary_key=True,index=True); shift_id=Column(Integer,ForeignKey("attendance_shifts.id"),nullable=False)
    user_id=Column(Integer,ForeignKey("users.id"),nullable=False); event_type=Column(String(30),nullable=False)
    event_time=Column(DateTime(timezone=True),server_default=func.now()); notes=Column(Text,nullable=True)
    shift=relationship("AttendanceShift",back_populates="events"); user=relationship("User")

# ═══ CONVERSATIONS (WhatsApp-style) ═══
class Conversation(Base):
    __tablename__="conversations"
    id=Column(Integer,primary_key=True,index=True); hotel_id=Column(Integer,ForeignKey("hotels.id"),nullable=True)
    type=Column(String(20),default="direct")  # direct, group
    name=Column(String(150),nullable=True); created_by_id=Column(Integer,ForeignKey("users.id"),nullable=True)
    is_archived=Column(Boolean,default=False)
    created_at=Column(DateTime(timezone=True),server_default=func.now()); updated_at=Column(DateTime(timezone=True),onupdate=func.now())
    participants=relationship("ConversationParticipant",back_populates="conversation")
    conv_messages=relationship("ConvMessage",back_populates="conversation",order_by="ConvMessage.created_at")
    created_by=relationship("User")

class ConversationParticipant(Base):
    __tablename__="conversation_participants"
    id=Column(Integer,primary_key=True,index=True); conversation_id=Column(Integer,ForeignKey("conversations.id"),nullable=False)
    user_id=Column(Integer,ForeignKey("users.id"),nullable=False)
    role_in_conv=Column(String(20),default="member")  # member, admin
    is_active=Column(Boolean,default=True)
    joined_at=Column(DateTime(timezone=True),server_default=func.now()); left_at=Column(DateTime(timezone=True),nullable=True)
    conversation=relationship("Conversation",back_populates="participants"); user=relationship("User")

class ConvMessage(Base):
    __tablename__="conv_messages"
    id=Column(Integer,primary_key=True,index=True); conversation_id=Column(Integer,ForeignKey("conversations.id"),nullable=False)
    sender_id=Column(Integer,ForeignKey("users.id"),nullable=False)
    body=Column(Text,nullable=False); message_type=Column(String(20),default="text")
    created_at=Column(DateTime(timezone=True),server_default=func.now())
    edited_at=Column(DateTime(timezone=True),nullable=True); deleted_at=Column(DateTime(timezone=True),nullable=True)
    conversation=relationship("Conversation",back_populates="conv_messages"); sender=relationship("User")
    reads=relationship("ConvMessageRead",back_populates="message")

class ConvMessageRead(Base):
    __tablename__="conv_message_reads"
    id=Column(Integer,primary_key=True,index=True); message_id=Column(Integer,ForeignKey("conv_messages.id"),nullable=False)
    user_id=Column(Integer,ForeignKey("users.id"),nullable=False)
    read_at=Column(DateTime(timezone=True),server_default=func.now())
    message=relationship("ConvMessage",back_populates="reads"); user=relationship("User")

# ═══ NOTIFICATIONS ═══
class Notification(Base):
    __tablename__="notifications"
    id=Column(Integer,primary_key=True,index=True)
    hotel_id=Column(Integer,ForeignKey("hotels.id"),nullable=True)
    user_id=Column(Integer,ForeignKey("users.id"),nullable=False)
    type=Column(String(50),nullable=False)
    title=Column(String(200),nullable=False)
    message=Column(Text,nullable=False)
    entity_type=Column(String(50),nullable=True)
    entity_id=Column(Integer,nullable=True)
    priority=Column(String(10),default="medium",nullable=False)
    is_read=Column(Boolean,default=False,nullable=False)
    read_at=Column(DateTime(timezone=True),nullable=True)
    created_at=Column(DateTime(timezone=True),server_default=func.now())
    user=relationship("User")

# ═══ RÉFÉRENTIELS MÉTIER V2 ═══

class TaskCategory(Base):
    __tablename__ = "task_categories"
    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)
    name = Column(String(100), nullable=False)
    code = Column(String(30), nullable=True)
    color = Column(String(7), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    hotel = relationship("Hotel")

class InterventionType(Base):
    __tablename__ = "intervention_types"
    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=False)
    name = Column(String(100), nullable=False)
    code = Column(String(30), nullable=True)
    default_priority = Column(String(10), default="normale")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    hotel = relationship("Hotel")

class NotificationPreference(Base):
    __tablename__ = "notification_preferences"
    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(String(50), nullable=False)
    enabled = Column(Boolean, default=True)
    channel = Column(String(20), default="app")
    priority = Column(String(10), default="medium")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    user = relationship("User")
