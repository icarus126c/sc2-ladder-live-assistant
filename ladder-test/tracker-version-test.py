import hashlib,importlib.util,os,sys,unittest
from unittest.mock import patch
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)));sys.path.insert(0,root)
spec=importlib.util.spec_from_file_location('replay_parser',os.path.join(root,'parse-sc2-replay.py'))
parser=importlib.util.module_from_spec(spec);spec.loader.exec_module(parser)
import replay_protocol98310

class TrackerVersionTests(unittest.TestCase):
    def test_exact_protocol_always_wins(self):
        exact=object()
        with patch.object(parser,'build',return_value=exact):self.assertEqual(parser.load_tracker_protocol(98370),(exact,None))

    def test_verified_aliases_and_newer_version_candidates(self):
        old=object()
        def build(number):
            if number==95299:return old
            raise ImportError('missing protocol')
        with patch.object(parser,'build',side_effect=build):
            self.assertEqual(parser.load_tracker_protocol(97579),(old,'compatible-97579'))
            self.assertEqual(parser.load_tracker_protocol(98310),(replay_protocol98310,None))
            self.assertEqual(parser.load_tracker_protocol(98370),(replay_protocol98310,'compatible-98370-via-98310'))
            self.assertEqual(parser.load_tracker_protocol(99999),(replay_protocol98310,'guarded-99999-via-98310'))
            with self.assertRaisesRegex(ValueError,'暂不支持版本 90000'):parser.load_tracker_protocol(90000)

    def test_vendored_schema_is_unmodified_official_source(self):
        with open(os.path.join(root,'replay_protocol98310.py'),'rb') as f:self.assertEqual(hashlib.sha256(f.read()).hexdigest(),'2941e39e970c21bfa7bb9c5c6d340c09366a5743f223b516fe19443f67c578e5')

    def test_tracker_schema_decodes_real_public_replay_with_matching_player_slots(self):
        file=os.path.join(root,'ladder-test','fixtures','iaguz-luneth-4.7.1.SC2Replay');archive=parser.MPQArchive(file)
        parsed=parser.parse_replay(file,{'names':['iaguz'],'metadataOnly':True});own=parsed['selfPlayers'][0]['trackerPlayerId'];enemy=parsed['opponents'][0]['trackerPlayerId'];expected={p['trackerPlayerId']:p['slot']-1 for p in parsed['players']}
        metrics=parser.analyze_tracker(replay_protocol98310.decode_replay_tracker_events(parser.read_contents(archive,'replay.tracker.events')),own,{enemy},expected)
        self.assertEqual(metrics['status'],'ready');self.assertEqual(metrics['zerglings'],4);self.assertEqual(metrics['workersKilled'],12)

if __name__=='__main__':unittest.main()
