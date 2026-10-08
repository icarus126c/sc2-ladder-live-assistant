import importlib.util,json,os,sys,unittest
from unittest.mock import patch
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)));sys.path.insert(0,root)
spec=importlib.util.spec_from_file_location('replay_parser',os.path.join(root,'parse-sc2-replay.py'))
parser=importlib.util.module_from_spec(spec);spec.loader.exec_module(parser)

class RandomRaceTests(unittest.TestCase):
    def test_random_uses_assigned_race_for_each_race(self):
        for short,full,localized in [('Terr','Terran','人类'),('Prot','Protoss','星灵'),('Zerg','Zerg','异虫')]:
            with self.subTest(race=full):self.assertEqual(parser.player_races({'m_race':localized.encode()},{'SelectedRace':'Rand','AssignedRace':short}),('Random',full))

    def test_missing_or_unknown_assigned_race_uses_actual_details(self):
        for meta in [{'SelectedRace':'Rand'},{'SelectedRace':'Rand','AssignedRace':'Unknown'},{'SelectedRace':'Rand','AssignedRace':'Rand'}]:
            self.assertEqual(parser.player_races({'m_race':b'Protoss'},meta),('Random','Protoss'))
        self.assertEqual(parser.player_races({'m_race':b'Rand'},{'SelectedRace':'Rand'}),('Random','Random'))
        self.assertEqual(parser.player_races({'m_race':b''},{'SelectedRace':'Terr'}),('Terran','Terran'))
        self.assertEqual(parser.player_races({'m_race':b'Rand'},{'SelectedRace':'Rand','AssignedRace':'Zerg'}),('Random','Zerg'))

    def test_parse_output_retains_random_selection_but_exposes_played_race(self):
        class Protocol:
            def decode_replay_details(self,unused):return {'m_timeUTC':116444736000000000+100000000,'m_playerList':[
                {'m_name':b'Me','m_toon':{'m_region':5,'m_realm':1,'m_id':1},'m_control':2,'m_teamId':0,'m_race':b'Protoss','m_result':1},
                {'m_name':b'Other','m_toon':{'m_region':5,'m_realm':1,'m_id':2},'m_control':2,'m_teamId':1,'m_race':b'Terran','m_result':2}]}
        metadata={'Players':[{'SelectedRace':'Rand','AssignedRace':'Prot','Result':'Win'},{'SelectedRace':'Rand','AssignedRace':'Terr','Result':'Loss'}],'Title':'Map','Duration':600}
        with patch.object(parser,'MPQArchive',return_value=object()),patch.object(parser,'load_protocol',return_value=(Protocol(),97579)),patch.object(parser,'read_contents',side_effect=lambda archive,name:json.dumps(metadata) if name.endswith('.json') else b''):
            result=parser.parse_replay('fixture.SC2Replay',{'toonHandle':'5-S2-1-1','metadataOnly':True})
        self.assertEqual(result['selfResult'],'W');self.assertEqual(result['selfPlayers'][0]['race'],'Protoss');self.assertEqual(result['opponents'][0]['race'],'Terran')
        self.assertTrue(all(p['selectedRace']=='Random' for p in result['players']))

if __name__=='__main__':unittest.main()
