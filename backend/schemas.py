"""
Hotel OS — Schémas Pydantic (validation requêtes/réponses)
"""

from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "technicien"
    service: Optional[str] = None

class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    service: Optional[str]
    is_active: bool
    created_at: datetime
    class Config:
        from_attributes = True

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ── Room ──────────────────────────────────────────────────────────────────────

class RoomCreate(BaseModel):
    number: str
    floor: int = 1
    type: str = "standard"
    notes: Optional[str] = None

class RoomUpdate(BaseModel):
    number: Optional[str] = None
    status: Optional[str] = None
    is_available: Optional[bool] = None
    notes: Optional[str] = None
    floor: Optional[int] = None
    type: Optional[str] = None

class RoomOut(BaseModel):
    id: int
    number: str
    floor: int
    type: str
    status: str
    is_available: bool
    notes: Optional[str]
    last_cleaned: Optional[datetime]
    qr_token: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    class Config:
        from_attributes = True


# ── Task ──────────────────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "normale"
    service: Optional[str] = None
    due_date: Optional[datetime] = None
    room_id: Optional[int] = None
    assigned_to_id: Optional[int] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to_id: Optional[int] = None
    pause_reason: Optional[str] = None
    validation_note: Optional[str] = None

class TaskOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    status: str
    priority: str
    service: Optional[str]
    due_date: Optional[datetime]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    validated_at: Optional[datetime]
    pause_reason: Optional[str]
    validation_note: Optional[str]
    room_id: Optional[int]
    assigned_to_id: Optional[int]
    created_by_id: int
    created_at: datetime
    class Config:
        from_attributes = True


# ── Intervention ──────────────────────────────────────────────────────────────

class InterventionCreate(BaseModel):
    title: str
    description: Optional[str] = None
    zone: Optional[str] = None
    priority: str = "normale"
    source: str = "staff"
    room_id: Optional[int] = None
    photo_url: Optional[str] = None
    equipment_item_id: Optional[int] = None

class InterventionUpdate(BaseModel):
    status: Optional[str] = None
    taken_by_id: Optional[int] = None
    resolution_note: Optional[str] = None
    cost: Optional[float] = None
    priority: Optional[str] = None
    equipment_item_id: Optional[int] = None

class InterventionOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    zone: Optional[str]
    status: str
    priority: str
    source: str
    cost: float
    resolution_note: Optional[str]
    photo_url: Optional[str]
    room_id: Optional[int]
    taken_by_id: Optional[int]
    created_by_id: Optional[int]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    is_duplicate: bool = False
    duplicate_of_id: Optional[int] = None
    duplicate_reason: Optional[str] = None
    duplicate_marked_at: Optional[datetime] = None
    equipment_item_id: Optional[int] = None
    created_at: datetime
    class Config:
        from_attributes = True

class InterventionMarkDuplicate(BaseModel):
    duplicate_of_id: int
    duplicate_reason: Optional[str] = None

class InterventionClose(BaseModel):
    resolution_note: Optional[str] = None
    cost: Optional[float] = None


# ── Round ─────────────────────────────────────────────────────────────────────

class RoundRoomAdd(BaseModel):
    room_id: int
    order: int = 0

class RoundCreate(BaseModel):
    name: str
    date: datetime
    assigned_to_id: Optional[int] = None
    notes: Optional[str] = None
    rooms: List[RoundRoomAdd] = []

class RoundRoomUpdate(BaseModel):
    status: str
    note: Optional[str] = None

class RoundRoomOut(BaseModel):
    id: int
    order: int
    status: str
    note: Optional[str]
    completed_at: Optional[datetime]
    room_id: int
    class Config:
        from_attributes = True

class RoundOut(BaseModel):
    id: int
    name: str
    date: datetime
    status: str
    notes: Optional[str]
    assigned_to_id: Optional[int]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    rooms: List[RoundRoomOut] = []
    class Config:
        from_attributes = True


# ── Message LEGACY (remplacé par Conversations) — ne plus utiliser ────────────

class MessageCreate(BaseModel):
    content: str
    channel: str = "general"
    is_urgent: bool = False
    recipient_id: Optional[int] = None

class MessageOut(BaseModel):
    id: int
    content: str
    channel: str
    is_urgent: bool
    is_read: bool
    sender_id: int
    recipient_id: Optional[int]
    created_at: datetime
    class Config:
        from_attributes = True


# ── QR Checkout ───────────────────────────────────────────────────────────────

class QRScanPayload(BaseModel):
    token: str
    guest_name: Optional[str] = None
    guest_comment: Optional[str] = None

class QRCheckoutOut(BaseModel):
    id: int
    token: str
    scanned_at: Optional[datetime]
    guest_name: Optional[str]
    guest_comment: Optional[str]
    room_id: int
    created_at: datetime
    class Config:
        from_attributes = True


