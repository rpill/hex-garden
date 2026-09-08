Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-HexGardenBlender {
    param([string]$ExplicitPath)

    $candidates = New-Object System.Collections.Generic.List[string]
    if ($ExplicitPath) { $candidates.Add($ExplicitPath) }
    if ($env:BLENDER_EXE) { $candidates.Add($env:BLENDER_EXE) }

    $command = Get-Command blender.exe -ErrorAction SilentlyContinue
    if ($command) { $candidates.Add($command.Source) }

    $foundations = @((Join-Path $env:ProgramFiles "Blender Foundation"))
    $foundations += Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Root -match '^[A-Z]:\\$' } | ForEach-Object {
        Join-Path $_.Root "Program Files\Blender Foundation"
    }
    foreach ($foundation in ($foundations | Select-Object -Unique)) {
      if (Test-Path $foundation) {
        Get-ChildItem -Path $foundation -Directory -Filter "Blender *" -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending |
            ForEach-Object {
                $exe = Join-Path $_.FullName "blender.exe"
                if (Test-Path $exe) { $candidates.Add($exe) }
            }
      }
    }

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) {
            return (Resolve-Path $candidate).Path
        }
    }

    throw @"
Blender.exe was not found.
Set BLENDER_EXE once, for example:
  `$env:BLENDER_EXE = 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
Then re-run this script.
"@
}

function Resolve-HexGardenPython {
    $py = Get-Command py.exe -ErrorAction SilentlyContinue
    if ($py) { return @($py.Source, "-3") }
    $python = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($python) { return @($python.Source) }
    throw "Python was not found. Install Python 3 or use the Blender generator without the optional Pillow verifier."
}
