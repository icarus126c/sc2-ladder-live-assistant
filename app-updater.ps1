param([string]$TargetDirectory='',[string]$SourceDirectory='',[switch]$Interactive,[switch]$Rollback,[switch]$PlanOnly,[switch]$NoRestart,[int]$Port=17864)
$ErrorActionPreference='Stop'
# Use modules compatible with this Windows PowerShell host.
$env:PSModulePath=(Join-Path $PSHOME 'Modules')+';'+(Join-Path $env:ProgramFiles 'WindowsPowerShell/Modules')
function File-SHA($file){
 $algorithm=[Security.Cryptography.SHA256]::Create();$stream=[IO.File]::OpenRead($file)
 try{return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-','')}finally{$stream.Dispose();$algorithm.Dispose()}
}
function Select-Folder($description){
 Add-Type -AssemblyName System.Windows.Forms
 $dialog=New-Object System.Windows.Forms.FolderBrowserDialog
 $dialog.Description=$description;$dialog.ShowNewFolderButton=$false
 try{if($dialog.ShowDialog() -ne 'OK'){throw '操作已取消'};return $dialog.SelectedPath}finally{$dialog.Dispose()}
}
function Safe-Root($value){
 $root=[IO.Path]::GetFullPath($value).TrimEnd('\','/')
 if(-not (Test-Path -LiteralPath $root -PathType Container)){throw '助手文件夹不存在'}
 $item=Get-Item -LiteralPath $root
 if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){throw '不支持链接文件夹'}
 return $root
}
function Safe-Path($root,$relative){
 if([string]::IsNullOrEmpty($relative) -or $relative -match '(^/|\\|:|(^|/)\.\.?(/|$))'){throw '更新清单包含不安全路径'}
 $parts=$relative.Split('/')
 if($parts.Length -gt 1){if($parts[0] -notin @('public','docs','runtime')){throw '更新文件不在程序范围内'}}
 elseif($relative -notmatch '(\.(cjs|py|cmd|ps1|md|txt|html|png)$|^(package|update-manifest)\.json$|^LICENSE$)'){throw '更新文件不在程序范围内'}
 if($relative -match '^\.|(^|/)(__pycache__|node_modules|\.ladder-data)(/|$)'){throw '不允许更新私人数据'}
 $full=[IO.Path]::GetFullPath((Join-Path $root $relative))
 if(-not $full.StartsWith($root+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw '路径越出助手文件夹'}
 $walk=$full
 while($walk -and $walk -ne $root){
  if(Test-Path -LiteralPath $walk){if((Get-Item -LiteralPath $walk).Attributes -band [IO.FileAttributes]::ReparsePoint){throw '更新路径含文件链接'}}
  $walk=Split-Path $walk -Parent
 }
 return $full
}
function Validate-Manifest($root){
 $manifest=Get-Content -LiteralPath (Join-Path $root 'update-manifest.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($manifest.schema -ne 1 -or $manifest.app -ne 'starcraft-ladder-live-assistant' -or $manifest.version -notmatch '^\d+\.\d+\.\d+$' -or -not $manifest.files -or $manifest.files.Count -gt 12000){throw '新包更新清单无效，请获取完整标准包'}
 $seen=@{}
 foreach($entry in $manifest.files){
  $file=Safe-Path $root $entry.path
  if($seen.ContainsKey($entry.path) -or $entry.sha256 -notmatch '^[A-Fa-f0-9]{64}$'){throw '更新清单有重复项或无效校验值'}
  $seen[$entry.path]=$true
  if(-not (Test-Path -LiteralPath $file -PathType Leaf) -or (File-SHA $file) -ne $entry.sha256){throw ('新包文件缺失或损坏：'+$entry.path)}
 }
 foreach($required in @('package.json','ladder-server.cjs','ladder-replays.cjs','data-storage.cjs','启动天梯助手.cmd','runtime/node.exe','runtime/python/python.exe')){if(-not $seen.ContainsKey($required)){throw ('标准包缺少：'+$required)}}
 $package=Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($package.name -ne $manifest.app -or $package.version -ne $manifest.version){throw '版本清单不一致'}
 return $manifest
}
function Api-Action($action){
 $key=Invoke-RestMethod "http://127.0.0.1:$Port/api/control-session" -Headers @{'X-Control-Client'='assistant'} -TimeoutSec 3
 Invoke-RestMethod "http://127.0.0.1:$Port/api/action" -Method Post -Headers @{'X-Control-Token'=$key.token} -ContentType 'application/json' -Body ($action|ConvertTo-Json -Compress) -TimeoutSec 5|Out-Null
}
function Stop-Assistant{
 $listener=Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue|Select-Object -First 1
 if(-not $listener){return}
 $process=Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
 if($process.ExecutablePath -ne (Join-Path $script:target 'runtime/node.exe') -or $process.CommandLine -notmatch 'ladder-server\.cjs'){throw '端口被其他程序占用，更新未执行'}
 $script:before=Invoke-RestMethod "http://127.0.0.1:$Port/api/state" -TimeoutSec 3
 Api-Action @{action='dataBackup'}
 Stop-Process -Id $listener.OwningProcess -Force
 $script:wasRunning=$true
}
function Start-Assistant{
 if($NoRestart){return}
 $node=Join-Path $script:target 'runtime/node.exe'
 $script:launched=Start-Process -FilePath $node -ArgumentList 'ladder-server.cjs' -WorkingDirectory $script:target -WindowStyle Hidden -PassThru
 for($attempt=0;$attempt -lt 60;$attempt++){
  try{$after=Invoke-RestMethod "http://127.0.0.1:$Port/api/state" -TimeoutSec 1;break}catch{Start-Sleep -Milliseconds 250}
 }
 if(-not $after){throw '服务启动失败，可以使用回退功能'}
 if($script:before -and $null -eq $script:before.ladder.session.endedAt){
  if($after.ladder.session.previousStartedAt -ne $script:before.ladder.session.startedAt){throw '直播边界核对失败，请在主界面恢复上一场直播'}
  Api-Action @{action='streamResume'}
 }
 if($script:before.config.sc2AutoPaused){Api-Action @{action='cut';scene=$script:before.scene}}
}
function Restore-Files($plan,$backup){
 foreach($entry in $plan.files){
  $destination=Safe-Path $script:target $entry.path
  if($entry.existed){
   $saved=Join-Path $backup ('files/'+$entry.path)
   if(-not (Test-Path -LiteralPath $saved -PathType Leaf) -or (File-SHA $saved) -ne $entry.sha256){throw '旧程序备份缺失或损坏，回退未执行'}
   New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent)|Out-Null
   Copy-Item -LiteralPath $saved -Destination $destination -Force
  }elseif(Test-Path -LiteralPath $destination -PathType Leaf){Remove-Item -LiteralPath $destination -Force}
 }
}
$script:before=$null;$script:wasRunning=$false;$backup='';$plan=$null;$changed=$false
try{
 if(-not $TargetDirectory){if(-not $Interactive){throw '需要选择旧助手文件夹'};$TargetDirectory=Select-Folder '选择旧助手所在文件夹（账号和战绩将保留）'}
 $script:target=Safe-Root $TargetDirectory
 if(-not (Test-Path -LiteralPath (Join-Path $script:target 'ladder-server.cjs'))){throw '选择的文件夹不是助手目录'}
 $backupRoot=Join-Path $script:target 'work/app-backups'
 if(Test-Path -LiteralPath $backupRoot){$walk=$backupRoot;while($walk -ne $script:target){if((Get-Item -LiteralPath $walk).Attributes -band [IO.FileAttributes]::ReparsePoint){throw '备份目录含链接'};$walk=Split-Path $walk -Parent}}
 if($Rollback){
  $backup=Get-ChildItem -LiteralPath $backupRoot -Directory|Sort-Object Name -Descending|Where-Object {Test-Path -LiteralPath (Join-Path $_.FullName 'complete.json')}|Select-Object -First 1 -ExpandProperty FullName
  if(-not $backup){throw '没有可回退的程序备份'}
  $plan=Get-Content -LiteralPath (Join-Path $backup 'complete.json') -Raw -Encoding UTF8|ConvertFrom-Json
  foreach($entry in $plan.files){$null=Safe-Path $script:target $entry.path;if($entry.existed){$saved=Join-Path $backup ('files/'+$entry.path);if((File-SHA $saved) -ne $entry.sha256){throw '程序备份校验失败'}}}
  if($PlanOnly){@{mode='rollback';files=$plan.files.Count;backup=$backup}|ConvertTo-Json;exit 0}
 }else{
  if(-not $SourceDirectory){if(-not $Interactive){throw '需要选择新标准包文件夹'};$SourceDirectory=Select-Folder '选择已解压的新标准包文件夹（含启动天梯助手.cmd）'}
  $source=Safe-Root $SourceDirectory
  if($source -eq $script:target -or $source.StartsWith($script:target+'\',[StringComparison]::OrdinalIgnoreCase) -or $script:target.StartsWith($source+'\',[StringComparison]::OrdinalIgnoreCase)){throw '新旧助手文件夹不能相同或互相包含'}
  $manifest=Validate-Manifest $source
  $manifest.files+=@{path='update-manifest.json';sha256=(File-SHA (Join-Path $source 'update-manifest.json'))}
  foreach($entry in $manifest.files){$null=Safe-Path $script:target $entry.path}
  if($PlanOnly){@{mode='update';version=$manifest.version;files=$manifest.files.Count;preservesData=$true}|ConvertTo-Json;exit 0}
 }
 if($Interactive){
  Add-Type -AssemblyName System.Windows.Forms
  $message=$(if($Rollback){'回退上次程序更新'}else{'更新到 '+$manifest.version})+"？`r`n目标："+$script:target+"`r`n账号、战绩、自定义素材保留。当前服务会短暂重启。"
  if([Windows.Forms.MessageBox]::Show($message,'星际直播助手','OKCancel','Information') -ne 'OK'){exit 0}
 }
 if(-not $NoRestart){Stop-Assistant}
 # Preserve a resumable checkpoint before the replacement program starts.
 if($script:before -and $null -eq $script:before.ladder.session.endedAt){
  $records=Join-Path $script:target '.ladder-data/records.json'
  $saved=Get-Content -LiteralPath $records -Raw -Encoding UTF8|ConvertFrom-Json
  if($saved.session.id -ne $script:before.ladder.session.id){throw '当前直播场次已改变'}
  $saved.previousSession=$saved.session
  [IO.File]::WriteAllText($records,($saved|ConvertTo-Json -Depth 100),[Text.UTF8Encoding]::new($false))
 }
 if($Rollback){Restore-Files $plan $backup;Move-Item -LiteralPath (Join-Path $backup 'complete.json') -Destination (Join-Path $backup 'rolled-back.json')}
 else{
  $backup=Join-Path $backupRoot ((Get-Date -Format 'yyyyMMddHHmmssfff')+'-'+[guid]::NewGuid())
  New-Item -ItemType Directory -Force -Path $backup|Out-Null
  $entries=@(foreach($entry in $manifest.files){
   $destination=Safe-Path $script:target $entry.path;$existed=Test-Path -LiteralPath $destination -PathType Leaf;$hash=''
   if($existed){$hash=(File-SHA $destination);$saved=Join-Path $backup ('files/'+$entry.path);New-Item -ItemType Directory -Force -Path (Split-Path $saved -Parent)|Out-Null;Copy-Item -LiteralPath $destination -Destination $saved}
   @{path=$entry.path;existed=$existed;sha256=$hash}
  })
  $plan=@{schema=1;files=$entries}
  [IO.File]::WriteAllText((Join-Path $backup 'pending.json'),($plan|ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))
  $data=Join-Path $script:target '.ladder-data'
  if(Test-Path -LiteralPath $data){Copy-Item -LiteralPath $data -Destination (Join-Path $backup 'data') -Recurse}
  $changed=$true
  foreach($entry in $manifest.files){$destination=Safe-Path $script:target $entry.path;New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent)|Out-Null;Copy-Item -LiteralPath (Safe-Path $source $entry.path) -Destination $destination -Force;if((File-SHA $destination) -ne $entry.sha256){throw '复制后校验失败，正在恢复旧程序'}}
  Move-Item -LiteralPath (Join-Path $backup 'pending.json') -Destination (Join-Path $backup 'complete.json')
 }
 Start-Assistant
 @{updated=$true;rollback=[bool]$Rollback;backup=$backup;dataPreserved=$true}|ConvertTo-Json
 if($Interactive){[Windows.Forms.MessageBox]::Show('操作完成。请回到助手页面，原有数据与设置保留。','星际直播助手')|Out-Null}
}catch{
 $failure=$_.Exception.Message
 if($changed -and $plan){try{if($script:launched -and -not $script:launched.HasExited){Stop-Process -Id $script:launched.Id -Force};Restore-Files $plan $backup}catch{$failure+='；自动回退失败：'+$_.Exception.Message}}
 if($script:wasRunning){try{Start-Assistant}catch{$failure+='；重新启动失败：'+$_.Exception.Message}}
 if($Interactive){Add-Type -AssemblyName System.Windows.Forms;[Windows.Forms.MessageBox]::Show($failure,'更新未完成','OK','Error')|Out-Null}
 Write-Error $failure
 exit 1
}
