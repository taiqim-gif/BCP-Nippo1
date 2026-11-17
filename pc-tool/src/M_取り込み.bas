Option Explicit
' =====================================================================
'  日報取り込みツール
'  スマホの営業日報アプリから届いたCSV(訪問・車両・ToDo)を、
'  月ごとの営業日誌(日誌原紙のコピー)に転記する。
'  ・日々のシート(1～31)の「時間・行先・面談者・用件・ToDo・備考」と「出発・帰着・給油」
'  ・運転管理表は、日々のシートから自動で集まる(原紙の数式のまま)
'  ・「ToDoリスト」シートに、その月のToDoの一覧
'  原紙は書き換えない。月ごとに「営業日誌_2026年11月_名前.xlsx」を作って書き込む。
' =====================================================================

Private Const ROW_FIRST As Long = 7          ' 日々のシートの表の最初の行
Private Const ROW_LAST As Long = 24          ' 日々のシートの表の最後の行(18行)
Private Const DATA_SHEET As String = "_取り込みデータ"   ' 取り込んだ訪問を覚えておく、隠したシート
Private Const TODO_SHEET As String = "ToDoリスト"
Private Const SET_SHEET As String = "設定"

Private gLog As String                       ' 結果のメモ(最後に画面に出す)

' ---------------------------------------------------------------------
'  ボタン：CSVを取り込む
' ---------------------------------------------------------------------
Public Sub ImportCsv()
    Dim nm As String, tpl As String, csvDir As String, outDir As String, msg As String
    nm = Setting("担当者名")
    tpl = Setting("日誌原紙のファイル")
    csvDir = Setting("CSVを置くフォルダ")
    outDir = Setting("日誌の保存先フォルダ")
    If csvDir = "" Then csvDir = ThisWorkbook.Path & "\CSV"
    If outDir = "" Then outDir = ThisWorkbook.Path & "\営業日誌"

    msg = ImportAll(nm, tpl, csvDir, outDir)
    WriteLog msg
    MsgBox msg, vbInformation, "日報取り込みツール"
End Sub

' 取り込みの本体(画面に何も出さない。結果の文を返す)
Public Function ImportAll(ByVal nm As String, ByVal tpl As String, ByVal csvDir As String, ByVal outDir As String) As String
    Dim files As Collection, f As String, i As Long
    Dim visits As Object, vehicles As Object, todos As Object, fullMonths As Object, months As Object
    Dim used As Collection

    gLog = ""
    If nm = "" Then ImportAll = "「設定」の担当者名を入れてください。": Exit Function
    If tpl = "" Or Dir(tpl) = "" Then ImportAll = "日誌原紙のファイルが見つかりません。" & vbLf & tpl: Exit Function
    If Dir(csvDir, vbDirectory) = "" Then ImportAll = "CSVを置くフォルダが見つかりません。" & vbLf & csvDir: Exit Function
    If Dir(outDir, vbDirectory) = "" Then MkDir outDir

    ' CSVを集める(訪問_・車両_・ToDo_ で始まるもの)
    Set files = New Collection
    f = Dir(AddSep(csvDir) & "*.csv")
    Do While f <> ""
        If f Like "訪問_*" Or f Like "車両_*" Or f Like "ToDo_*" Then files.Add f
        f = Dir()
    Loop
    If files.Count = 0 Then ImportAll = "取り込むCSVがありません。" & vbLf & "(" & csvDir & ")": Exit Function

    Set visits = CreateObject("Scripting.Dictionary")      ' ID → 訪問1件
    Set vehicles = CreateObject("Scripting.Dictionary")    ' 日付 → 出発・帰着・給油
    Set todos = CreateObject("Scripting.Dictionary")       ' ID → ToDo1件
    Set fullMonths = CreateObject("Scripting.Dictionary")  ' 「月分」のCSVの月(その月の訪問を入れ替える)
    Set months = CreateObject("Scripting.Dictionary")      ' 書き込む月
    Set used = New Collection

    Dim ym As Variant, wb As Workbook, k As Variant
    On Error GoTo FAIL
    For i = 1 To files.Count
        If ReadCsvFile(AddSep(csvDir) & files(i), CStr(files(i)), nm, visits, vehicles, todos, fullMonths, months) Then used.Add files(i)
    Next i

    ' ToDoは、すでに日誌のファイルがある月にも書く(ToDoだけで新しいファイルは作らない)
    For Each k In todos.Keys
        For Each ym In Array(Left$(todos(k)(1), 7), Left$(todos(k)(4), 7))
            If ym <> "" Then
                If Dir(MonthPath(CStr(ym), nm, tpl, outDir)) <> "" Then months(CStr(ym)) = True
            End If
        Next ym
    Next k

    If months.Count = 0 Then
        ImportAll = "転記できるデータがありませんでした。" & vbLf & gLog
        Exit Function
    End If

    ' 月ごとに書き込む
    Application.ScreenUpdating = False
    Application.DisplayAlerts = False
    For Each ym In months.Keys
        Set wb = OpenMonthBook(CStr(ym), nm, tpl, outDir)
        WriteMonth wb, CStr(ym), visits, vehicles, todos, fullMonths.Exists(CStr(ym))
        wb.Save
        gLog = gLog & "・" & wb.Name & " に書き込みました" & vbLf
        wb.Close SaveChanges:=False
        Set wb = Nothing
    Next ym
    On Error GoTo 0
    Application.DisplayAlerts = True
    Application.ScreenUpdating = True

    ' 取り込んだCSVは「取り込み済み」フォルダへ移す(消さない)
    MoveDone csvDir, used
    ImportAll = "取り込みが終わりました(CSV " & used.Count & "個)。" & vbLf & vbLf & gLog
    Exit Function

