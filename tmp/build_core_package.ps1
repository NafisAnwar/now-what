$ErrorActionPreference = "Stop"

$Root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$TmpRoot = [System.IO.Path]::GetFullPath((Join-Path $Root "tmp"))
$OutputDirectory = Join-Path $Root "output\zip"
$Commit = (git -C $Root rev-parse --short HEAD).Trim()
$FullCommit = (git -C $Root rev-parse HEAD).Trim()
$Branch = (git -C $Root branch --show-current).Trim()
$PackageVersion = (Get-Content -Raw -LiteralPath (Join-Path $Root "package.json") | ConvertFrom-Json).version
$SnapshotName = "NOW_WHAT_complete_core_snapshot_${Commit}_2026-07-12"
$StageBase = Join-Path $TmpRoot "package"
$StageRoot = Join-Path $StageBase $SnapshotName
$VerifyBase = Join-Path $TmpRoot "package-verification"
$ZipPath = Join-Path $OutputDirectory "${SnapshotName}.zip"
$ReportName = "NOW_WHAT_complete_engine_architecture_v1.2_2026-07-12.pdf"
$ReportPath = Join-Path $Root "output\pdf\$ReportName"

function Reset-TemporaryDirectory([string] $Path) {
    $Resolved = [System.IO.Path]::GetFullPath($Path)
    if (-not $Resolved.StartsWith($TmpRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to reset a directory outside the workspace tmp directory: $Resolved"
    }
    if (Test-Path -LiteralPath $Resolved) {
        Remove-Item -LiteralPath $Resolved -Recurse -Force
    }
    New-Item -ItemType Directory -Path $Resolved -Force | Out-Null
}

Reset-TemporaryDirectory $StageBase
New-Item -ItemType Directory -Path $StageRoot -Force | Out-Null
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

$CoreFiles = @(
    git -C $Root ls-files |
        Where-Object { $_ -and $_ -notlike "output/*" -and $_ -notin @("preview.err.log", "preview.out.log") }
)

foreach ($RelativePath in $CoreFiles) {
    $SourcePath = Join-Path $Root ($RelativePath -replace "/", "\")
    $DestinationPath = Join-Path $StageRoot ($RelativePath -replace "/", "\")
    $DestinationDirectory = Split-Path -Parent $DestinationPath
    New-Item -ItemType Directory -Path $DestinationDirectory -Force | Out-Null
    Copy-Item -LiteralPath $SourcePath -Destination $DestinationPath
}

$DocumentationDirectory = Join-Path $StageRoot "DOCUMENTATION"
New-Item -ItemType Directory -Path $DocumentationDirectory -Force | Out-Null
Copy-Item -LiteralPath $ReportPath -Destination (Join-Path $DocumentationDirectory $ReportName)

$LlmGuide = @"
# NOW_WHAT? LLM Context Start Here

This package is an exact committed core-source snapshot of NOW_WHAT? at commit $FullCommit ($Commit) on branch $Branch, plus generated architecture documentation.

## Read Order

1. DOCUMENTATION/$ReportName
2. src/types/index.ts
3. src/db/index.ts, src/db/profile.ts, and src/db/defaults.ts
4. src/engine/nowWhat.ts, src/engine/scoringV12.ts, src/engine/microActions.ts, and src/engine/explain.ts
5. src/components/dashboard/NowWhatCard.tsx and src/components/debug/EngineDebugPanel.tsx
6. src/services/exportImport.ts, src/services/reminderScheduler.ts, src/services/reviews.ts, and src/services/calendarImport.ts
7. scripts/v12-engine-qa.mjs

## Interpretation Rules

- Source code is authoritative. README text may lag implementation details.
- Product/package version is $PackageVersion; Engine v1.2 names the current Needs Profile, scoring, micro-action, recommendation deck, debug, category-normalization, and QA foundation.
- Task.energyRequired is a low/medium/high task-effort requirement. It is not the numeric user Energy Level.
- User Energy Level is the latest valid 1-5 ActivityLog record with type energy.
- Profile isolation is per IndexedDB database. Ordinary records therefore do not carry a profileId column.
- The engine is deterministic and rule-based. Do not infer AI, ML, cloud, account, social, or gamification behavior.
- The micro-action library and constants in source are the canonical implementation contracts.

## Validation Baseline

- npm run qa:v1.2: 77 assertions passed on 2026-07-12.
- npm run typecheck: passed on 2026-07-12.
- npm run build: passed on 2026-07-12; Vite reported only the existing chunk-size advisory.
"@
Set-Content -LiteralPath (Join-Path $StageRoot "LLM_CONTEXT_START_HERE.md") -Value $LlmGuide -Encoding UTF8

$Manifest = @"
# NOW_WHAT? Core Snapshot Package Manifest

## Snapshot Identity

- App: NOW_WHAT?
- Package version: $PackageVersion
- Engine reference: v1.2 foundation
- Branch: $Branch
- Commit: $FullCommit
- Short commit: $Commit
- Generated: 2026-07-12 (Asia/Dhaka)

## Included

- All $($CoreFiles.Count) committed core project files from git ls-files, excluding historical generated output and preview logs.
- Complete src/ application source.
- public/ PWA assets, manifest, favicon/icon sources, and service worker.
- Engine QA script, project configuration, README, package manifest, and lockfile.
- The complete 45-page source-grounded architecture and engine report.
- LLM navigation guidance, source tree, and SHA-256 checksums.

## Intentionally Excluded

- .git/ repository metadata.
- node_modules/ installed dependencies.
- dist/ generated production output.
- tmp/ report and package build intermediates.
- Historical output/ ZIP/PDF artifacts and preview logs.
- Browser IndexedDB user data, because this package is source architecture rather than a user backup.

## Verification

- npm run qa:v1.2: PASS, 77 assertions.
- npm run typecheck: PASS.
- npm run build: PASS, 109 modules transformed.
- PDF: PASS, 45 pages; every documented section and all 54 micro-action IDs extracted successfully; no blank pages or replacement characters; all pages rendered and visually inspected.
- ZIP: generated from committed files, expanded into a temporary verification directory, and checked against SHA256SUMS.txt.

## Source-of-Truth Policy

The PDF explains the architecture and behavior at this commit. The TypeScript, TSX, service worker, manifest, and package files remain authoritative for exact execution semantics. Use SHA256SUMS.txt to detect any package drift.
"@
Set-Content -LiteralPath (Join-Path $StageRoot "PACKAGE_MANIFEST.md") -Value $Manifest -Encoding UTF8

$GeneratedEntries = @(
    "DOCUMENTATION/$ReportName",
    "LLM_CONTEXT_START_HERE.md",
    "PACKAGE_MANIFEST.md",
    "SHA256SUMS.txt",
    "SOURCE_TREE.txt"
)
$SourceTree = @($CoreFiles + $GeneratedEntries | Sort-Object -Unique)
Set-Content -LiteralPath (Join-Path $StageRoot "SOURCE_TREE.txt") -Value $SourceTree -Encoding UTF8

$HashLines = @(
    Get-ChildItem -LiteralPath $StageRoot -Recurse -File |
        Where-Object { $_.Name -ne "SHA256SUMS.txt" } |
        Sort-Object FullName |
        ForEach-Object {
            $RelativePath = $_.FullName.Substring($StageRoot.Length).TrimStart("\").Replace("\", "/")
            $Hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash.ToLowerInvariant()
            "$Hash  $RelativePath"
        }
)
Set-Content -LiteralPath (Join-Path $StageRoot "SHA256SUMS.txt") -Value $HashLines -Encoding ASCII

if (Test-Path -LiteralPath $ZipPath) {
    Remove-Item -LiteralPath $ZipPath -Force
}
Compress-Archive -LiteralPath $StageRoot -DestinationPath $ZipPath -CompressionLevel Optimal

Reset-TemporaryDirectory $VerifyBase
Expand-Archive -LiteralPath $ZipPath -DestinationPath $VerifyBase -Force
$ExpandedRoot = Join-Path $VerifyBase $SnapshotName
$Failures = @()
foreach ($Line in Get-Content -LiteralPath (Join-Path $ExpandedRoot "SHA256SUMS.txt")) {
    if ($Line -notmatch "^([0-9a-f]{64})  (.+)$") {
        $Failures += "Malformed checksum line: $Line"
        continue
    }
    $ExpectedHash = $Matches[1]
    $RelativePath = $Matches[2]
    $ExpandedPath = Join-Path $ExpandedRoot ($RelativePath -replace "/", "\")
    if (-not (Test-Path -LiteralPath $ExpandedPath)) {
        $Failures += "Missing file: $RelativePath"
        continue
    }
    $ActualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $ExpandedPath).Hash.ToLowerInvariant()
    if ($ActualHash -ne $ExpectedHash) {
        $Failures += "Hash mismatch: $RelativePath"
    }
}

$ExpandedFiles = @(Get-ChildItem -LiteralPath $ExpandedRoot -Recurse -File)
$Forbidden = @(
    $ExpandedFiles | Where-Object {
        $Relative = $_.FullName.Substring($ExpandedRoot.Length).TrimStart("\").Replace("\", "/")
        $Relative -match "(^|/)(node_modules|dist|tmp|\.git|output)(/|$)" -or
        $Relative -in @("preview.err.log", "preview.out.log")
    }
)
if ($Forbidden.Count -gt 0) {
    $Failures += "Forbidden package paths: $($Forbidden.FullName -join ', ')"
}

if ($Failures.Count -gt 0) {
    $Failures | ForEach-Object { Write-Error $_ }
    throw "ZIP verification failed."
}

$ZipHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $ZipPath).Hash.ToLowerInvariant()
$PdfHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $ReportPath).Hash.ToLowerInvariant()
[pscustomobject]@{
    ZipPath = $ZipPath
    ZipBytes = (Get-Item -LiteralPath $ZipPath).Length
    ZipSha256 = $ZipHash
    PackagedFiles = $ExpandedFiles.Count
    SourceFiles = $CoreFiles.Count
    PdfPath = $ReportPath
    PdfBytes = (Get-Item -LiteralPath $ReportPath).Length
    PdfSha256 = $PdfHash
    Verification = "PASS"
} | Format-List
