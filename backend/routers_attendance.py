"""Hotel OS — Présence"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone, date
from typing import List, Optional
from pydantic import BaseModel
from .database import get_db
from . import models
from .auth import get_current_user, require_roles
from .notifications import notify_role

LATE_TOL=10
attendance_router=APIRouter(prefix="/attendance",tags=["Présence"])
class ActReq(BaseModel):
    action:str; notes:Optional[str]=None
class MgrReq(BaseModel):
    user_id:int; action:str; status:Optional[str]=None; notes:Optional[str]=None
class StatsOut(BaseModel):
    total:int; present:int; absent:int; late:int; on_break:int; finished:int; scheduled:int
class EvtOut(BaseModel):
    id:int; shift_id:int; user_id:int; event_type:str; event_time:datetime; notes:Optional[str]
    class Config: from_attributes=True

def _td(): return date.today().isoformat()
def _gs(db,u):
    s=db.query(models.AttendanceShift).filter(models.AttendanceShift.user_id==u.id,models.AttendanceShift.shift_date==_td()).first()
    if not s:
        s=models.AttendanceShift(user_id=u.id,hotel_id=getattr(u,"hotel_id",None),service=u.service,shift_date=_td(),scheduled_start="08:00",scheduled_end="17:00",status="scheduled")
        db.add(s); db.flush()
    return s
def _o(s,u=None):
    d={"id":s.id,"user_id":s.user_id,"service":s.service,"shift_date":s.shift_date,"scheduled_start":s.scheduled_start,"scheduled_end":s.scheduled_end,"actual_start":s.actual_start,"actual_end":s.actual_end,"status":s.status,"late_minutes":s.late_minutes or 0,"notes":s.notes,"created_at":s.created_at,"updated_at":s.updated_at}
    if u: d["user_name"]=u.name; d["user_role"]=u.role
    elif hasattr(s,"user") and s.user: d["user_name"]=s.user.name; d["user_role"]=s.user.role
    return d

@attendance_router.get("/my-shift")
def my_shift(db:Session=Depends(get_db),me:models.User=Depends(get_current_user)):
    s=_gs(db,me); db.commit(); return _o(s,me)
@attendance_router.post("/my-shift/action")
def act(d:ActReq,db:Session=Depends(get_db),me:models.User=Depends(get_current_user)):
    s=_gs(db,me); now=datetime.now(timezone.utc); a=d.action
    if a=="clock_in":
        if s.status!="scheduled": raise HTTPException(400,"Poste déjà pris")
        s.actual_start=now
        if s.scheduled_start:
            h,m=map(int,s.scheduled_start.split(":")); sc=now.replace(hour=h,minute=m,second=0,microsecond=0); df=(now-sc).total_seconds()/60
            if df>LATE_TOL: s.status="late"; s.late_minutes=int(df)
            else: s.status="present"; s.late_minutes=max(0,int(df))
        else: s.status="present"
        # Notify managers if late
        if s.status=="late":
            notify_role(db,"responsable",hotel_id=getattr(me,"hotel_id",None),
                        type="attendance_late",title="Retard constaté",
                        message=me.name+" est en retard de "+str(s.late_minutes)+" min",
                        entity_type="attendance",entity_id=s.id,priority="medium",
                        exclude_user_id=me.id)
            notify_role(db,"direction",hotel_id=getattr(me,"hotel_id",None),
                        type="attendance_late",title="Retard constaté",
                        message=me.name+" est en retard de "+str(s.late_minutes)+" min",
                        entity_type="attendance",entity_id=s.id,priority="medium",
                        exclude_user_id=me.id)
    elif a=="break_start":
        if s.status not in("present","late"): raise HTTPException(400,"Pas en poste"); s.status="on_break"
    elif a=="break_end":
        if s.status!="on_break": raise HTTPException(400,"Pas en pause"); s.status="present"
    elif a=="clock_out":
        if s.status in("scheduled","finished","absent"): raise HTTPException(400,"Impossible"); s.actual_end=now; s.status="finished"
    else: raise HTTPException(400,f"Action: {a}")
    db.add(models.AttendanceEvent(shift_id=s.id,user_id=me.id,event_type=a,event_time=now,notes=d.notes))
    db.commit(); db.refresh(s); return _o(s,me)
@attendance_router.get("/my-shift/events",response_model=List[EvtOut])
def evts(db:Session=Depends(get_db),me:models.User=Depends(get_current_user)):
    s=db.query(models.AttendanceShift).filter(models.AttendanceShift.user_id==me.id,models.AttendanceShift.shift_date==_td()).first()
    return s.events if s else []
@attendance_router.get("/team")
def team(service:Optional[str]=None,status:Optional[str]=None,db:Session=Depends(get_db),me:models.User=Depends(require_roles("responsable","responsable_technique","direction","gouvernante"))):
    uq=db.query(models.User).filter(models.User.is_active==True)
    if me.role=="responsable" and me.service: uq=uq.filter(models.User.service==me.service)
    res=[]
    for u in uq.all():
        s=db.query(models.AttendanceShift).filter(models.AttendanceShift.user_id==u.id,models.AttendanceShift.shift_date==_td()).first()
        if not s: s=models.AttendanceShift(user_id=u.id,hotel_id=getattr(u,"hotel_id",None),service=u.service,shift_date=_td(),scheduled_start="08:00",scheduled_end="17:00",status="scheduled"); db.add(s)
        if status and s.status!=status: continue
        res.append(_o(s,u))
    db.commit(); return res
@attendance_router.post("/team/action")
def mgr(d:MgrReq,db:Session=Depends(get_db),me:models.User=Depends(require_roles("responsable","responsable_technique","direction","gouvernante"))):
    u=db.query(models.User).filter(models.User.id==d.user_id).first()
    if not u: raise HTTPException(404,"Introuvable")
    s=_gs(db,u); now=datetime.now(timezone.utc)
    if d.action=="mark_absent": s.status="absent"; s.notes=d.notes or"Absence"; et="absence_declared"
    elif d.action=="correct_status":
        if not d.status: raise HTTPException(400,"Statut requis"); s.status=d.status; s.notes=d.notes if d.notes else s.notes; et="status_corrected"
    else: raise HTTPException(400,f"Action: {d.action}")
    db.add(models.AttendanceEvent(shift_id=s.id,user_id=me.id,event_type=et,event_time=now,notes=d.notes))
    # Notify the concerned user
    from .notifications import notify
    if d.action=="mark_absent":
        notify(db,hotel_id=getattr(me,"hotel_id",None),user_id=u.id,
               type="attendance_missing",title="Absence enregistrée",
               message="Vous avez été marqué absent par "+me.name,
               entity_type="attendance",entity_id=s.id,priority="high")
    db.commit(); db.refresh(s); return _o(s,u)
@attendance_router.get("/stats",response_model=StatsOut)
def stats(db:Session=Depends(get_db),_:models.User=Depends(get_current_user)):
    sh=db.query(models.AttendanceShift).filter(models.AttendanceShift.shift_date==_td()).all()
    r={"total":len(sh),"present":0,"absent":0,"late":0,"on_break":0,"finished":0,"scheduled":0}
    for s in sh:
        if s.status in r: r[s.status]+=1
    return r