FAIL:
    Dim em As String
    em = Err.Description
    On Error Resume Next
    If Not wb Is Nothing Then wb.Close SaveChanges:=False
    Application.DisplayAlerts = True
    Application.ScreenUpdating = True
    ImportAll = "途中で止まりました:" & em & vbLf & "(CSVは移していません。日誌のファイルを閉じてから、もう一度押してください)" & vbLf & vbLf & gLog
End Function

' ---------------------------------------------------------------------
'  CSVを1つ読む
' ---------------------------------------------------------------------
Private Function ReadCsvFile(ByVal path As String, ByVal fname As String, ByVal nm As String, _
        visits As Object, vehicles As Object, todos As Object, fullMonths As Object, months As Object) As Boolean
    Dim rows As Collection, head As Variant, r As Variant, i As Long
    Dim cWho As Long, who As String, kind As String, isMonth As Boolean

    Set rows = ParseCsv(ReadUtf8(path))
    If rows.Count < 1 Then gLog = gLog & "・" & fname & ":中身がありません" & vbLf: Exit Function
    head = rows(1)
    kind = Left$(fname, InStr(fname, "_") - 1)
    isMonth = (InStr(fname, "月分") > 0)

    ' 担当者の確認(列があり、名前が入っているときだけ)
    cWho = ColOf(head, "担当者")
    If cWho >= 0 Then
        For i = 2 To rows.Count
            who = Cell(rows(i), cWho)
            If who <> "" And NoSpace(who) <> NoSpace(nm) Then
                gLog = gLog & "・" & fname & ":担当者が「" & who & "」なので、取り込みませんでした" & vbLf
                Exit Function
            End If
        Next i
    End If

    Select Case kind
    Case "訪問"
        Dim cD As Long, cS As Long, cE As Long, cT As Long, cA As Long, cAt As Long, cC As Long, cN As Long, cId As Long
        cD = ColOf(head, "日付"): cS = ColOf(head, "開始時刻"): cE = ColOf(head, "終了時刻"): cT = ColOf(head, "訪問先")
        cA = ColOf(head, "面談者"): cAt = ColOf(head, "敬称"): cC = ColOf(head, "内容"): cN = ColOf(head, "特記事項"): cId = ColOf(head, "ID")
        If cD < 0 Or cT < 0 Then gLog = gLog & "・" & fname & ":訪問のCSVの形ではありません" & vbLf: Exit Function
        For i = 2 To rows.Count
            r = rows(i)
            Dim d As String, id As String
            d = Cell(r, cD)
            If IsYmd(d) Then
                id = Cell(r, cId)
                If id = "" Then id = d & "|" & Cell(r, cS) & "|" & Cell(r, cT)
                visits(id) = Array(d, Cell(r, cS), Cell(r, cE), Cell(r, cT), Cell(r, cA) & Cell(r, cAt), Cell(r, cC), Cell(r, cN), id)
                months(Left$(d, 7)) = True
                If isMonth Then fullMonths(Left$(d, 7)) = True
            End If
        Next i
    Case "車両"
        Dim vD As Long, vDep As Long, vRet As Long, vFuel As Long
        vD = ColOf(head, "日付"): vDep = ColOf(head, "出発距離"): vRet = ColOf(head, "帰社距離"): vFuel = ColOf(head, "給油量")
        If vD < 0 Then gLog = gLog & "・" & fname & ":車両のCSVの形ではありません" & vbLf: Exit Function
        For i = 2 To rows.Count
            r = rows(i)
            If IsYmd(Cell(r, vD)) Then
                vehicles(Cell(r, vD)) = Array(Cell(r, vDep), Cell(r, vRet), Cell(r, vFuel))
                months(Left$(Cell(r, vD), 7)) = True
            End If
        Next i
    Case "ToDo"
        Dim tS As Long, tT As Long, tC As Long, tId As Long, tReg As Long, tDone As Long
        tS = ColOf(head, "状態"): tT = ColOf(head, "顧客名"): tC = ColOf(head, "内容")
        tId = ColOf(head, "ID"): tReg = ColOf(head, "登録日"): tDone = ColOf(head, "完了日")
        If tId < 0 Or tReg < 0 Then
            gLog = gLog & "・" & fname & ":ToDoのCSVが古い形です(アプリを新しい版にしてください)" & vbLf
            ReadCsvFile = True
            Exit Function
        End If
        For i = 2 To rows.Count
            r = rows(i)
            If Cell(r, tId) <> "" Then
                ' ToDoだけでは、新しい月のファイルを作らない(訪問・車両のある月に書く)
                todos(Cell(r, tId)) = Array(Cell(r, tS), Cell(r, tReg), Cell(r, tT), Cell(r, tC), Cell(r, tDone), Cell(r, tId))
            End If
        Next i
    Case Else
        Exit Function
    End Select
    ReadCsvFile = True
