"""Conservative validation for newer VersionedDecoder tracker streams only."""
import re

STARTING_WORKERS = {"Terran": b"SCV", "Protoss": b"Probe", "Zerg": b"Drone"}


def guarded_tracker(events, expected_slots, races, elapsed_loops, content_size):
    if (len(expected_slots) != 2 or len(races) != 2
            or any(type(pid) is not int or not 1 <= pid <= 16 for pid in expected_slots)
            or any(type(slot) is not int or not 0 <= slot < 16 for slot in expected_slots.values())
            or len(set(expected_slots.values())) != 2
            or any(races.get(pid) not in STARTING_WORKERS for pid in expected_slots)
            or type(elapsed_loops) is not int or elapsed_loops <= 0):
        raise ValueError("缺少可校验的玩家身份、实际种族或录像时长")
    setup, stats, workers = {}, set(), set()
    bits, last_loop = 0, -1
    for event in events:
        loop, used = event.get("_gameloop"), event.get("_bits")
        if (type(loop) is not int or loop < 0 or loop < last_loop or loop > elapsed_loops
                or type(used) is not int or used <= 0):
            raise ValueError("单位事件时间或长度异常")
        last_loop, bits = loop, bits + used
        kind = event.get("_event", "").split(".")[-1]
        if kind == "SPlayerSetupEvent":
            pid, slot = event.get("m_playerId"), event.get("m_slotId")
            if type(pid) is not int or type(slot) is not int or expected_slots.get(pid) != slot:
                raise ValueError("单位事件与录像玩家槽位不一致")
            if pid in setup and setup[pid] != slot:
                raise ValueError("玩家身份映射发生变化")
            setup[pid] = slot
        elif kind == "SPlayerStatsEvent":
            pid = event.get("m_playerId")
            if pid not in expected_slots or not isinstance(event.get("m_stats"), dict):
                raise ValueError("玩家统计字段不兼容")
            stats.add(pid)
        elif kind in ("SUnitBornEvent", "SUnitInitEvent", "SUnitTypeChangeEvent"):
            name = event.get("m_unitTypeName")
            if not isinstance(name, bytes) or not re.fullmatch(rb"[A-Za-z][A-Za-z0-9_]{0,127}", name):
                raise ValueError("单位类型字段不兼容")
            if kind != "SUnitTypeChangeEvent":
                for key in ("m_controlPlayerId", "m_upkeepPlayerId"):
                    if type(event.get(key)) is not int or not 0 <= event[key] <= 16:
                        raise ValueError("单位归属字段不兼容")
                pid = event["m_controlPlayerId"] or event["m_upkeepPlayerId"]
                if loop == 0 and pid in races and name == STARTING_WORKERS[races[pid]]:
                    workers.add(pid)
        if kind in ("SUnitBornEvent", "SUnitInitEvent", "SUnitTypeChangeEvent",
                    "SUnitDoneEvent", "SUnitDiedEvent", "SUnitOwnerChangeEvent"):
            for key in ("m_unitTagIndex", "m_unitTagRecycle"):
                if type(event.get(key)) is not int or not 0 <= event[key] < 2 ** 32:
                    raise ValueError("单位标识字段不兼容")
        yield event
    if (set(setup) != set(expected_slots) or stats != set(expected_slots)
            or workers != set(expected_slots)):
        raise ValueError("缺少双方身份、初始单位或统计事件")
    if bits != content_size * 8 or elapsed_loops - last_loop > 64:
        raise ValueError("单位事件流未完整覆盖录像结尾")
