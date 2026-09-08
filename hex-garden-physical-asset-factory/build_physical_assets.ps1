param(
    [string]$BlenderExe = "",
    [string]$Only = "",
    [switch]$SkipVerify
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $Root "tools\physical_assets\blender_common.ps1")
$Blender = Resolve-HexGardenBlender $BlenderExe
$Generator = Join-Path $Root "tools\blender\generate_physical_assets.py"

Write-Host "Blender: $Blender"
if ($Only) {
    Write-Host "Generating selected Hex Garden physical asset(s): $Only"
    & $Blender --background --python-exit-code 1 --python $Generator -- --only $Only
} else {
    Write-Host "Generating ALL Hex Garden physical assets..."
    & $Blender --background --python-exit-code 1 --python $Generator
}
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not $SkipVerify) {
    $Verifier = Join-Path $Root "tools\physical_assets\verify_physical_assets.py"
    & $Blender --background --python-exit-code 1 --python $Verifier -- --only $Only
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "Done. Runtime files: public\assets\physical-premium\"