End Function

' ---------------------------------------------------------------------
'  月のファイルを開く(なければ原紙をコピーして準備する)
' ---------------------------------------------------------------------
Private Function MonthPath(ByVal ym As String, ByVal nm As String, ByVal tpl As String, ByVal outDir As String) As String
    MonthPath = AddSep(outDir) & "営業日誌_" & Left$(ym, 4) & "年" & Mid$(ym, 6, 2) & "月_" & SafeName(nm) & Mid$(tpl, InStrRev(tpl, "."))
End Function

Private Function OpenMonthBook(ByVal ym As String, ByVal nm As String, ByVal tpl As String, ByVal outDir As String) As Workbook
    Dim path As String, wb As Workbook, isNew As Boolean
    path = MonthPath(ym, nm, tpl, outDir)
    If Dir(path) = "" Then
        FileCopy tpl, path
        isNew = True
    End If
    Set wb = Workbooks.Open(path, UpdateLinks:=0)
    If isNew Or Not IsPrepared(wb) Then PrepareBook wb, ym, nm
    Set OpenMonthBook = wb
End Function

Private Function IsPrepared(wb As Workbook) As Boolean
    Dim ws As Worksheet
    Set ws = DaySheet(wb, 1)
    If ws Is Nothing Then Exit Function
    IsPrepared = (CStr(ws.Range("AI6").Value) = "ToDo")
End Function

