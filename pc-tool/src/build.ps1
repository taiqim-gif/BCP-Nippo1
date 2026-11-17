# 日報取り込みツール.xlsm を組み立てる(マクロは M_取り込み.bas から入れる)
# 使い方: powershell -ExecutionPolicy Bypass -File build.ps1 [出力先.xlsm]
param([string]$Out = (Join-Path (Split-Path $PSScriptRoot -Parent) "日報取り込みツール.xlsm"))
$ErrorActionPreference = "Stop"
$code = [IO.File]::ReadAllText((Join-Path $PSScriptRoot "M_取り込み.bas"), [Text.Encoding]::UTF8)

$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false
try {
    $wb = $xl.Workbooks.Add()
    while ($wb.Worksheets.Count -gt 1) { $wb.Worksheets.Item($wb.Worksheets.Count).Delete() }
    $ws = $wb.Worksheets.Item(1)
    $ws.Name = "設定"
    $ws.Cells.Font.Name = "Meiryo UI"
    $ws.Cells.Font.Size = 11
    $ws.Columns("A").ColumnWidth = 22
    $ws.Columns("B").ColumnWidth = 62
    $ws.Columns("C").ColumnWidth = 10
    $ws.Columns("D").ColumnWidth = 10

    $ws.Range("A1").Value2 = "日報取り込みツール"
    $ws.Range("A1").Font.Size = 16
    $ws.Range("A1").Font.Bold = $true
    $ws.Range("A2").Value2 = "スマホの営業日報アプリのCSVを、営業日誌(日々のシート・運転管理表・ToDoリスト)に転記します"

    $labels = @("担当者名", "日誌原紙のファイル", "CSVを置くフォルダ", "日誌の保存先フォルダ")
    $notes  = @("", "", "空欄なら、このツールと同じ場所の「CSV」フォルダ", "空欄なら、このツールと同じ場所の「営業日誌」フォルダ")
    for ($i = 0; $i -lt 4; $i++) {
        $r = 4 + $i
        $ws.Cells.Item($r, 1).Value2 = $labels[$i]
        $ws.Cells.Item($r, 1).Font.Bold = $true
        $ws.Cells.Item($r, 2).Interior.Color = 0xE6FFFF   # 入力する欄(うすい黄色)
        $ws.Cells.Item($r, 2).Borders.LineStyle = 1
        if ($notes[$i]) { $ws.Cells.Item($r, 2).AddComment($notes[$i]) | Out-Null }
    }
    $ws.Range("A3").Value2 = "【設定】(最初に1回だけ)"
    $ws.Range("A3").Font.Bold = $true

    function Add-Btn($cell, $w, $h, $caption, $macro) {
        $c = $ws.Range($cell)
        $b = $ws.Buttons().Add($c.Left + 2, $c.Top + 1, $w, $h)
        $b.Caption = $caption
        $b.OnAction = $macro
        $b.Font.Size = 10
    }
    Add-Btn "C5" 48 17 "選ぶ" "PickTemplate"
    Add-Btn "C6" 48 17 "選ぶ" "PickCsvFolder"
    Add-Btn "D6" 48 17 "開く" "OpenCsvFolder"
    Add-Btn "C7" 48 17 "選ぶ" "PickOutFolder"
    Add-Btn "D7" 48 17 "開く" "OpenOutFolder"

    $ws.Rows(9).RowHeight = 36
    Add-Btn "A9" 220 32 "CSVを取り込む" "ImportCsv"
    $ws.Buttons().Item($ws.Buttons().Count).Font.Size = 14
    $ws.Buttons().Item($ws.Buttons().Count).Font.Bold = $true

    $ws.Range("A11").Value2 = "【使い方】"
    $ws.Range("A11").Font.Bold = $true
    $ws.Range("B11").Value2 = "1. スマホのアプリで「全データをメール送信」か、月初に「先月分を送る」で、自分あてにCSVを送る`n2. 届いたメールの添付(訪問_・車両_・ToDo_ のCSV)を、「CSVを置くフォルダ」に保存する`n3. 「CSVを取り込む」を押す`n4. 日誌の保存先に「営業日誌_2026年11月_名前.xlsx」ができる(2回目からは同じファイルに足す)"
    $ws.Range("B11").WrapText = $true
    $ws.Rows(11).RowHeight = 84

    $ws.Range("A14").Value2 = "前回の結果"
    $ws.Range("A14").Font.Bold = $true
    $ws.Range("B14").WrapText = $true
    $ws.Range("B14").VerticalAlignment = -4160   # 上ぞろえ
    $ws.Rows(14).RowHeight = 120
    $ws.Range("B4").Select() | Out-Null

    $mod = $wb.VBProject.VBComponents.Add(1)      # 標準モジュール
    $mod.Name = "M_Torikomi"
    if ($mod.CodeModule.CountOfLines -gt 0) { $mod.CodeModule.DeleteLines(1, $mod.CodeModule.CountOfLines) }   # 自動の Option Explicit を消す(二重を防ぐ)
    $mod.CodeModule.AddFromString($code)

    if (Test-Path $Out) { Remove-Item $Out }
    $wb.SaveAs($Out, 52)                          # 52 = マクロ有効ブック(.xlsm)
    $wb.Close($false)
    "作成: $Out"
} finally {
    $xl.Quit()
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($xl)
}
