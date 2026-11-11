# Standalone Windows experiment. The only input is the checked-in fictional vectors.
$ErrorActionPreference = 'Stop'
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
    throw 'Este prototipo solo se ejecuta en Windows.'
}

$repo = Split-Path -Parent $PSScriptRoot
$localAppData = [Environment]::GetFolderPath('LocalApplicationData')
if ([string]::IsNullOrWhiteSpace($localAppData)) { throw 'LocalAppData no está disponible.' }
$root = Join-Path $localAppData ('ClaveLocal-Phase1-' + [guid]::NewGuid().ToString('N'))
$primary = Join-Path $root 'vault.json'
$initial = Join-Path $root 'initial.tmp'
$candidate = Join-Path $root 'replacement.tmp'
$recovery = Join-Path $root 'recovered.json'
$backupName = 'backup-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffffffZ') + '.json'
$backup = Join-Path $root $backupName
$fixtures = @{
    310000 = Join-Path $repo 'test/vectors/v1-310k.json'
    600000 = Join-Path $repo 'test/vectors/v1-600k.json'
}
$ownerSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$allowedSids = @($ownerSid, 'S-1-5-18', 'S-1-5-32-544')

function Write-FlushedVector([string]$Path, [int]$Factor) {
    $bytes = [IO.File]::ReadAllBytes($fixtures[$Factor])
    $stream = [IO.File]::Open($Path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try {
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.Flush($true)
    } finally {
        $stream.Dispose()
    }
}

function Measure-InheritedAccess([string]$Path) {
    $acl = Get-Acl -LiteralPath $Path
    $rules = $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
    $allowed = @($rules | Where-Object AccessControlType -eq Allow)
    $unexpected = @($allowed | Where-Object { !$_.IsInherited -or $_.IdentityReference.Value -notin $allowedSids })
    [pscustomobject]@{
        Object = Split-Path -Leaf $Path
        InheritanceEnabled = !$acl.AreAccessRulesProtected
        OwnerAllowed = $ownerSid -in $allowed.IdentityReference.Value
        UnexpectedAllows = $unexpected.Count
        UnexpectedRights = ($unexpected.FileSystemRights -join ', ')
    }
}

function Assert-FictionalVector([string]$Path, [int]$Factor) {
    $expected = (Get-FileHash -LiteralPath $fixtures[$Factor] -Algorithm SHA256).Hash
    $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
    if ($actual -ne $expected) { throw "La revisión de $Factor iteraciones no coincide con el vector." }
    $verify = @'
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { openVault } from "./vault.mjs";
const [path, iterations] = process.argv.slice(1);
const envelope = JSON.parse(await readFile(path, "utf8"));
assert.equal(envelope.kdf.iterations, Number(iterations));
const { vault } = await openVault("golden-ficticia-no-usar-en-la-vida-real", envelope);
assert.equal(vault.entries.length, 1);
assert.equal(vault.entries[0].id, "golden-1");
'@
    & node --input-type=module -e $verify $Path $Factor
    if ($LASTEXITCODE -ne 0) { throw 'La revisión ficticia no abrió con Web Crypto.' }
}

# Create a fresh directory and never overwrite a pre-existing directory.
New-Item -ItemType Directory -Path $root | Out-Null
Push-Location -LiteralPath $repo
try {
    $observations = @(Measure-InheritedAccess $root)
    Write-FlushedVector $initial 310000
    $observations += Measure-InheritedAccess $initial
    [IO.File]::Move($initial, $primary)
    Assert-FictionalVector $primary 310000

    Write-FlushedVector $candidate 600000
    $observations += Measure-InheritedAccess $candidate
    Assert-FictionalVector $candidate 600000
    Assert-FictionalVector $primary 310000
    Write-Output 'PASÓ: el temporal volcado y la revisión vigente se abren por separado.'

    $lock = [IO.File]::Open($primary, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    try {
        try {
            [IO.File]::Replace($candidate, $primary, $backup)
            throw 'El reemplazo debía fallar con el archivo principal bloqueado.'
        } catch [IO.IOException] {
            $win32Code = $_.Exception.HResult -band 0xffff
            if ($win32Code -notin @(32, 33)) { throw }
        }
    } finally {
        $lock.Dispose()
    }
    Assert-FictionalVector $primary 310000
    Assert-FictionalVector $candidate 600000
    if ([IO.File]::Exists($backup)) { throw 'El reemplazo rechazado creó una copia inesperada.' }
    Write-Output "PASÓ: el bloqueo devolvió el error de uso compartido $win32Code y conservó los datos."

    [IO.File]::Replace($candidate, $primary, $backup)
    $observations += Measure-InheritedAccess $primary
    $observations += Measure-InheritedAccess $backup
    Assert-FictionalVector $primary 600000
    Assert-FictionalVector $backup 310000
    [IO.File]::Copy($backup, $recovery, $false)
    Assert-FictionalVector $recovery 310000
    Write-Output 'PASÓ: reemplazo, copia con marca UTC y recuperación autenticada.'
    $observations | ConvertTo-Json -Compress
    $needsReview = $observations | Where-Object { !$_.InheritanceEnabled -or !$_.OwnerAllowed -or $_.UnexpectedAllows -gt 0 }
} finally {
    Pop-Location
    foreach ($path in @($initial, $candidate, $recovery, $backup, $primary)) {
        [IO.File]::Delete($path)
    }
    [IO.Directory]::Delete($root, $false)
}
if ($needsReview) {
    Write-Warning 'La inspección de permisos requiere revisión. Se conservan los criterios del ADR.'
    exit 2
}