' 新しい月のファイルの準備：年月・曜日・担当者名、日々のシートにToDo列、ToDoリスト・データのシート
Private Sub PrepareBook(wb As Workbook, ByVal ym As String, ByVal nm As String)
    Dim y As Long, m As Long, d As Long, nDays As Long, ws As Worksheet, t As Worksheet
    y = CLng(Left$(ym, 4)): m = CLng(Mid$(ym, 6, 2))
    nDays = Day(DateSerial(y, m + 1, 0))

    Set t = SheetOf(wb, "運転管理表")
    If Not t Is Nothing Then
        t.Range("B1").Value = y
        t.Range("C1").Value = m
        For d = 1 To 31
            If d <= nDays Then
                t.Cells(11 + d, 3).Value = Mid$("日月火水木金土", Weekday(DateSerial(y, m, d)), 1)
            Else
                t.Cells(11 + d, 3).Value = ""
            End If
        Next d
    End If

    Set ws = DaySheet(wb, 1)
    If Not ws Is Nothing Then ws.Range("BC4").Value = nm      ' 他の日のシートは、1日のシートの名前を見ている

    For Each ws In wb.Worksheets
        If DayOf(ws.Name) > 0 Then AddTodoColumn ws
    Next ws

    ' ToDoリスト(見えるシート)
    Set t = SheetOf(wb, TODO_SHEET)
    If t Is Nothing Then
        Set t = wb.Worksheets.Add(After:=wb.Worksheets(wb.Worksheets.Count))
        t.Name = TODO_SHEET
        t.Range("A1:F1").Value = Array("状態", "登録日", "顧客名", "内容", "完了日", "ID")
        t.Range("A1:F1").Font.Bold = True
        t.Columns("A").ColumnWidth = 8
        t.Columns("B").ColumnWidth = 11
        t.Columns("C").ColumnWidth = 22
        t.Columns("D").ColumnWidth = 50
        t.Columns("E").ColumnWidth = 11
        t.Columns("F").ColumnWidth = 4
        t.Columns("F").Font.Color = RGB(180, 180, 180)
    End If

    ' 取り込みデータ(隠す)
    Set t = SheetOf(wb, DATA_SHEET)
    If t Is Nothing Then
        Set t = wb.Worksheets.Add(After:=wb.Worksheets(wb.Worksheets.Count))
        t.Name = DATA_SHEET
        t.Cells.NumberFormat = "@"
        t.Range("A1:H1").Value = Array("ID", "日付", "開始", "終了", "訪問先", "面談者", "内容", "特記事項")
        t.Visible = xlSheetHidden
    End If
End Sub

' 「用件」(Y～AT)の右側を分けて「ToDo」の列にする(AI～AT)
Private Sub AddTodoColumn(ws As Worksheet)
    Dim r As Long
    For r = 6 To ROW_LAST
        ws.Range("Y" & r & ":AT" & r).UnMerge
        ws.Range("Y" & r & ":AH" & r).Merge
        ws.Range("AI" & r & ":AT" & r).Merge
        With ws.Range("AI" & r & ":AT" & r)
            .Borders(xlEdgeLeft).LineStyle = xlContinuous
            .Borders(xlEdgeLeft).Weight = xlThin
            .VerticalAlignment = xlCenter
            If r >= ROW_FIRST Then
                .HorizontalAlignment = xlLeft
                .WrapText = True
                .Font.Size = 8
            End If
        End With
    Next r
    ws.Range("Y6").HorizontalAlignment = xlCenter
    ws.Range("AI6").Value = "ToDo"
    ws.Range("AI6").HorizontalAlignment = xlCenter
End Sub

