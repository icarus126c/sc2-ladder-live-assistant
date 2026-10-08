import html
import importlib.machinery
import importlib.util
import json
import os
import re
import sys
import types


def install_imp_shim():
    shim = types.ModuleType("imp")

    def find_module(name, path=None):
        spec = importlib.machinery.PathFinder.find_spec(name, path)
        if not spec or not spec.loader:
            raise ImportError(name)
        return None, spec.origin, ("", "r", 1)

    def load_module(name, _fp, pathname, _description):
        if name in sys.modules:
            return sys.modules[name]
        spec = importlib.util.spec_from_file_location(name, pathname)
        module = importlib.util.module_from_spec(spec)
        sys.modules[name] = module
        spec.loader.exec_module(module)
        return module

    shim.find_module = find_module
    shim.load_module = load_module
    sys.modules["imp"] = shim


install_imp_shim()

from mpyq import MPQArchive
from s2protocol.versions import build, latest
from s2protocol.s2_cli import read_contents
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from replay_daily import analyze_tracker


RESULTS = {
    1: "Win",
    2: "Loss",
    3: "Tie",
}


def clean_text(value):
    if isinstance(value, bytes):
        value = value.decode("utf-8", errors="replace")
    value = html.unescape(str(value))
    value = value.replace("<sp/>", " ")
    return re.sub(r"\s+", " ", value).strip()


def normalize_race(value):
    text = clean_text(value)
    mapping = {
        "星灵": "Protoss",
        "异虫": "Zerg",
        "人类": "Terran",
        "Prot": "Protoss",
        "Zerg": "Zerg",
        "Terr": "Terran",
        "Rand": "Random",
        "随机": "Random",
    }
    return mapping.get(text, text)


def player_races(player, meta):
    selected = normalize_race(meta.get("SelectedRace") or player.get("m_race") or "")
    assigned = normalize_race(meta.get("AssignedRace") or "")
    detailed = normalize_race(player.get("m_race") or "")
    # SelectedRace is the lobby choice. Random must count against the race played.
    actual = next((race for race in (assigned, detailed, selected)
                   if race in ("Terran", "Protoss", "Zerg")), selected)
    return selected, actual


def load_protocol(archive):
    header = latest().decode_replay_header(archive.header["user_data_header"]["content"])
    base_build = header["m_version"]["m_baseBuild"]
    try:
        return build(base_build), base_build
    except Exception:
        # Details and gamemetadata have remained compatible in current retail builds.
        # Init data is bit-packed and must never be decoded with a mismatched schema.
        return latest(), base_build