# ── Client Review ─────────────────────────────────────────────────────────────

class ReviewCreate(BaseModel):
    rating: int
    category: Optional[str] = None
    comment: Optional[str] = None
    guest_name: Optional[str] = None
    room_id: Optional[int] = None

class ReviewUpdate(BaseModel):
    status: Optional[str] = None
    action_taken: Optional[str] = None

class ReviewOut(BaseModel):
    id: int
    rating: int
    category: Optional[str]
    comment: Optional[str]
    guest_name: Optional[str]
    status: str
    action_taken: Optional[str]
    room_id: Optional[int]
    resolved_at: Optional[datetime]
    created_at: datetime
    class Config:
        from_attributes = True


# ── Equipment LEGACY (remplacé par V2 families/types/items) — ne plus utiliser ─

class EquipmentCreate(BaseModel):
    name: str
    category: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    location: Optional[str] = None
    room_id: Optional[int] = None
    notes: Optional[str] = None

class EquipmentUpdate(BaseModel):
    status: Optional[str] = None
    last_maintenance: Optional[datetime] = None
    next_maintenance: Optional[datetime] = None
    notes: Optional[str] = None

class EquipmentOut(BaseModel):
    id: int
    name: str
    category: Optional[str]
    brand: Optional[str]
    model: Optional[str]
    serial_number: Optional[str]
    location: Optional[str]
    status: str
    room_id: Optional[int]
    last_maintenance: Optional[datetime]
    next_maintenance: Optional[datetime]
    notes: Optional[str]
    created_at: datetime
    class Config:
        from_attributes = True


# ── Equipment V2 — Familles / Types / Items ─────────────────────────────────

class EquipmentFamilyOut(BaseModel):
    id: int
    code: str
    name: str
    sort_order: int
    class Config:
        from_attributes = True

class EquipmentTypeOut(BaseModel):
    id: int
    family_id: int
    code: str
    name: str
    is_active: bool
    class Config:
        from_attributes = True

class EquipmentItemCreate(BaseModel):
    family_id: int
    type_id: int
    room_id: Optional[int] = None
    zone_id: Optional[int] = None
    name: str
    asset_code: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    floor: Optional[str] = None
    status: str = "ok"
    notes: Optional[str] = None

class EquipmentItemUpdate(BaseModel):
    family_id: Optional[int] = None
    type_id: Optional[int] = None
    room_id: Optional[int] = None
    zone_id: Optional[int] = None
    name: Optional[str] = None
    asset_code: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    floor: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class EquipmentItemOut(BaseModel):
    id: int
    hotel_id: int
    family_id: int
    type_id: int
    room_id: Optional[int] = None
    zone_id: Optional[int] = None
    name: str
    asset_code: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    floor: Optional[str] = None
    status: str
    notes: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True


# ── Stock ─────────────────────────────────────────────────────────────────────

class StockItemCreate(BaseModel):
    name: str
    reference: Optional[str] = None
    category: Optional[str] = None
    unit: str = "unite"
    quantity: float = 0.0
    threshold_min: float = 5.0
    location: Optional[str] = None
    unit_cost: float = 0.0

class StockMovementCreate(BaseModel):
    item_id: int
    type: str                       # entree, sortie, inventaire
    quantity: float
    note: Optional[str] = None
    intervention_id: Optional[int] = None

class StockItemOut(BaseModel):
    id: int
    name: str
    reference: Optional[str]
    category: Optional[str]
    unit: str
    quantity: float
    threshold_min: float
    location: Optional[str]
    unit_cost: float
    created_at: datetime
    class Config:
        from_attributes = True

class StockMovementOut(BaseModel):
    id: int
    type: str
    quantity: float
    note: Optional[str]
    item_id: int
    intervention_id: Optional[int]
    user_id: Optional[int]
    created_at: datetime
    class Config:
        from_attributes = True


# ── Dashboard ─────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    rooms_total: int
    rooms_libre: int
    rooms_en_menage: int
    rooms_prete: int
    rooms_bloquee: int
    tasks_a_faire: int
    tasks_en_cours: int
    tasks_urgentes: int
    interventions_nouvelles: int
    interventions_en_cours: int
    reviews_nouveau: int
    reviews_avg_rating: float
    stock_alerts: int
    equipment_en_panne: int
    attendance_present: Optional[int] = 0
    attendance_absent: Optional[int] = 0
    attendance_late: Optional[int] = 0


# ── Notifications ────────────────────────────────────────────────────────────

class NotificationOut(BaseModel):
    id: int
    type: str
    title: str
    message: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    priority: str
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime
    class Config:
        from_attributes = True

class NotificationMarkRead(BaseModel):
    notification_ids: List[int]
