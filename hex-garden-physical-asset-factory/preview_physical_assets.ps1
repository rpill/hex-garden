param([string]$BlenderExe = "")
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $Root "tools\physical_assets\blender_common.ps1")
$Blender = Resolve-HexGardenBlender $BlenderExe
$PreviewScript = Join-Path $Root "tools\blender\render_physical_asset_preview.py"

Write-Host "Blender: $Blender"
Write-Host "Rendering Hex Garden physical asset previews..."
& $Blender --background --python-exit-code 1 --python $PreviewScript
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Done. Previews: art\physical-premium-preview\"
