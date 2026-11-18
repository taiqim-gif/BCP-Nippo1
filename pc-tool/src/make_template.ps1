# 日誌原紙.xlsx の「1日分のシート」を、見やすい形(1項目=1列、A～Kの11列)に作り直す
#  ・運転管理表のシートは、元の原紙のまま残す
#  ・元の原紙は、先にバックアップしておくこと(このスクリプトは上書きする)
# 使い方: powershell -ExecutionPolicy Bypass -File make_template.ps1 [日誌原紙.xlsx の場所]
#
# 新しい1日分のシートの形(プログラムは、この位置に書く)
#   B4 = 年月日(曜日)   J4 = 担当者氏名
#   6行目 = 見出し      7～24行目 = 訪問(18行)
#   A=No B=顧客コード C=開始 D=～ E=終了 F=行先 G=面談者 H=用件 I=ToDo J=備考 K=確認印
#   25行目: G25 = 出発メーター  I25 = 帰着メーター  K25 = 給油
param([string]$Path = (Join-Path (Split-Path $PSScriptRoot -Parent) "日誌原紙.xlsx"))
$ErrorActionPreference = "Stop"
$FONT = "UD デジタル 教科書体 N"

$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false
try {
    $wb = $xl.Workbooks.Open($Path)
    $old = $null
    foreach ($s in $wb.Worksheets) { if ($s.Name -ne "運転管理表") { $old = $s; break } }
    $ws = $wb.Worksheets.Add($wb.Worksheets.Item(1))      # いちばん前に新しいシート
    if ($old) { $old.Delete() }
    $ws.Name = "Sheet1"

    $ws.Cells.Font.Name = $FONT
    $ws.Cells.Font.Size = 11
    $ws.Cells.VerticalAlignment = -4108                  # 上下の中央

    # 列の幅(文字数)
    $widths = @{ A = 4; B = 11; C = 6.5; D = 2.5; E = 6.5; F = 24; G = 12; H = 32; I = 24; J = 24; K = 11.5 }
    foreach ($k in $widths.Keys) { $ws.Range("${k}:${k}").ColumnWidth = [double]$widths[$k] }

    # 題名・日付・担当者
    $ws.Rows(2).RowHeight = 30
    $ws.Range("A2:K2").Merge()
    $ws.Range("A2").Value2 = "営　　業　　日　　誌"
    $ws.Range("A2").Font.Size = 18
    $ws.Range("A2").HorizontalAlignment = -4108
    $ws.Rows(4).RowHeight = 24
    $ws.Range("B4:F4").Merge()
    $ws.Range("B4").Font.Size = 14
    $ws.Range("B4").HorizontalAlignment = -4131          # 左
    $ws.Range("I4").Value2 = "担当者氏名"
    $ws.Range("I4").HorizontalAlignment = -4152          # 右
    $ws.Range("I4").Font.Size = 12
    $ws.Range("J4:K4").Merge()
    $ws.Range("J4:K4").Borders(9).LineStyle = 1          # 9 = 下の線
    $ws.Range("J4").HorizontalAlignment = -4108

    # 見出し(6行目)
    $ws.Rows(6).RowHeight = 20
    $ws.Range("A6").Value2 = "No"
    $ws.Range("B6").Value2 = "顧客コード"
    $ws.Range("C6:E6").Merge()
    $ws.Range("C6").Value2 = "時間"
    $ws.Range("F6").Value2 = "行先"
    $ws.Range("G6").Value2 = "面談者"
    $ws.Range("H6").Value2 = "用件"
    $ws.Range("I6").Value2 = "ToDo"
    $ws.Range("J6").Value2 = "備考（特記事項）"
    $ws.Range("K6").Value2 = "確認印"
    $h = $ws.Range("A6:K6")
    $h.HorizontalAlignment = -4108
    $h.Interior.Color = 0xEFEFEF                         # うすい灰色

    # 訪問の行(7～24行目)
    for ($r = 7; $r -le 24; $r++) {
        $ws.Rows($r).RowHeight = 27
        $ws.Range("A$r").Value2 = [string]($r - 6)
        $ws.Range("D$r").Value2 = "～"
    }
    $ws.Range("B7:B24").NumberFormat = "@"               # 顧客コードは文字のまま(頭の0が消えないように)
    $ws.Range("A7:A24").HorizontalAlignment = -4108
    $ws.Range("B7:B24").HorizontalAlignment = -4108
    $ws.Range("C7:E24").HorizontalAlignment = -4108
    $ws.Range("K7:K24").HorizontalAlignment = -4108
    $ws.Range("K7:K24").ShrinkToFit = $true
    $ws.Range("F7:J24").WrapText = $true                 # 長い文は折り返す
    $ws.Range("F7:J24").HorizontalAlignment = -4131
    $ws.Range("H7:J24").Font.Size = 9
    $ws.Range("I7:I24").Font.Size = 8

    # 罫線(表のまわりは太め、中は細線。時間の3列は、中の縦線なし)
    $t = $ws.Range("A6:K24")
    $t.Borders.LineStyle = 1
    $t.Borders.Weight = 2
    foreach ($e in 7, 8, 9, 10) { $t.Borders($e).Weight = -4138 }   # 外まわり = 中くらい
    $ws.Range("C7:E24").Borders(11).LineStyle = -4142    # 11 = 中の縦線、-4142 = なし
    $ws.Range("A6:K6").Borders(9).Weight = -4138

    # 車両(25行目)
    $ws.Rows(25).RowHeight = 22
    $ws.Range("F25").Value2 = "出発メーター"
    $ws.Range("H25").Value2 = "帰着メーター"
    $ws.Range("J25").Value2 = "給油(L)"
    foreach ($a in "F25", "H25", "J25") { $ws.Range($a).HorizontalAlignment = -4152 }
    foreach ($a in "G25", "I25", "K25") {
        $ws.Range($a).HorizontalAlignment = -4108
        $ws.Range($a).Borders.LineStyle = 1
        $ws.Range($a).Borders.Weight = 2
    }

    # 印刷:A4横、1枚に収める、左右の中央
    $ps = $ws.PageSetup
    $ps.Orientation = 2                                  # 2 = 横
    $ps.PaperSize = 9                                    # 9 = A4
    $ps.Zoom = $false
    $ps.FitToPagesWide = 1
    $ps.FitToPagesTall = 1
    $ps.CenterHorizontally = $true
    $ps.LeftMargin = $xl.CentimetersToPoints(1)
    $ps.RightMargin = $xl.CentimetersToPoints(1)
    $ps.TopMargin = $xl.CentimetersToPoints(1.2)
    $ps.BottomMargin = $xl.CentimetersToPoints(1)
    $ps.PrintArea = "`$A`$1:`$K`$25"

    $xl.ActiveWindow.DisplayGridlines = $false
    $ws.Activate()
    $xl.ActiveWindow.DisplayGridlines = $false
    $xl.ActiveWindow.Zoom = 90                           # 表示90%(画面に表の全体が入るように。日付のシートにも引き継ぐ)
    $ws.Range("A1").Select() | Out-Null
    $wb.Save()
    $wb.Close($false)
    "作り直しました: $Path"
} finally {
    $xl.Quit()
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($xl)
}
