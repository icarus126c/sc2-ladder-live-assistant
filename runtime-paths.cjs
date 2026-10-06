const fs=require('node:fs'),path=require('node:path');
function python(){const bundled=path.join(__dirname,'runtime','python','python.exe');return fs.existsSync(bundled)?bundled:process.env.SC2_PYTHON||(process.platform==='win32'?'python':'python3');}
module.exports={python};