def parse_replay(replay_path, config):
    archive = MPQArchive(replay_path)
    protocol, base_build = load_protocol(archive)
    details = protocol.decode_replay_details(read_contents(archive, "replay.details"))
    metadata = {}
    try:
        metadata = json.loads(read_contents(archive, "replay.gamemetadata.json"))
    except Exception:
        metadata = {}

    meta_players = metadata.get("Players") or []
    players = []
    for index, player in enumerate(details.get("m_playerList", []), start=1):
        meta = meta_players[index - 1] if index - 1 < len(meta_players) else {}
        toon = player.get("m_toon") or {}
        result = meta.get("Result") or RESULTS.get(player.get("m_result"), "Unknown")
        selected_race, actual_race = player_races(player, meta)
        players.append(
            {
                "slot": index,
                "trackerPlayerId": meta.get("PlayerID"),
                "name": clean_text(player.get("m_name", "")),
                "toonId": toon.get("m_id"),
                "region": toon.get("m_region"),
                "realm": toon.get("m_realm"),
                "teamId": player.get("m_teamId"),
                "result": result,
                "race": actual_race,
                "selectedRace": selected_race,
                "mmr": meta.get("MMR"),
                "apm": meta.get("APM"),
                "human": player.get("m_control") == 2,
                "toonHandle": f"{toon.get('m_region')}-S2-{toon.get('m_realm')}-{toon.get('m_id')}",
            }
        )

    folder_toon_id = infer_toon_id_from_path(replay_path)
    folder_match = re.search(r"[\\/](\d+-S2-\d+-\d+)[\\/]Replays[\\/]", replay_path, re.IGNORECASE)
    handle = config.get("toonHandle") or (folder_match.group(1) if folder_match and not config.get("names") else "")
    def plain_name(value):
        return re.sub(r"^<[^>]+>\s*", "", clean_text(value))
    self_names = {plain_name(item) for item in config.get("names", []) if str(item).strip()}

    for player in players:
        player["isSelf"] = player["toonHandle"] == handle if handle else plain_name(player["name"]) in self_names

    self_players = [player for player in players if player.get("isSelf")]
    self_team_ids = {player.get("teamId") for player in self_players}
    opponents = [player for player in players if player.get("teamId") not in self_team_ids] if self_players else []

    self_result = None
    if self_players:
        first_result = self_players[0].get("result")
        if first_result == "Win":
            self_result = "W"
        elif first_result == "Loss":
            self_result = "L"

    daily_metrics = {"version": 1, "zerglings": None, "zealots": None, "workersKilled": None, "status": "unavailable", "note": "尚未确认本机玩家"}
    if not config.get("metadataOnly") and len(self_players) == 1 and len(opponents) == 1 and len(players) == 2:
        try:
            try:
                tracker_protocol = build(base_build)
                compatible = False
            except Exception:
                # Versioned tracker schema verified against local retail 97579 replays.
                # Never decode unknown bit-packed init/game events with this fallback.
                if base_build != 97579:
                    raise ValueError(f"暂不支持版本 {base_build} 的单位跟踪统计")
                tracker_protocol, compatible = build(95299), True
            own_id = self_players[0].get("trackerPlayerId")
            enemy_id = opponents[0].get("trackerPlayerId")
            expected = {p["trackerPlayerId"]: p["slot"] - 1 for p in players if isinstance(p.get("trackerPlayerId"), int)}
            daily_metrics = analyze_tracker(tracker_protocol.decode_replay_tracker_events(read_contents(archive, "replay.tracker.events")), own_id, {enemy_id}, expected)
            if compatible:
                daily_metrics["decoder"] = "compatible-97579"
        except Exception as error:
            daily_metrics["note"] = str(error)[:180]

    map_name = metadata.get("Title") or clean_text(details.get("m_title") or os.path.basename(replay_path))
    duration = metadata.get("Duration")
    output = {
        "ok": True,
        "path": replay_path,
        "map": map_name,
        "durationSeconds": duration,
        "baseBuild": base_build,
        "gameVersion": metadata.get("GameVersion"),
        "folderToonId": folder_toon_id,
        "at": round((details.get("m_timeUTC", 116444736000000000) - 116444736000000000) / 10000),
        "players": players,
        "selfPlayers": self_players,
        "opponents": opponents,
        "selfResult": self_result,
        "dailyMetrics": daily_metrics,
        "format": format_match(self_players, opponents, map_name, duration),
    }
    return output


def format_match(self_players, opponents, map_name, duration):
    if not self_players:
        return f"{map_name}：未识别本机玩家"
    result = self_players[0].get("result", "Unknown")
    self_mmr = "/".join(format_number(player.get("mmr")) for player in self_players)
    opponent_names = " / ".join(player.get("name", "对手") for player in opponents) or "对手"
    opponent_mmr = "/".join(format_number(player.get("mmr")) for player in opponents) if opponents else "--"
    minutes = ""
    if isinstance(duration, (int, float)):
        minutes = f" {int(duration // 60)}:{int(duration % 60):02d}"
    return f"{map_name}{minutes} {result} 自己MMR {self_mmr} 对手 {opponent_names}({opponent_mmr})"


def format_number(value):
    return "--" if value is None else str(value)


def infer_toon_id_from_path(replay_path):
    match = re.search(r"[\\/]\d+-S2-\d+-(\d+)[\\/]Replays[\\/]", replay_path, re.IGNORECASE)
    return int(match.group(1)) if match else None


def main():
    replay_path = sys.argv[1]
    config = {}
    if len(sys.argv) > 2 and sys.argv[2] == "--stdin":
        config = json.load(sys.stdin)
    elif len(sys.argv) > 2 and os.path.exists(sys.argv[2]):
        with open(sys.argv[2], "r", encoding="utf-8-sig") as handle:
            config = json.load(handle)
    try:
        print(json.dumps(parse_replay(replay_path, config), ensure_ascii=False))
    except Exception as error:
        print(json.dumps({"ok": False, "error": str(error), "path": replay_path}, ensure_ascii=False))
        sys.exit(2)


if __name__ == "__main__":
    main()
