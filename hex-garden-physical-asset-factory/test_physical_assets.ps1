param([string]$BlenderExe = "")
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $Root "tools\physical_assets\blender_common.ps1")
$Blender = Resolve-HexGardenBlender $BlenderExe
& $Blender --background --python-exit-code 1 --python (Join-Path $Root "tests\run_tests.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
