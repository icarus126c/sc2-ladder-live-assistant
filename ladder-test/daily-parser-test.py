import os,sys,unittest
sys.path.insert(0,os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from replay_daily import analyze_tracker
def event(kind,tag=None,loop=1,**fields):
    out={"_event":"NNet.Replay.Tracker."+kind,"_gameloop":loop,**fields}
    if tag is not None: out.update(m_unitTagIndex=tag[0],m_unitTagRecycle=tag[1])
    return out
def setup(): return [event("SPlayerSetupEvent",loop=0,m_playerId=1,m_slotId=0),event("SPlayerSetupEvent",loop=0,m_playerId=2,m_slotId=1)]
def born(i,name,owner=1,kind="SUnitBornEvent",loop=1): return event(kind,(i,1),loop,m_unitTypeName=name.encode(),m_controlPlayerId=owner,m_upkeepPlayerId=owner)
def died(i,killer=1): return event("SUnitDiedEvent",(i,1),m_killerPlayerId=killer)
class TrackerTests(unittest.TestCase):
    def test_own_completed_production_morph_and_cancel(self):
        events=setup()+[born(1,"Larva",loop=0),event("SUnitTypeChangeEvent",(1,1),m_unitTypeName=b"Egg"),event("SUnitTypeChangeEvent",(1,1),m_unitTypeName=b"Zergling"),event("SUnitTypeChangeEvent",(1,1),m_unitTypeName=b"ZerglingBurrowed"),event("SUnitTypeChangeEvent",(1,1),m_unitTypeName=b"Zergling"),born(2,"Zergling"),born(3,"Zergling",2),born(4,"Zealot",kind="SUnitInitEvent"),died(4,2),born(5,"Zealot",kind="SUnitInitEvent"),event("SUnitDoneEvent",(5,1)),event("SUnitDoneEvent",(5,1)),born(6,"Zealot",2),event("SUnitOwnerChangeEvent",(6,1),m_controlPlayerId=1,m_upkeepPlayerId=1)]
        result=analyze_tracker(events,1,{2},{1:0,2:1})
        self.assertEqual(result["zerglings"],2);self.assertEqual(result["zealots"],1)
    def test_enemy_workers_only_credited_to_self_and_tag_recycling(self):
        events=setup()+[born(1,"SCV",2),died(1),died(1),born(2,"Probe",2),died(2,2),born(3,"DroneBurrowed",2),died(3),born(4,"SCV",1),died(4),born(5,"MULE",2),died(5),born(6,"Drone",2),event("SUnitTypeChangeEvent",(6,1),m_unitTypeName=b"Hatchery"),died(6),event("SUnitBornEvent",(1,2),m_unitTypeName=b"SCV",m_controlPlayerId=2),event("SUnitDiedEvent",(1,2),m_killerPlayerId=1)]
        self.assertEqual(analyze_tracker(events,1,{2})["workersKilled"],3)
    def test_missing_kill_credit_is_unknown_and_identity_is_required(self):
        r=analyze_tracker(setup()+[born(1,"SCV",2),event("SUnitDiedEvent",(1,1))],1,{2})
        self.assertIsNone(r["workersKilled"])
        with self.assertRaises(ValueError): analyze_tracker(setup(),1,{2},{1:1,2:0})
        with self.assertRaises(ValueError): analyze_tracker([],1,{2})
if __name__=="__main__": unittest.main()
