import importlib.util,os,sys,unittest
from unittest.mock import patch
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)));sys.path.insert(0,root)
spec=importlib.util.spec_from_file_location('replay_parser',os.path.join(root,'parse-sc2-replay.py'))
parser=importlib.util.module_from_spec(spec);spec.loader.exec_module(parser)
import replay_protocol98310 as protocol

class ForwardTrackerTests(unittest.TestCase):
    def setUp(self):
        self.file=os.path.join(root,'ladder-test','fixtures','iaguz-luneth-4.7.1.SC2Replay')
        archive=parser.MPQArchive(self.file);self.raw=parser.read_contents(archive,'replay.tracker.events')
        self.events=list(protocol.decode_replay_tracker_events(self.raw))
        header=parser.latest().decode_replay_header(archive.header['user_data_header']['content']);self.loops=header['m_elapsedGameLoops']
        self.exact,self.build=parser.load_protocol(archive)
        self.original=parser.parse_replay(self.file,{'names':['iaguz']})
        self.slots={p['trackerPlayerId']:p['slot']-1 for p in self.original['players']}
        self.races={p['trackerPlayerId']:p['race'] for p in self.original['players']}

    def guarded(self,events,slots=None,loops=None,size=None):
        return list(parser.guarded_tracker(iter(events),self.slots if slots is None else slots,self.races,self.loops if loops is None else loops,len(self.raw) if size is None else size))

    def test_compatible_new_build_reads_real_tracker_stream_with_same_statistics(self):
        # Simulate a new build number over real compatible bytes; no future build is claimed tested.
        with patch.object(parser,'load_protocol',return_value=(self.exact,99999)):
            parsed=parser.parse_replay(self.file,{'names':['iaguz']})
        for key in ('zerglings','zealots','workersKilled','status'):self.assertEqual(parsed['dailyMetrics'][key],self.original['dailyMetrics'][key])
        self.assertEqual(parsed['dailyMetrics']['decoder'],'guarded-99999-via-98310')
        self.assertEqual(parsed['selfResult'],self.original['selfResult'])

    def test_corrupt_or_truncated_stream_keeps_result_and_marks_units_unavailable(self):
        for contents in (self.raw[:-1],self.raw+b'\xff'):
            original_read=parser.read_contents
            def read(archive,name):return contents if name=='replay.tracker.events' else original_read(archive,name)
            with patch.object(parser,'load_protocol',return_value=(self.exact,99999)),patch.object(parser,'read_contents',side_effect=read):
                parsed=parser.parse_replay(self.file,{'names':['iaguz']})
            self.assertIsNone(parsed['dailyMetrics']['zealots']);self.assertEqual(parsed['dailyMetrics']['status'],'unavailable')
            self.assertIn('兼容校验未通过',parsed['dailyMetrics']['note']);self.assertEqual(parsed['selfResult'],self.original['selfResult'])

    def test_identity_starting_units_and_stats_are_required(self):
        for kind in ('SPlayerSetupEvent','SPlayerStatsEvent','SUnitBornEvent'):
            filtered=[e for e in self.events if not e['_event'].endswith(kind)]
            with self.assertRaises(ValueError):self.guarded(filtered)
        wrong={pid:slot+1 for pid,slot in self.slots.items()}
        with self.assertRaises(ValueError):self.guarded(self.events,slots=wrong)

    def test_time_order_bounds_complete_consumption_and_end_coverage(self):
        bad=dict(self.events[-1],_gameloop=self.loops+1)
        with self.assertRaises(ValueError):self.guarded(self.events[:-1]+[bad])
        with self.assertRaises(ValueError):self.guarded(self.events[::-1])
        with self.assertRaises(ValueError):self.guarded(self.events,size=len(self.raw)+1)
        with self.assertRaises(ValueError):self.guarded(self.events,loops=self.loops+1000)

    def test_unknown_event_id_and_incompatible_unit_types_fail(self):
        with self.assertRaises(Exception):list(protocol.decode_replay_tracker_events(self.raw+b'\xff'))
        born=next(i for i,e in enumerate(self.events) if e['_event'].endswith('SUnitBornEvent'))
        changed=self.events[:];changed[born]={**changed[born],'m_unitTypeName':b'\xff'}
        with self.assertRaisesRegex(ValueError,'单位类型字段'):self.guarded(changed)

if __name__=='__main__':unittest.main()
