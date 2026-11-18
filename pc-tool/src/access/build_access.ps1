# 営業日報.accdb を組み立てる / 新しい版にする
#   ファイルが無いとき … 新しく作る
#   ファイルがあるとき … 先に (ユーザーフォルダ)\Backup にコピーしてから、マクロ・クエリ・画面を新しくする(ためたデータはそのまま)
# 使い方: powershell -ExecutionPolicy Bypass -File build_access.ps1 [営業日報.accdb の場所]
param([string]$Db = (Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) "営業日報.accdb"),
      [string]$BackupDir = (Join-Path $env:USERPROFILE "Backup"))
$ErrorActionPreference = "Stop"
$isNew = -not (Test-Path $Db)
if (-not $isNew) {
    $lock = [IO.Path]::ChangeExtension($Db, ".laccdb")
    if (Test-Path $lock) { throw "営業日報.accdb を開いている人がいます。閉じてから、もう一度実行してください: $lock" }
    New-Item -ItemType Directory $BackupDir -Force | Out-Null
    $bk = Join-Path $BackupDir ("営業日報_" + (Get-Date -Format "yyyyMMdd_HHmm") + ".accdb")
    Copy-Item $Db $bk
    "バックアップ: $bk"
}

$a = New-Object -ComObject Access.Application
try {
    $a.Visible = $false
    $a.AutomationSecurity = 1                         # 組み立ての間だけ、マクロを動かせるようにする
    if ($isNew) { $a.NewCurrentDatabase($Db) } else { $a.OpenCurrentDatabase($Db) }
    $vbp = $a.VBE.ActiveVBProject
    foreach ($m in @("M_Nippo", "M_Build")) {
        $code = [IO.File]::ReadAllText((Join-Path $PSScriptRoot "$m.bas"), [Text.Encoding]::UTF8)
        $old = $null
        foreach ($x in $vbp.VBComponents) { if ($x.Name -eq $m) { $old = $x } }
        if ($old) { $c = $old } else { $c = $vbp.VBComponents.Add(1); $c.Name = $m }   # 1 = 標準モジュール
        if ($c.CodeModule.CountOfLines -gt 0) { $c.CodeModule.DeleteLines(1, $c.CodeModule.CountOfLines) }
        $c.CodeModule.AddFromString($code)
    }
    $a.DoCmd.RunCommand(126)                          # 126 = コンパイルして保存(書き間違いがあればここで止まる)
    $r = $a.Run("BuildAll")
    if ($r -ne "OK") { throw "組み立てが止まりました: $r" }
    # 組み立て用のモジュールは、もう使わないので外す(元は src にある)
    $vbp.VBComponents.Remove($vbp.VBComponents.Item("M_Build"))
    $a.DoCmd.RunCommand(126)
    if ($isNew) { "作成: $Db ($r)" } else { "新しい版にしました: $Db ($r)" }
} finally {
    try { $a.CloseCurrentDatabase() } catch {}
    $a.Quit()
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($a)
}