' ---------------------------------------------------------------------
'  1か月分を書き込む
' ---------------------------------------------------------------------
Private Sub WriteMonth(wb As Workbook, ByVal ym As String, visits As Object, vehicles As Object, todos As Object, ByVal isFull As Boolean)
    Dim ds As Worksheet, stored As Object, k As Variant, v As Variant, r As Long, last As Long
    Dim days As Object, monthTodos As Object

    ' 1) 取り込み済みの訪問を読む
    Set ds = SheetOf(wb, DATA_SHEET)
    Set stored = CreateObject("Scripting.Dictionary")
    Set days = CreateObject("Scripting.Dictionary")
    last = ds.Cells(ds.Rows.Count, 1).End(xlUp).Row
    For r = 2 To last
        If CStr(ds.Cells(r, 1).Value) <> "" Then
            stored(CStr(ds.Cells(r, 1).Value)) = Array(CStr(ds.Cells(r, 2).Value), CStr(ds.Cells(r, 3).Value), CStr(ds.Cells(r, 4).Value), _
                CStr(ds.Cells(r, 5).Value), CStr(ds.Cells(r, 6).Value), CStr(ds.Cells(r, 7).Value), CStr(ds.Cells(r, 8).Value), CStr(ds.Cells(r, 1).Value))
        End If
    Next r

    ' 2) 「月分」のCSVなら、その月の分を全部入れ替える(スマホで消した訪問も消える)
    If isFull Then
        For Each k In stored.Keys
            days(stored(k)(0)) = True
        Next k
        stored.RemoveAll
    End If

    ' 3) 今回の訪問を足す(同じIDは上書き＝二重にならない)
    For Each k In visits.Keys
        v = visits(k)
        If Left$(v(0), 7) = ym Then
            If stored.Exists(k) Then days(stored(k)(0)) = True
            stored(k) = v
            days(v(0)) = True
        End If
    Next k

    ' 4) 覚えておく
    ds.Range("A2:H" & Application.WorksheetFunction.Max(2, last)).ClearContents
    r = 2
    For Each k In stored.Keys
        v = stored(k)
        ds.Range("A" & r & ":H" & r).Value = Array(v(7), v(0), v(1), v(2), v(3), v(4), v(5), v(6))
        r = r + 1
    Next k

    ' 5) ToDoリスト(この月に登録・完了したもの)
    Set monthTodos = UpdateTodoSheet(wb, ym, todos)

    ' 6) 日々のシートに書く(今回かかわった日だけ。手で書いた日は触らない)
    For Each k In days.Keys
        If Left$(k, 7) = ym Then WriteDay wb, CStr(k), stored, monthTodos
    Next k

    ' 7) 車両(出発・帰着・給油)
    For Each k In vehicles.Keys
        If Left$(k, 7) = ym Then WriteVehicle wb, CStr(k), vehicles(k)
    Next k
End Sub

Private Function UpdateTodoSheet(wb As Workbook, ByVal ym As String, todos As Object) As Object
    Dim t As Worksheet, all As Object, r As Long, last As Long, k As Variant, v As Variant
    Dim keys() As String, n As Long, i As Long, j As Long, tmp As String
    Set t = SheetOf(wb, TODO_SHEET)
    Set all = CreateObject("Scripting.Dictionary")
    last = t.Cells(t.Rows.Count, 6).End(xlUp).Row
    For r = 2 To last
        If CStr(t.Cells(r, 6).Value) <> "" Then
            all(CStr(t.Cells(r, 6).Value)) = Array(CStr(t.Cells(r, 1).Value), YmdText(t.Cells(r, 2).Value), CStr(t.Cells(r, 3).Value), _
                CStr(t.Cells(r, 4).Value), YmdText(t.Cells(r, 5).Value), CStr(t.Cells(r, 6).Value))
        End If
    Next r
    For Each k In todos.Keys
        v = todos(k)
        If Left$(v(1), 7) = ym Or Left$(v(4), 7) = ym Then all(k) = v
    Next k

    ' 登録日の順に並べる
    n = all.Count
    If n > 0 Then
        ReDim keys(1 To n)
        i = 0
        For Each k In all.Keys
            i = i + 1: keys(i) = all(k)(1) & "|" & k
        Next k
        For i = 1 To n - 1
            For j = i + 1 To n
                If keys(j) < keys(i) Then tmp = keys(i): keys(i) = keys(j): keys(j) = tmp
            Next j
        Next i
    End If

    t.Range("A2:F" & Application.WorksheetFunction.Max(2, last)).ClearContents
    t.Range("B:B,E:E").NumberFormat = "@"
    For i = 1 To n
        v = all(Mid$(keys(i), InStr(keys(i), "|") + 1))
        t.Range("A" & (i + 1) & ":F" & (i + 1)).Value = Array(v(0), v(1), v(2), v(3), v(4), v(5))
    Next i
    Set UpdateTodoSheet = all
