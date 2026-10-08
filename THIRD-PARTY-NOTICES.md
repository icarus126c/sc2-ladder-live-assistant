# Third-party components

- Node.js: https://nodejs.org/ — distributed runtime retains its LICENSE.
- CPython: https://www.python.org/ — runtime retains LICENSE.txt.
- mpyq 0.2.5: https://github.com/eagleflo/mpyq — MIT; runtime retains MPYQ-LICENSE.
- s2protocol 5.0.15.95299.0: https://github.com/Blizzard/s2protocol — MIT; runtime retains S2PROTOCOL-LICENSE.
- Vendored `replay_protocol98310.py`: unmodified Blizzard s2protocol tracker schema, MIT notice retained in the file. Source commit `901804e41283269d43d7bfc3b8dc5be2a9dd350a`, original path `s2protocol/versions/protocol98310.py`, SHA-256 `2941e39e970c21bfa7bb9c5c6d340c09366a5743f223b516fe19443f67c578e5`. See [pinned upstream source](https://github.com/Blizzard/s2protocol/blob/901804e41283269d43d7bfc3b8dc5be2a9dd350a/s2protocol/versions/protocol98310.py). Used only for verified 98370 tracker streams; unknown bit-packed init/game events are not decoded through this alias.
- Public replay test fixture from s2protocol: provenance and retained MIT notice are in `ladder-test/fixtures/`.

Runtime binaries are omitted from Git source and included with their notices in the Windows portable release. Logos and character theme assets are covered separately by ASSET-NOTICE.md.
