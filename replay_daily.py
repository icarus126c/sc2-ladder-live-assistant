"""Completed own production and credited enemy worker kills from tracker events."""
WORKERS = {"SCV", "Probe", "Drone", "DroneBurrowed"}
PRODUCTION = {"Zergling": "zerglings", "Zealot": "zealots"}


def analyze_tracker(events, self_id, opponents, expected_slots=None):
    if not isinstance(self_id, int) or self_id <= 0 or not opponents:
        raise ValueError("无法确认跟踪事件中的玩家身份")
    units, produced, dead, setup = {}, set(), set(), {}
    counts = {"zerglings": 0, "zealots": 0}
    kills, kills_complete, last_loop = 0, True, -1
    for event in events:
        loop = event.get("_gameloop")
        if not isinstance(loop, int) or loop < last_loop:
            raise ValueError("跟踪事件时间顺序异常")
        last_loop = loop
        kind = event.get("_event", "").split(".")[-1]
        if kind == "SPlayerSetupEvent":
            setup[event["m_playerId"]] = event.get("m_slotId")
            continue
        if kind not in {"SUnitBornEvent", "SUnitInitEvent", "SUnitDoneEvent", "SUnitTypeChangeEvent", "SUnitOwnerChangeEvent", "SUnitDiedEvent"}:
            continue
        tag = (event["m_unitTagIndex"], event["m_unitTagRecycle"])
        if kind in {"SUnitBornEvent", "SUnitInitEvent"}:
            unit_type = event["m_unitTypeName"]
            if isinstance(unit_type, bytes):
                unit_type = unit_type.decode("ascii")
            owner = event.get("m_controlPlayerId") or event.get("m_upkeepPlayerId", 0)
            units[tag] = {"type": unit_type, "owner": owner, "producer": owner, "complete": kind == "SUnitBornEvent", "initial": loop == 0 and unit_type in {"Zergling", "ZerglingBurrowed", "Zealot"}}
        elif kind == "SUnitDoneEvent":
            if tag not in units:
                raise ValueError("缺少单位建造起始事件")
            units[tag]["complete"] = True
        elif kind == "SUnitTypeChangeEvent":
            if tag not in units:
                raise ValueError("缺少单位变形前事件")
            name = event["m_unitTypeName"]
            units[tag]["type"] = name.decode("ascii") if isinstance(name, bytes) else name
        elif kind == "SUnitOwnerChangeEvent":
            if tag in units:
                units[tag]["owner"] = event.get("m_controlPlayerId") or event.get("m_upkeepPlayerId", 0)
            continue
        elif kind == "SUnitDiedEvent":
            if tag in dead:
                continue
            dead.add(tag)
            unit = units.get(tag)
            if unit is None:
                kills_complete = False
            elif unit["owner"] in opponents and unit["type"] in WORKERS:
                if "m_killerPlayerId" not in event:
                    kills_complete = False
                elif event["m_killerPlayerId"] == self_id:
                    kills += 1
            units.pop(tag, None)
            continue
        unit = units.get(tag)
        key = PRODUCTION.get(unit["type"]) if unit else None
        if key and unit["complete"] and not unit["initial"] and unit["producer"] == self_id and unit["owner"] == self_id and tag not in produced:
            counts[key] += 1
            produced.add(tag)
    if not {self_id, *opponents}.issubset(setup):
        raise ValueError("缺少玩家身份映射事件")
    if expected_slots and any(setup.get(pid) != slot for pid, slot in expected_slots.items()):
        raise ValueError("录像元数据与玩家槽位不一致")
    return {"version": 1, **counts, "workersKilled": kills if kills_complete else None, "status": "ready", "note": "" if kills_complete else "部分死亡事件缺少类型或击杀归属"}