End Function

' 1日分：表(7～24行)を消して、訪問を時間の順に書く
Private Sub WriteDay(wb As Workbook, ByVal d As String, stored As Object, todos As Object)
    Dim ws As Worksheet, list() As Variant, n As Long, k As Variant, i As Long, j As Long, tmp As Variant, r As Long
    Set ws = DaySheet(wb, CLng(Right$(d, 2)))
    If ws Is Nothing Then gLog = gLog & "・" & d & ":日付のシートが見つかりません" & vbLf: Exit Sub

    For r = ROW_FIRST To ROW_LAST
        ws.Range("A" & r).ClearContents
        ws.Range("C" & r).MergeArea.ClearContents
        ws.Range("G" & r).MergeArea.ClearContents
        ws.Range("J" & r).MergeArea.ClearContents
        ws.Range("S" & r).MergeArea.ClearContents
        ws.Range("Y" & r).MergeArea.ClearContents
        ws.Range("AI" & r).MergeArea.ClearContents
        ws.Range("AU" & r).MergeArea.ClearContents
    Next r

    n = 0
    For Each k In stored.Keys
        If stored(k)(0) = d Then n = n + 1
    Next k
    If n = 0 Then Exit Sub
    ReDim list(1 To n)
    i = 0
    For Each k In stored.Keys
        If stored(k)(0) = d Then i = i + 1: list(i) = stored(k)
    Next k
    For i = 1 To n - 1                       ' 開始時刻の順
        For j = i + 1 To n
            If list(j)(1) < list(i)(1) Then tmp = list(i): list(i) = list(j): list(j) = tmp
        Next j
    Next i

    For i = 1 To n
        If i > ROW_LAST - ROW_FIRST + 1 Then
            gLog = gLog & "・" & d & ":訪問が" & n & "件あり、" & (ROW_LAST - ROW_FIRST + 1) & "件を超えた分は書けませんでした" & vbLf
            Exit For
        End If
        r = ROW_FIRST + i - 1
        PutTime ws.Range("C" & r), list(i)(1)
        PutTime ws.Range("G" & r), list(i)(2)
        ws.Range("J" & r).Value = list(i)(3)
        ws.Range("S" & r).Value = list(i)(4)
        ws.Range("Y" & r).Value = list(i)(5)
        ws.Range("AI" & r).Value = TodoText(todos, list(i)(3), d)
        ws.Range("AU" & r).Value = list(i)(6)
    Next i
End Sub

' その日・その客先のToDo(登録した日 か 済ませた日)。済みも出す
Private Function TodoText(todos As Object, ByVal target As String, ByVal d As String) As String
    Dim k As Variant, v As Variant, s As String
    If target = "" Then Exit Function
    For Each k In todos.Keys
        v = todos(k)
        If NoSpace(v(2)) = NoSpace(target) And (v(1) = d Or v(4) = d) Then
            If s <> "" Then s = s & vbLf
            If v(0) = "済" And IsYmd(v(4)) Then
                s = s & "済(" & CLng(Mid$(v(4), 6, 2)) & "/" & CLng(Right$(v(4), 2)) & ") " & v(3)
            ElseIf v(0) = "済" Then
                s = s & "済 " & v(3)
            Else
                s = s & "□ " & v(3)
            End If
        End If
    Next k
    TodoText = s
End Function

Private Sub WriteVehicle(wb As Workbook, ByVal d As String, v As Variant)
    Dim ws As Worksheet
    Set ws = DaySheet(wb, CLng(Right$(d, 2)))
    If ws Is Nothing Then Exit Sub
    If v(0) <> "" Then ws.Range("AO25").Value = NumOrText(v(0))
    If v(1) <> "" Then ws.Range("AW25").Value = NumOrText(v(1))
    If v(2) <> "" Then ws.Range("BE25").Value = NumOrText(v(2))
End Sub

