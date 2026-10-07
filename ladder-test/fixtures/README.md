# Public replay fixture

`iaguz-luneth-4.7.1.SC2Replay` is an unmodified public regression fixture from
Blizzard Entertainment's MIT-licensed `s2protocol` repository:

- Commit: `fbb98e80aee825d6deeabd7b48b51cbecebde062`
- Original path: `tests/s2replaystatsdata/2018-11-29_Z_iaguz_VS_P_Luneth.SC2Replay`
- SHA-256: `b15a192659ca2145a8e82f96254f6637b778788a2329e900ab712abaccc2d4d7`
- Source: https://github.com/Blizzard/s2protocol/blob/fbb98e80aee825d6deeabd7b48b51cbecebde062/tests/s2replaystatsdata/2018-11-29_Z_iaguz_VS_P_Luneth.SC2Replay
- Upstream license: [S2PROTOCOL-LICENSE.txt](S2PROTOCOL-LICENSE.txt)

The test reads the real MPQ archive through `mpyq` and `s2protocol`, checks player
identity, result, duration and tracker statistics, and fails if the fixture or
Python dependencies are missing. It does not use any developer's private paths.

Install `requirements.txt` before running `npm test`; `SC2_PYTHON` can select a
Python virtual environment as described in the main README.
