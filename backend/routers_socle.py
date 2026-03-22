"""Hotel OS — Socle"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from .database import get_db
from . import models
from .auth import get_current_user, require_roles
from pydantic import BaseModel
from datetime import datetime

class HotelOut(BaseModel):
    id:int; name:str; code:str; address:Optional[str]; city:Optional[str]; country:str
    phone:Optional[str]; email:Optional[str]; is_active:bool; created_at:datetime
    class Config: from_attributes=True
class HotelCreate(BaseModel):
    name:str; code:str; address:Optional[str]=None; city:Optional[str]=None; country:str="France"
    phone:Optional[str]=None; email:Optional[str]=None
class ZoneOut(BaseModel):
    id:int; name:str; code:Optional[str]; hotel_id:int; is_active:bool; created_at:datetime
    class Config: from_attributes=True
class ZoneCreate(BaseModel):
    name:str; code:Optional[str]=None; hotel_id:int
class ServiceOut(BaseModel):
    id:int; name:str; code:str; hotel_id:int; color:Optional[str]; icon:Optional[str]; is_active:bool
    class Config: from_attributes=True
class AuditOut(BaseModel):
    id:int; user_id:Optional[int]; action:str; entity_type:Optional[str]; detail:Optional[str]; created_at:datetime
    class Config: from_attributes=True

def log_audit(db,uid=None,hid=None,action="",etype=None,eid=None,detail=None):
    db.add(models.AuditLog(user_id=uid,hotel_id=hid,action=action,entity_type=etype,entity_id=eid,detail=detail))

hotels_router=APIRouter(prefix="/hotels",tags=["Hôtels"])
@hotels_router.get("",response_model=List[HotelOut])
def list_hotels(db:Session=Depends(get_db),_:models.User=Depends(get_current_user)):
    return db.query(models.Hotel).filter(models.Hotel.is_active==True).order_by(models.Hotel.name).all()
@hotels_router.post("/",response_model=HotelOut,status_code=201)
def create_hotel(d:HotelCreate,db:Session=Depends(get_db),me:models.User=Depends(require_roles("direction"))):
    h=models.Hotel(**d.model_dump()); db.add(h); db.flush()
    log_audit(db,me.id,h.id,"create","hotel",h.id); db.commit(); db.refresh(h); return h

class ZoneUpdate(BaseModel):
    name:Optional[str]=None; code:Optional[str]=None; is_active:Optional[bool]=None

zones_router=APIRouter(prefix="/zones",tags=["Zones"])
@zones_router.get("",response_model=List[ZoneOut])
def list_zones(hotel_id:Optional[int]=None,db:Session=Depends(get_db),_:models.User=Depends(get_current_user)):
    q=db.query(models.Zone)
    if hotel_id: q=q.filter(models.Zone.hotel_id==hotel_id)
    return q.order_by(models.Zone.name).all()
@zones_router.post("",response_model=ZoneOut,status_code=201)
def create_zone(d:ZoneCreate,db:Session=Depends(get_db),me:models.User=Depends(require_roles("responsable","responsable_technique","direction"))):
    z=models.Zone(**d.model_dump()); db.add(z); db.flush()
    log_audit(db,me.id,d.hotel_id,"create","zone",z.id); db.commit(); db.refresh(z); return z
@zones_router.patch("/{zone_id}",response_model=ZoneOut)
def update_zone(zone_id:int,d:ZoneUpdate,db:Session=Depends(get_db),me:models.User=Depends(require_roles("responsable","responsable_technique","direction"))):
    z=db.query(models.Zone).filter(models.Zone.id==zone_id).first()
    if not z: raise HTTPException(404,"Zone introuvable")
    for k,v in d.model_dump(exclude_none=True).items(): setattr(z,k,v)
    db.commit(); db.refresh(z); return z
@zones_router.delete("/{zone_id}",status_code=204)
def delete_zone(zone_id:int,db:Session=Depends(get_db),me:models.User=Depends(require_roles("responsable","responsable_technique","direction"))):
    z=db.query(models.Zone).filter(models.Zone.id==zone_id).first()
    if not z: raise HTTPException(404,"Zone introuvable")
    db.delete(z); db.commit()

services_router=APIRouter(prefix="/services",tags=["Services"])
@services_router.get("",response_model=List[ServiceOut])
def list_services(hotel_id:Optional[int]=None,db:Session=Depends(get_db),_:models.User=Depends(get_current_user)):
    q=db.query(models.Service)
    if hotel_id: q=q.filter(models.Service.hotel_id==hotel_id)
    return q.order_by(models.Service.name).all()

audit_router=APIRouter(prefix="/audit",tags=["Journal"])
@audit_router.get("",response_model=List[AuditOut])
def list_audit(limit:int=100,db:Session=Depends(get_db),_:models.User=Depends(require_roles("responsable","direction"))):
    return db.query(models.AuditLog).order_by(models.AuditLog.created_at.desc()).limit(limit).all()