' ---------------------------------------------------------------------
'  設定のボタン
' ---------------------------------------------------------------------
Public Sub PickTemplate()
    Dim f As Variant
    f = Application.GetOpenFilename("Excel ファイル (*.xlsx;*.xlsm;*.xls),*.xlsx;*.xlsm;*.xls", , "日誌原紙を選んでください")
    If VarType(f) = vbString Then SetSetting "日誌原紙のファイル", CStr(f)
End Sub

Public Sub PickCsvFolder()
    Dim p As String
    p = PickFolder("CSVを置くフォルダを選んでください")
    If p <> "" Then SetSetting "CSVを置くフォルダ", p
End Sub

Public Sub PickOutFolder()
    Dim p As String
    p = PickFolder("営業日誌の保存先フォルダを選んでください")
    If p <> "" Then SetSetting "日誌の保存先フォルダ", p
End Sub

Public Sub OpenOutFolder()
    Dim p As String
    p = Setting("日誌の保存先フォルダ")
    If p = "" Then p = ThisWorkbook.Path & "\営業日誌"
    If Dir(p, vbDirectory) = "" Then MsgBox "まだフォルダがありません。" & vbLf & p, vbExclamation: Exit Sub
    Shell "explorer.exe """ & p & """", vbNormalFocus
End Sub

Public Sub OpenCsvFolder()
    Dim p As String
    p = Setting("CSVを置くフォルダ")
    If p = "" Then p = ThisWorkbook.Path & "\CSV"
    If Dir(p, vbDirectory) = "" Then MkDir p
    Shell "explorer.exe """ & p & """", vbNormalFocus
End Sub

Private Function PickFolder(ByVal title As String) As String
    With Application.FileDialog(msoFileDialogFolderPicker)
        .Title = title
        If .Show = -1 Then PickFolder = .SelectedItems(1)
    End With
End Function

' ---------------------------------------------------------------------
'  小さな道具
' ---------------------------------------------------------------------
Private Function Setting(ByVal key As String) As String
    Dim r As Range
    Set r = ThisWorkbook.Worksheets(SET_SHEET).Columns(1).Find(What:=key, LookAt:=xlWhole, LookIn:=xlValues)
    If Not r Is Nothing Then Setting = Trim$(CStr(r.Offset(0, 1).Value))
End Function

Private Sub SetSetting(ByVal key As String, ByVal value As String)
    Dim r As Range
    Set r = ThisWorkbook.Worksheets(SET_SHEET).Columns(1).Find(What:=key, LookAt:=xlWhole, LookIn:=xlValues)
    If Not r Is Nothing Then r.Offset(0, 1).Value = value
End Sub

Private Sub WriteLog(ByVal msg As String)
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets(SET_SHEET)
    ws.Range("B14").Value = Format(Now, "yyyy/mm/dd hh:nn") & vbLf & msg
End Sub

' UTF-8 のテキストを読む(先頭のBOMは自動で外れる)
Private Function ReadUtf8(ByVal path As String) As String
    Dim st As Object
    Set st = CreateObject("ADODB.Stream")
    st.Type = 2
    st.Charset = "utf-8"
    st.Open
    st.LoadFromFile path
    ReadUtf8 = st.ReadText(-1)
    st.Close
End Function

' CSVを、行ごとの配列にする(""で囲んだ中のカンマ・改行・"" に対応)
Private Function ParseCsv(ByVal s As String) As Collection
    Dim rows As New Collection, fields As Collection, cur As String, i As Long, ch As String, inQ As Boolean, n As Long
    Set fields = New Collection
    If Left$(s, 1) = ChrW(&HFEFF) Then s = Mid$(s, 2)
    n = Len(s)
    i = 1
    Do While i <= n
        ch = Mid$(s, i, 1)
        If inQ Then
            If ch = """" Then
                If i < n And Mid$(s, i + 1, 1) = """" Then
                    cur = cur & """": i = i + 1
                Else
                    inQ = False
                End If
            Else
                cur = cur & ch
            End If
        Else
            Select Case ch
            Case """": inQ = True
            Case ",": fields.Add cur: cur = ""
            Case vbCr
                ' 次の LF といっしょに扱う
            Case vbLf
                fields.Add cur: cur = ""
                rows.Add ToArray(fields)
                Set fields = New Collection
            Case Else: cur = cur & ch
            End Select
        End If
        i = i + 1
    Loop
    If cur <> "" Or fields.Count > 0 Then
        fields.Add cur
        rows.Add ToArray(fields)
    End If
    Set ParseCsv = rows
End Function

Private Function ToArray(c As Collection) As Variant
    Dim a() As String, i As Long
    ReDim a(0 To c.Count - 1)
    For i = 1 To c.Count
        a(i - 1) = c(i)
    Next i
    ToArray = a
End Function

Private Function ColOf(head As Variant, ByVal name As String) As Long
    Dim i As Long
    ColOf = -1
    For i = LBound(head) To UBound(head)
        If Trim$(head(i)) = name Then ColOf = i: Exit Function
    Next i
End Function

Private Function Cell(r As Variant, ByVal c As Long) As String
    If c < 0 Then Exit Function
    If c > UBound(r) Then Exit Function
    Cell = Trim$(r(c))
End Function

Private Function IsYmd(ByVal s As String) As Boolean
    IsYmd = (s Like "####-##-##")
End Function

Private Function YmdText(v As Variant) As String
    If IsDate(v) And VarType(v) = vbDate Then YmdText = Format(v, "yyyy-mm-dd") Else YmdText = CStr(v)
End Function

Private Sub PutTime(rg As Range, ByVal s As String)
    If s = "" Then Exit Sub
    If s Like "#:##" Or s Like "##:##" Then
        rg.NumberFormat = "h:mm"
        rg.Value = TimeValue(s)
    Else
        rg.Value = s
    End If
End Sub

Private Function NumOrText(ByVal s As String) As Variant
    If IsNumeric(s) Then NumOrText = CDbl(s) Else NumOrText = s
End Function

Private Function NoSpace(ByVal s As String) As String
    NoSpace = Replace(Replace(s, " ", ""), "　", "")
End Function

Private Function SafeName(ByVal s As String) As String
    Dim c As Variant
    For Each c In Array("\", "/", ":", "*", "?", """", "<", ">", "|", " ", "　")
        s = Replace(s, c, "")
    Next c
    SafeName = s
