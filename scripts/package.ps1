param(
  [Parameter(Mandatory=$true)][string]$RuntimeDirectory,
  [string]$OutputDirectory=(Join-Path (Split-Path $PSScriptRoot -Parent) 'outputs'),
  [string]$GuideDirectory='',
  [string]$ReleaseDate=(Get-Date -Format 'yyyyMMdd')
)
$ErrorActionPreference='Stop'
$taskSource=Split-Path $PSScriptRoot -Parent
$taskRuntime=[IO.Path]::GetFullPath($RuntimeDirectory)
$taskOutput=[IO.Path]::GetFullPath($OutputDirectory)
if($ReleaseDate -notmatch '^\d{8}$'){throw 'ReleaseDate must be yyyyMMdd'}
foreach($taskRequired in @('node.exe','LICENSE','python/python.exe','python/LICENSE.txt','python/MPYQ-LICENSE','python/S2PROTOCOL-LICENSE')){
  if(-not (Test-Path -LiteralPath (Join-Path $taskRuntime $taskRequired))){throw "Missing runtime file: $taskRequired"}
}
$taskVersion=(Get-Content -LiteralPath (Join-Path $taskSource 'package.json') -Raw | ConvertFrom-Json).version
$taskStageRoot=Join-Path $taskSource ('work/package/'+[guid]::NewGuid().ToString())
$taskStage=Join-Path $taskStageRoot ('星际2天梯直播助手-'+$taskVersion)
New-Item -ItemType Directory -Force -Path $taskStage,$taskOutput | Out-Null
foreach($taskFile in Get-ChildItem -LiteralPath $taskSource -File){
  if($taskFile.Extension -in @('.cjs','.py','.cmd') -or $taskFile.Name -in @('package.json','requirements.txt','LICENSE','README.md','ASSET-NOTICE.md','THIRD-PARTY-NOTICES.md','CHANGELOG.md','SPONSOR.md')){
    Copy-Item -LiteralPath $taskFile.FullName -Destination $taskStage
  }
}
Copy-Item -LiteralPath (Join-Path $taskSource 'public') -Destination $taskStage -Recurse
Copy-Item -LiteralPath (Join-Path $taskSource 'docs') -Destination $taskStage -Recurse
Copy-Item -LiteralPath $taskRuntime -Destination (Join-Path $taskStage 'runtime') -Recurse
Copy-Item -LiteralPath (Join-Path $taskSource 'start.cmd') -Destination (Join-Path $taskStage '启动天梯助手.cmd')
if($GuideDirectory){
  foreach($taskGuide in @('朋友版-极简使用说明.txt','朋友版-极简使用说明.png')){
    Copy-Item -LiteralPath (Join-Path $GuideDirectory $taskGuide) -Destination $taskStage
  }
  Copy-Item -LiteralPath (Join-Path $GuideDirectory '朋友版-极简使用说明.txt') -Destination (Join-Path $taskStage '使用说明.txt')
}else{
  [IO.File]::WriteAllText((Join-Path $taskStage '使用说明.txt'),"完整解压后双击启动天梯助手.cmd。`r`n直播姬或OBS添加浏览器来源：http://127.0.0.1:17864/output`r`n设置1920×1080，放在游戏捕获上方。`r`n详细说明见README.md。",[Text.UTF8Encoding]::new($false))
}
$taskNote=[IO.File]::ReadAllText((Join-Path $taskStage '使用说明.txt'))
$taskReadme='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>使用说明</title><style>body{max-width:900px;margin:40px auto;padding:24px;font:18px/1.8 "Microsoft YaHei",sans-serif;background:#0a1623;color:#e9f1fa}pre{white-space:pre-wrap}a{color:#6ce0ec}</style><a href="http://127.0.0.1:17864/">打开已启动的助手</a><pre>'+[Net.WebUtility]::HtmlEncode($taskNote)+'</pre></html>'
[IO.File]::WriteAllText((Join-Path $taskStage '使用说明.html'),$taskReadme,[Text.UTF8Encoding]::new($false))
$taskStageResolved=[IO.Path]::GetFullPath($taskStage)
foreach($taskCache in (Get-ChildItem -LiteralPath $taskStage -Directory -Filter __pycache__ -Recurse)){
  if(-not [IO.Path]::GetFullPath($taskCache.FullName).StartsWith($taskStageResolved+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Cache outside staging root'}
  Remove-Item -LiteralPath $taskCache.FullName -Recurse -Force
}
$taskZip=Join-Path $taskOutput ('星际2天梯直播助手-'+$taskVersion+'-标准版-'+$ReleaseDate+'-Windows-x64.zip')
if(Test-Path -LiteralPath $taskZip){throw "Output already exists: $taskZip"}
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory($taskStageRoot,$taskZip,[IO.Compression.CompressionLevel]::Optimal,$false)
$taskHash=(Get-FileHash -LiteralPath $taskZip -Algorithm SHA256).Hash
[IO.File]::WriteAllText((Join-Path $taskOutput '分享包-SHA256.txt'),$taskHash+'  '+[IO.Path]::GetFileName($taskZip)+[Environment]::NewLine,[Text.UTF8Encoding]::new($false))
Write-Output $taskZip
Write-Output $taskHash