End Function

Private Function AddSep(ByVal p As String) As String
    If Right$(p, 1) = "\" Then AddSep = p Else AddSep = p & "\"
End Function

' シート名の頭の数字(「10出勤簿」→10)。数字で始まらなければ 0
Private Function DayOf(ByVal sn As String) As Long
    Dim i As Long, num As String
    For i = 1 To Len(sn)
        If Mid$(sn, i, 1) Like "#" Then num = num & Mid$(sn, i, 1) Else Exit For
    Next i
    If num <> "" Then DayOf = CLng(num)
End Function

Private Function DaySheet(wb As Workbook, ByVal d As Long) As Worksheet
    Dim ws As Worksheet
    For Each ws In wb.Worksheets
        If DayOf(ws.Name) = d Then Set DaySheet = ws: Exit Function
    Next ws
End Function

Private Function SheetOf(wb As Workbook, ByVal name As String) As Worksheet
    On Error Resume Next
    Set SheetOf = wb.Worksheets(name)
    On Error GoTo 0
End Function

' 取り込んだCSVを「取り込み済み」へ移す(同じ名前があれば、時刻を付ける)
Private Sub MoveDone(ByVal csvDir As String, used As Collection)
    Dim doneDir As String, i As Long, src As String, dst As String
    doneDir = AddSep(csvDir) & "取り込み済み"
    If Dir(doneDir, vbDirectory) = "" Then MkDir doneDir
    For i = 1 To used.Count
        src = AddSep(csvDir) & used(i)
        dst = AddSep(doneDir) & used(i)
        If Dir(dst) <> "" Then dst = AddSep(doneDir) & Format(Now, "yyyymmdd_hhnnss_") & used(i)
        Name src As dst
    Next i
End Sub
