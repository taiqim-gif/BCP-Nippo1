Option Compare Database
Option Explicit
' =====================================================================
'  営業日報(Access版)
'  ・スマホの営業日報アプリのCSV(訪問・車両・ToDo・容器。アプリ v15 からは1つのCSV)を、担当者ごとにためる
'  ・担当者と月を選んで、今と同じ書式の営業日誌(Excel、日誌原紙のコピー)を作る
'  ・訪問回数・ToDo・走行距離を、担当者ごとに分けて見る
'  場所はすべて、このファイルが今あるフォルダを元に決める(フォルダごと持ち歩ける)
'    初期設定用紙入れ\日誌原紙.xlsx / CSV フォルダ / 営業日誌 フォルダ
' =====================================================================

Private Const ROW_FIRST As Long = 7          ' 日々のシートの表の最初の行
Private Const ROW_LAST As Long = 24          ' 日々のシートの表の最後の行(18行)
' 日々のシートの列(2026-11-18 の新しい原紙。1項目=1列。作り方は プログラム_直すとき用\make_template.ps1)
Private Const C_CODE As String = "B"         ' 顧客コード
Private Const C_START As String = "C"        ' 開始
Private Const C_END As String = "E"          ' 終了(D列は「～」)
Private Const C_PLACE As String = "F"        ' 行先
Private Const C_PERSON As String = "G"       ' 面談者
Private Const C_YOUKEN As String = "H"       ' 用件
Private Const C_TODO As String = "I"         ' ToDo
Private Const C_NOTE As String = "J"         ' 備考(特記事項)
Private Const C_STAMP As String = "K"        ' 確認印
Private Const CELL_DATE As String = "B4"     ' 年月日(曜日)
Private Const CELL_NAME As String = "J4"     ' 担当者氏名
Private Const CELL_DEP As String = "G25"     ' 出発メーター
Private Const CELL_RET As String = "I25"     ' 帰着メーター
Private Const CELL_FUEL As String = "K25"    ' 給油
Private Const DATA_SHEET As String = "_取り込みデータ"   ' 書いた訪問を覚えておく、隠したシート
Private Const TODO_SHEET As String = "ToDoリスト"
Private Const TPL_SHEET As String = "_ひな形"   ' 日誌原紙の1日分のシート(隠す)。日付のシートは、これをコピーして作る
Private Const KANRI_SHEET As String = "運転管理表"
Private Const CT_SHEET As String = "容器ログ"   ' 容器ログの一覧(v15)
Private Const MENU As String = "F_メニュー"
Private Const ALL_WHO As String = "(全員)"

Private gLog As String                       ' 結果のメモ(最後に画面に出す)
Private gLastView As String                  ' 最後に開いた分析の画面(Excelに出すときに使う)
Private gNames As Object                     ' 顧客コード → 今の客先名(NowName で使う。取り込んだら作り直す)
Private Const APPROVE_FORM As String = "F_承認"   ' 上長の承認の画面

' 分析の画面(担当者・年を変えたら、開いているものを出し直す)
Private Function ViewForms() As Variant
    ViewForms = Array("F_訪問回数", "F_訪問の一覧", "F_走行距離", "F_車両の一覧", "F_ToDo未対応", "F_ToDo日数", "F_ToDo客先別", "F_容器ログ", "F_承認の一覧")
End Function

' =====================================================================
'  場所
' =====================================================================
' 日誌原紙の置き場所(2026-11-25 から「初期設定用紙入れ」フォルダ。ほかの人が消したり直したりしにくいよう、読み取り専用にしてある)
Public Function TemplateDir() As String
    TemplateDir = AddSep(CurrentProject.Path) & "初期設定用紙入れ"
End Function

' 日誌原紙の場所。新しい置き場所に無いときは、前の場所(このファイルと同じフォルダ)を使う
Public Function TemplatePath() As String
    Dim p As String
    p = AddSep(TemplateDir()) & "日誌原紙.xlsx"
    If Not FileExists(p) Then
        If FileExists(AddSep(CurrentProject.Path) & "日誌原紙.xlsx") Then p = AddSep(CurrentProject.Path) & "日誌原紙.xlsx"
    End If
    TemplatePath = p
End Function

Public Function CsvDir() As String
    CsvDir = AddSep(CurrentProject.Path) & "CSV"
End Function

Public Function OutDir() As String
    OutDir = AddSep(CurrentProject.Path) & "営業日誌"
End Function

' =====================================================================
'  メニューで選んでいるもの(クエリの中からも使う)
' =====================================================================
' 選んでいる担当者。「(全員)」や未選択なら ""
Public Function SelWho() As String
    Dim v As Variant
    On Error Resume Next
    If CurrentProject.AllForms(MENU).IsLoaded Then v = Forms(MENU)!cbo担当者
    On Error GoTo 0
    If IsNull(v) Or IsEmpty(v) Then Exit Function
    If CStr(v) = ALL_WHO Then Exit Function
    SelWho = CStr(v)
End Function

' 年度(4月～翌年3月)。2027年3月 → 2026、2027年4月 → 2027(2026-11-25)
Public Function FiscalYear(ByVal d As Date) As Long
    FiscalYear = Year(DateAdd("m", -3, d))
End Function

' 年月("2026-11")の年度のフォルダ(営業日誌\2026年度)。無ければ作る(新しい年度の4月分を初めて作ったときに、できる)
Public Function FyDir(ByVal ym As String) As String
    FyDir = YearDir(FiscalYear(DateSerial(CLng(Left$(ym, 4)), CLng(Mid$(ym, 6, 2)), 1)))
End Function

' 年度(2026)のフォルダ(営業日誌\2026年度)。無ければ作る
Public Function YearDir(ByVal fy As Long) As String
    Dim p As String
    p = AddSep(OutDir()) & fy & "年度"
    If Not FolderExists(OutDir()) Then MkDir OutDir()
    If Not FolderExists(p) Then MkDir p
    YearDir = p
End Function

' 分析で選んでいる年度(未選択なら今の年度)
Public Function SelYear() As Long
    Dim v As Variant
    SelYear = FiscalYear(Date)
    On Error Resume Next
    If CurrentProject.AllForms(MENU).IsLoaded Then v = Forms(MENU)!cbo年
    On Error GoTo 0
    If Not IsNull(v) And Not IsEmpty(v) Then If IsNumeric(v) Then SelYear = CLng(v)
End Function

' 担当者の条件に合うか(クエリ用。全員のときは、いつも合う)
Public Function WhoOk(ByVal who As Variant) As Boolean
    Dim s As String
    s = SelWho()
    If s = "" Then WhoOk = True Else WhoOk = (Nz(who, "") = s)
End Function

' =====================================================================
'  メニューのボタン
' =====================================================================
Public Function MenuLoad()
    Dim f As Form, y As Long, d As Date, i As Long, s As String
    Set f = Forms(MENU)
    FillWhoList
    ' 年月(印刷用):今月から13か月前まで。最初は、月の1～5日は先月(月初に先月分を出すため)、6日からは今月
    s = ""
    For i = 0 To 12
        d = DateAdd("m", -i, DateSerial(Year(Date), Month(Date), 1))
        s = s & Format(d, "yyyy-mm") & ";" & Format(d, "yyyy年m月") & ";"
    Next i
    f!cbo年月.RowSource = s
    If Day(Date) <= 5 Then f!cbo年月 = Format(DateAdd("m", -1, Date), "yyyy-mm") Else f!cbo年月 = Format(Date, "yyyy-mm")
    ' 年度(分析用。4月～翌年3月):今の年度から5年度前まで。値=2026、表示=2026年度
    s = ""
    For y = FiscalYear(Date) To FiscalYear(Date) - 5 Step -1
        s = s & y & ";" & y & "年度;"
    Next y
    f!cbo年.RowSource = s
    f!cbo年 = FiscalYear(Date)
End Function

' 担当者の一覧を作り直す(選んでいた人は、そのまま)
Private Sub FillWhoList()
    Dim f As Form, rs As DAO.Recordset, s As String, cur As Variant
    Set f = Forms(MENU)
    cur = f!cbo担当者
    s = """" & ALL_WHO & """;"
    Set rs = CurrentDb.OpenRecordset("SELECT 名前 FROM T_担当者 ORDER BY 名前", dbOpenSnapshot)
    Do Until rs.EOF
        s = s & """" & Replace(rs!名前, """", "") & """;"
        rs.MoveNext
    Loop
    rs.Close
    f!cbo担当者.RowSource = s
    If IsNull(cur) Then f!cbo担当者 = ALL_WHO Else f!cbo担当者 = cur
End Sub

' 担当者・年を変えたとき:開いている分析の画面を出し直す
Public Function AfterSel()
    Dim n As Variant
    ResetNames
    For Each n In ViewForms()
        If CurrentProject.AllForms(n).IsLoaded Then Forms(n).Requery
    Next n
    If CurrentProject.AllForms(APPROVE_FORM).IsLoaded Then ApproveRefresh
End Function

Public Function BtnAddWho()
    Dim nm As String
    nm = Trim$(InputBox("担当者の名前を入れてください。" & vbLf & "(スマホのアプリに登録した名前と同じ字)", "担当者を追加"))
    If nm = "" Then Exit Function
    AddWho nm
    FillWhoList
    Forms(MENU)!cbo担当者 = nm
    AfterSel
End Function

Public Function BtnImportMine()
    Dim who As String
    who = SelWho()
    If who = "" Then MsgBox "上の「担当者」で、自分の名前を選んでください。" & vbLf & "(全員分を入れるときは「まとめて取り込む」)", vbExclamation, "営業日報": Exit Function
    ShowResult ImportCsv(who, CsvDir())
End Function

Public Function BtnImportAll()
    ShowResult ImportCsv("", CsvDir())
End Function

Public Function BtnMake()
    Dim ym As Variant, who As String, msg As String, rs As DAO.Recordset, p As String, n As Long
    ym = Forms(MENU)!cbo年月
    If IsNull(ym) Then MsgBox "年月を選んでください。", vbExclamation, "営業日報": Exit Function
    who = SelWho()
    DoCmd.Hourglass True
    If who <> "" Then
        msg = MakeNisshi(who, CStr(ym), p)
    Else
        ' 全員:その月にデータがある人の分を、全部作る
        Set rs = CurrentDb.OpenRecordset("SELECT DISTINCT 担当者 FROM (SELECT 担当者 FROM T_訪問 WHERE Format(日付,'yyyy-mm')='" & ym & "' UNION SELECT 担当者 FROM T_車両 WHERE Format(日付,'yyyy-mm')='" & ym & "')", dbOpenSnapshot)
        Do Until rs.EOF
            msg = msg & MakeNisshi(CStr(rs!担当者), CStr(ym), p) & vbLf
            n = n + 1
            rs.MoveNext
        Loop
        rs.Close
        If n = 0 Then msg = "この月のデータがありません。"
        If n <> 1 Then p = ""
    End If
    DoCmd.Hourglass False
    Forms(MENU)!txt結果 = Format(Now, "yyyy/mm/dd hh:nn") & vbCrLf & Replace(msg, vbLf, vbCrLf)
    If p <> "" Then
        If MsgBox(msg & vbLf & vbLf & "今、開きますか?", vbYesNo + vbInformation, "営業日報") = vbYes Then OpenPath p
    Else
        MsgBox msg, vbInformation, "営業日報"
    End If
End Function

' 担当者の設定(車両ナンバー)を入れる画面
Public Function BtnWhoSettings()
    DoCmd.OpenForm "F_担当者", acFormDS
End Function

' 会社の休み(年末年始・お盆など)を入れる画面
Public Function BtnHolidays()
    DoCmd.OpenForm "F_会社休日", acFormDS
End Function

Public Function BtnOpenCsv()
    If Not FolderExists(CsvDir()) Then MkDir CsvDir()
    OpenPath CsvDir()
End Function

Public Function BtnOpenOut()
    If Not FolderExists(OutDir()) Then MkDir OutDir()
    OpenPath OutDir()
End Function

' 分析の画面を開く(開いていれば出し直す)
Public Function BtnView(ByVal fname As String)
    gLastView = fname
    ResetNames                                            ' 客先の今の名前を、読み直す
    If CurrentProject.AllForms(fname).IsLoaded Then
        Forms(fname).Requery
        DoCmd.SelectObject acForm, fname
    Else
        DoCmd.OpenForm fname, acFormDS
    End If
End Function

' 今見ている分析を Excel に出す(分析の画面を開いた状態で押す)
Public Function BtnExport()
    Dim fname As String, p As String
    fname = gLastView
    If fname <> "" Then If Not CurrentProject.AllForms(fname).IsLoaded Then fname = ""
    If fname = "" Then MsgBox "先に、分析のボタンで画面を開いてください。", vbExclamation, "営業日報": Exit Function
    ' 分析で選んでいる年度のフォルダ(営業日誌\2026年度)に入れる(2026-11-25 から)
    p = AddSep(YearDir(SelYear())) & "分析_" & Mid$(fname, 3) & "_" & IIf(SelWho() = "", "全員", SafeName(SelWho())) & "_" & Format(Now, "yyyymmdd_hhnn") & ".xlsx"
    DoCmd.OutputTo acOutputForm, fname, acFormatXLSX, p, True
End Function

Private Sub ShowResult(ByVal msg As String)
    FillWhoList
    AfterSel
    Forms(MENU)!txt結果 = Format(Now, "yyyy/mm/dd hh:nn") & vbCrLf & Replace(msg, vbLf, vbCrLf)
    MsgBox msg, vbInformation, "営業日報"
End Sub

Private Sub OpenPath(ByVal p As String)
    Shell "explorer.exe """ & p & """", vbNormalFocus
End Sub

' =====================================================================
'  取り込み
'  onlyWho = "" … CSVフォルダにある全員分(まとめて)
'  onlyWho = 名前 … その人のCSVだけ(ほかの人のCSVは、そのまま残す)
' =====================================================================
Public Function ImportCsv(ByVal onlyWho As String, ByVal dir_ As String) As String
    Dim f As String, daily As New Collection, monthly As New Collection, used As New Collection
    Dim i As Long, skipped As Long, r As Integer, ok As Long

    gLog = ""
    If Not FolderExists(dir_) Then MkDir dir_
    f = Dir(AddSep(dir_) & "*.csv")
    Do While f <> ""
        If f Like "日報_*" Or f Like "訪問_*" Or f Like "車両_*" Or f Like "ToDo_*" Or f Like "容器ログ_*" Then
            ' 「月分」は最後に入れる(その月の訪問を、月分の中身で入れ替えるため)
            If InStr(f, "月分") > 0 Then monthly.Add f Else daily.Add f
        End If
        f = Dir()
    Loop
    If daily.Count + monthly.Count = 0 Then ImportCsv = "取り込むCSVがありません。" & vbLf & "(" & dir_ & ")": Exit Function

    For i = 1 To daily.Count + monthly.Count
        If i <= daily.Count Then f = daily(i) Else f = monthly(i - daily.Count)
        r = ImportFile(AddSep(dir_) & f, f, onlyWho)
        If r = 1 Then used.Add f: ok = ok + 1
        If r = 2 Then skipped = skipped + 1
    Next i

    MoveDone dir_, used
    ResetNames                                            ' 新しい訪問が入ったので、客先の今の名前を読み直す
    ImportCsv = "取り込みが終わりました(CSV " & ok & "個)。" & vbLf
    If skipped > 0 Then ImportCsv = ImportCsv & "ほかの人のCSV " & skipped & "個は、そのまま残しました。" & vbLf
    If gLog <> "" Then ImportCsv = ImportCsv & vbLf & gLog
End Function

' CSVを1つ入れる。戻り値 1=入れた 2=ほかの人なので残した 0=入れられなかった
Private Function ImportFile(ByVal path As String, ByVal fname As String, ByVal onlyWho As String) As Integer
    Dim rows As Collection, tables As Collection, tb As Collection, t As Long, i As Long
    Dim who As String, w As String, cWho As Long, parts As Variant
    Dim db As DAO.Database, ws As DAO.Workspace, n As Long, isMonth As Boolean

    Set rows = ParseCsv(ReadUtf8(path))
    If rows.Count < 1 Then gLog = gLog & "・" & fname & ":中身がありません" & vbLf: Exit Function
    Set tables = SplitTables(rows, fname)
    isMonth = (InStr(fname, "月分") > 0)

    ' 誰のCSVか:どの表も「担当者」の列で見る。無ければファイル名(日報_名前_日付.csv)
    For t = 1 To tables.Count
        Set tb = tables(t)(1)
        If tb.Count >= 1 Then
            cWho = ColOf(tb(1), "担当者")
            For i = 2 To tb.Count
                w = Cell(tb(i), cWho)
                If w <> "" Then
                    If who = "" Then
                        who = w
                    ElseIf NoSpace(w) <> NoSpace(who) Then
                        gLog = gLog & "・" & fname & ":担当者が2人以上まざっているので、取り込みませんでした" & vbLf
                        Exit Function
                    End If
                End If
            Next i
        End If
    Next t
    If who = "" Then
        parts = Split(Left$(fname, Len(fname) - 4), "_")
        If UBound(parts) >= 2 Then who = parts(1)
    End If
    If who = "" Then gLog = gLog & "・" & fname & ":担当者が分からないので、取り込みませんでした" & vbLf: Exit Function
    who = NoSpace(who)
    If onlyWho <> "" Then
        If who <> NoSpace(onlyWho) Then ImportFile = 2: Exit Function
    End If

    Set ws = DBEngine.Workspaces(0)
    Set db = CurrentDb
    On Error GoTo FAIL
    ws.BeginTrans
    AddWho who
    For t = 1 To tables.Count
        Set tb = tables(t)(1)
        If Not ImportTable(db, CStr(tables(t)(0)), tb, fname, who, isMonth, n) Then ws.Rollback: Exit Function
    Next t
    db.Execute "INSERT INTO T_取込履歴 (日時, ファイル, 担当者, 件数) VALUES (Now(), " & Q(fname) & ", " & Q(who) & ", " & n & ")", dbFailOnError
    ws.CommitTrans
    ImportFile = 1
    Exit Function

FAIL:
    gLog = gLog & "・" & fname & ":途中で止まったので、取り込みませんでした(" & Err.Description & ")" & vbLf
    On Error Resume Next
    ws.Rollback
End Function

' 1つのCSV(アプリ v15 から)を、区切りの行 [訪問] [車両] [ToDo] [容器] ごとの表に分ける
'  区切りの行が無いときは、前の形(1つのファイルに1つの表)。表の種類は、ファイル名の頭で決める
'  戻り値: Array(種類, 行のCollection) の Collection
Private Function SplitTables(rows As Collection, ByVal fname As String) As Collection
    Dim res As New Collection, cur As Collection, kind As String, i As Long, r As Variant, t As String
    For i = 1 To rows.Count
        r = rows(i)
        t = ""
        If UBound(r) = 0 Then t = Trim$(r(0))
        If t = "[訪問]" Or t = "[車両]" Or t = "[ToDo]" Or t = "[容器]" Then
            If Not cur Is Nothing Then res.Add Array(kind, cur)
            kind = Mid$(t, 2, Len(t) - 2)
            Set cur = New Collection
        ElseIf Not cur Is Nothing Then
            cur.Add r
        End If
    Next i
    If Not cur Is Nothing Then res.Add Array(kind, cur)
    If res.Count = 0 Then
        kind = Left$(fname, InStr(fname, "_") - 1)
        If kind = "容器ログ" Then kind = "容器"
        res.Add Array(kind, rows)
    End If
    Set SplitTables = res
End Function

' 表を1つ入れる(訪問・車両・ToDo・容器)。n に入れた件数を足す。形が違うときは False(ファイルごと入れない)
'  エラーは、呼んだ ImportFile の FAIL で受ける(全部を取り消す)
Private Function ImportTable(db As DAO.Database, ByVal kind As String, rows As Collection, ByVal fname As String, _
        ByVal who As String, ByVal isMonth As Boolean, n As Long) As Boolean
    Dim head As Variant, r As Variant, i As Long, rs As DAO.Recordset, d As Variant, ym As Variant, months As Object
    ImportTable = True
    If rows.Count < 1 Then Exit Function
    head = rows(1)
    Select Case kind
    Case "訪問"
        Dim cD As Long, cS As Long, cE As Long, cT As Long, cA As Long, cAt As Long, cC As Long, cN As Long, cId As Long, cCode As Long, id As String
        cD = ColOf(head, "日付"): cS = ColOf(head, "開始時刻"): cE = ColOf(head, "終了時刻"): cT = ColOf(head, "訪問先")
        cA = ColOf(head, "面談者"): cAt = ColOf(head, "敬称"): cC = ColOf(head, "内容"): cN = ColOf(head, "特記事項")
        cId = ColOf(head, "ID"): cCode = ColOf(head, "顧客コード")
        If cD < 0 Or cT < 0 Then gLog = gLog & "・" & fname & ":訪問のCSVの形ではありません" & vbLf: ImportTable = False: Exit Function
        ' 月分のCSVなら、その月の訪問を、いったん全部消してから入れる(スマホで消した訪問も消える)
        If isMonth Then
            Set months = CreateObject("Scripting.Dictionary")
            For i = 2 To rows.Count
                If IsYmd(Cell(rows(i), cD)) Then months(Left$(Cell(rows(i), cD), 7)) = True
            Next i
            For Each ym In months.Keys
                db.Execute "DELETE FROM T_訪問 WHERE 担当者=" & Q(who) & " AND Format(日付,'yyyy-mm')='" & ym & "'", dbFailOnError
            Next ym
        End If
        Set rs = db.OpenRecordset("T_訪問", dbOpenDynaset)
        For i = 2 To rows.Count
            r = rows(i)
            d = Ymd(Cell(r, cD))
            If Not IsNull(d) Then
                id = Cell(r, cId)
                If id = "" Then id = Cell(r, cD) & "|" & Cell(r, cS) & "|" & Cell(r, cT)
                db.Execute "DELETE FROM T_訪問 WHERE 担当者=" & Q(who) & " AND 訪問ID=" & Q(id), dbFailOnError
                rs.AddNew
                rs!担当者 = who: rs!訪問ID = id: rs!日付 = d
                rs!開始 = Cell(r, cS): rs!終了 = Cell(r, cE)
                rs!顧客コード = Cell(r, cCode): rs!訪問先 = Cell(r, cT)
                rs!面談者 = Cell(r, cA) & Cell(r, cAt)
                rs!内容 = Cell(r, cC): rs!特記事項 = Cell(r, cN)
                rs!取込日時 = Now
                rs.Update
                n = n + 1
            End If
        Next i
        rs.Close
    Case "車両"
        Dim vD As Long, vDep As Long, vRet As Long, vFuel As Long, vDt As Long, vRt As Long, vWx As Long
        vD = ColOf(head, "日付"): vDep = ColOf(head, "出発距離"): vRet = ColOf(head, "帰社距離"): vFuel = ColOf(head, "給油量")
        vDt = ColOf(head, "出発時刻"): vRt = ColOf(head, "帰社時刻"): vWx = ColOf(head, "天気")
        If vD < 0 Then gLog = gLog & "・" & fname & ":車両のCSVの形ではありません" & vbLf: ImportTable = False: Exit Function
        Set rs = db.OpenRecordset("T_車両", dbOpenDynaset)
        For i = 2 To rows.Count
            r = rows(i)
            d = Ymd(Cell(r, vD))
            If Not IsNull(d) Then
                db.Execute "DELETE FROM T_車両 WHERE 担当者=" & Q(who) & " AND 日付=#" & Format(d, "yyyy/mm/dd") & "#", dbFailOnError
                rs.AddNew
                rs!担当者 = who: rs!日付 = d
                rs!出発時刻 = Cell(r, vDt): rs!帰社時刻 = Cell(r, vRt): rs!天気 = Cell(r, vWx)
                rs!出発距離 = Num(Cell(r, vDep)): rs!帰社距離 = Num(Cell(r, vRet)): rs!給油量 = Num(Cell(r, vFuel))
                rs!取込日時 = Now
                rs.Update
                n = n + 1
            End If
        Next i
        rs.Close
    Case "ToDo"
        Dim tS As Long, tT As Long, tC As Long, tId As Long, tReg As Long, tDone As Long, tCode As Long
        tS = ColOf(head, "状態"): tT = ColOf(head, "顧客名"): tC = ColOf(head, "内容")
        tId = ColOf(head, "ID"): tReg = ColOf(head, "登録日"): tDone = ColOf(head, "完了日")
        tCode = ColOf(head, "顧客コード")                  ' アプリ v14 から(古いCSVには無い → 空)
        If tId < 0 Or tReg < 0 Then
            gLog = gLog & "・" & fname & ":ToDoのCSVが古い形です(アプリを新しい版にしてください)" & vbLf
            Exit Function                                  ' この表だけ飛ばす(ほかの表は入れる)
        End If
        Set rs = db.OpenRecordset("T_ToDo", dbOpenDynaset)
        For i = 2 To rows.Count
            r = rows(i)
            If Cell(r, tId) <> "" Then
                db.Execute "DELETE FROM T_ToDo WHERE 担当者=" & Q(who) & " AND ToDoID=" & Q(Cell(r, tId)), dbFailOnError
                rs.AddNew
                rs!担当者 = who: rs!ToDoID = Cell(r, tId)
                rs!状態 = Cell(r, tS): rs!登録日 = Ymd(Cell(r, tReg)): rs!完了日 = Ymd(Cell(r, tDone))
                rs!顧客名 = Cell(r, tT): rs!内容 = Cell(r, tC)
                rs!顧客コード = Cell(r, tCode)
                rs!取込日時 = Now
                rs.Update
                n = n + 1
            End If
        Next i
        rs.Close
    Case "容器"
        ' 容器ログ(アプリ v15 から)。IDが無いので、キー = 日付|時刻|区分コード|記号|番号 で同じ記録を見分ける
        Dim kD As Long, kT As Long, kSc As Long, kSn As Long, kSym As Long, kNo As Long, kCode As Long, kCus As Long
        Dim kGc As Long, kGas As Long, kCap As Long, kUnit As Long, key As String
        kD = ColOf(head, "日付"): kT = ColOf(head, "時刻"): kSc = ColOf(head, "区分コード"): kSn = ColOf(head, "区分")
        kSym = ColOf(head, "記号"): kNo = ColOf(head, "番号"): kCode = ColOf(head, "顧客コード"): kCus = ColOf(head, "顧客名")
        kGc = ColOf(head, "ガス種コード"): kGas = ColOf(head, "ガス種"): kCap = ColOf(head, "容量"): kUnit = ColOf(head, "単位")
        If kD < 0 Or kNo < 0 Then gLog = gLog & "・" & fname & ":容器ログのCSVの形ではありません" & vbLf: ImportTable = False: Exit Function
        ' 月分のCSVなら、その月の容器ログを、いったん全部消してから入れる
        If isMonth Then
            Set months = CreateObject("Scripting.Dictionary")
            For i = 2 To rows.Count
                If IsYmd(Cell(rows(i), kD)) Then months(Left$(Cell(rows(i), kD), 7)) = True
            Next i
            For Each ym In months.Keys
                db.Execute "DELETE FROM T_容器ログ WHERE 担当者=" & Q(who) & " AND Format(日付,'yyyy-mm')='" & ym & "'", dbFailOnError
            Next ym
        End If
        Set rs = db.OpenRecordset("T_容器ログ", dbOpenDynaset)
        For i = 2 To rows.Count
            r = rows(i)
            d = Ymd(Cell(r, kD))
            If Not IsNull(d) Then
                key = Cell(r, kD) & "|" & Cell(r, kT) & "|" & Cell(r, kSc) & "|" & Cell(r, kSym) & "|" & Cell(r, kNo)
                db.Execute "DELETE FROM T_容器ログ WHERE 担当者=" & Q(who) & " AND キー=" & Q(key), dbFailOnError
                rs.AddNew
                rs!担当者 = who: rs!キー = key: rs!日付 = d: rs!時刻 = Cell(r, kT)
                rs!区分コード = Cell(r, kSc): rs!区分 = Cell(r, kSn): rs!記号 = Cell(r, kSym): rs!番号 = Cell(r, kNo)
                rs!顧客コード = Cell(r, kCode): rs!顧客名 = Cell(r, kCus)
                rs!ガス種コード = Cell(r, kGc): rs!ガス種 = Cell(r, kGas): rs!容量 = Num(Cell(r, kCap)): rs!単位 = Cell(r, kUnit)
                rs!取込日時 = Now
                rs.Update
                n = n + 1
            End If
        Next i
        rs.Close
    End Select
End Function

' 担当者が登録されていなければ足す
Private Sub AddWho(ByVal nm As String)
    nm = NoSpace(nm)
    If nm = "" Then Exit Sub
    If DCount("*", "T_担当者", "名前=" & Q(nm)) = 0 Then
        CurrentDb.Execute "INSERT INTO T_担当者 (名前, 登録日時) VALUES (" & Q(nm) & ", Now())", dbFailOnError
    End If
End Sub

' =====================================================================
'  営業日誌(Excel)を作る:日誌原紙のコピーに、その月の分を書く
'  すでにファイルがあれば、そこに書き直す(手で書いた日は触らない)
' =====================================================================
Public Function MakeNisshi(ByVal who As String, ByVal ym As String, Optional ByRef outPath As String) As String
    Dim xl As Object, wb As Object, path As String, tpl As String, isNew As Boolean
    Dim visits As Object, todos As Object, days As Object, k As Variant, ds As Object, last As Long, r As Long
    Dim rs As DAO.Recordset, v As Variant, dt As String

    gLog = ""
    outPath = ""
    ResetNames                                            ' 客先の今の名前を、読み直す
    tpl = TemplatePath()
    If Not FileExists(tpl) Then MakeNisshi = "日誌原紙が見つかりません。「初期設定用紙入れ」フォルダに「日誌原紙.xlsx」を入れてください。" & vbLf & tpl: Exit Function
    ' 年度のフォルダ(営業日誌\2026年度)に入れる(2026-11-25 から)
    path = AddSep(FyDir(ym)) & "営業日誌_" & Left$(ym, 4) & "年" & Mid$(ym, 6, 2) & "月_" & SafeName(who) & Mid$(tpl, InStrRev(tpl, "."))

    ' データを読む
    Set visits = CreateObject("Scripting.Dictionary")      ' 日付 → その日の訪問(時間の順)
    Set rs = CurrentDb.OpenRecordset("SELECT * FROM T_訪問 WHERE 担当者=" & Q(who) & " AND Format(日付,'yyyy-mm')='" & ym & "' ORDER BY 日付, 開始, 訪問ID", dbOpenSnapshot)
    Do Until rs.EOF
        dt = Format(rs!日付, "yyyy-mm-dd")
        If Not visits.Exists(dt) Then visits.Add dt, New Collection
        ' 行先は、顧客コードから今の名前にする(コードが無い客先は、入力した名前のまま)
        visits(dt).Add Array(dt, Nz(rs!開始, ""), Nz(rs!終了, ""), Nz(NowName(rs!顧客コード, rs!訪問先), ""), Nz(rs!面談者, ""), Nz(rs!内容, ""), Nz(rs!特記事項, ""), CStr(rs!訪問ID), Nz(rs!顧客コード, ""))
        rs.MoveNext
    Loop
    rs.Close
    Set todos = CreateObject("Scripting.Dictionary")       ' この月に登録・完了したToDo
    Set rs = CurrentDb.OpenRecordset("SELECT * FROM T_ToDo WHERE 担当者=" & Q(who) & " AND (Format(登録日,'yyyy-mm')='" & ym & "' OR Format(完了日,'yyyy-mm')='" & ym & "') ORDER BY 登録日, ToDoID", dbOpenSnapshot)
    Do Until rs.EOF
        todos(CStr(rs!ToDoID)) = Array(Nz(rs!状態, ""), YmdText(rs!登録日.Value), Nz(rs!顧客名, ""), Nz(rs!内容, ""), YmdText(rs!完了日.Value), CStr(rs!ToDoID), Nz(rs!顧客コード, ""))
        rs.MoveNext
    Loop
    rs.Close
    Dim ctList As New Collection                          ' この月の容器ログ(v15)
    Set rs = CurrentDb.OpenRecordset("SELECT * FROM T_容器ログ WHERE 担当者=" & Q(who) & " AND Format(日付,'yyyy-mm')='" & ym & "' ORDER BY 日付, 時刻, キー", dbOpenSnapshot)
    Do Until rs.EOF
        ctList.Add Array(Format(rs!日付, "yyyy-mm-dd"), Nz(rs!時刻, ""), Nz(rs!区分, ""), Nz(rs!記号, ""), Nz(rs!番号, ""), Nz(rs!顧客コード, ""), _
            Nz(NowName(rs!顧客コード, rs!顧客名), ""), Nz(rs!ガス種, ""), Nz(rs!容量, ""), Nz(rs!単位, ""))
        rs.MoveNext
    Loop
    rs.Close
    Dim cars As New Collection, dataDays As Object        ' 車両(出発・帰着・給油・天気)と、データのある日
    Set dataDays = CreateObject("Scripting.Dictionary")
    For Each k In visits.Keys
        dataDays(k) = True
    Next k
    Set rs = CurrentDb.OpenRecordset("SELECT * FROM T_車両 WHERE 担当者=" & Q(who) & " AND Format(日付,'yyyy-mm')='" & ym & "' ORDER BY 日付", dbOpenSnapshot)
    Do Until rs.EOF
        dt = Format(rs!日付, "yyyy-mm-dd")
        cars.Add Array(dt, Nz(rs!天気, ""), Nz(rs!出発時刻, ""), Nz(rs!帰社時刻, ""), rs!出発距離.Value, rs!帰社距離.Value, rs!給油量.Value)
        dataDays(dt) = True
        rs.MoveNext
    Loop
    rs.Close

    On Error GoTo FAIL
    Set xl = CreateObject("Excel.Application")
    xl.DisplayAlerts = False
    xl.ScreenUpdating = False
    If Not FileExists(path) Then
        FileCopy tpl, path
        SetAttr path, vbNormal                            ' 原紙の「読み取り専用」の印が写るので外す(営業日誌は書けるようにする)
        isNew = True
    End If
    Set wb = xl.Workbooks.Open(path, 0)
    ' 前の原紙(列が細かい形)で作ったファイルには書かない(書く場所がずれるため)
    If Not IsNewLayout(TemplateSheet(wb)) Then
        wb.Close False: Set wb = Nothing
        xl.Quit: Set xl = Nothing
        MakeNisshi = "・" & Mid$(path, InStrRev(path, "\") + 1) & " は、前の原紙の形です。書けませんでした。" & vbLf & _
                     "  このファイルをバックアップの場所に移してから、もう一度「営業日誌を作る」を押すと、新しい形で作り直します。" & vbLf
        Exit Function
    End If
    If isNew Or Not IsPrepared(wb) Then PrepareBook wb, ym, who
    EnsureKanri xl, wb, tpl                                ' 運転管理表が無い(前の原紙で作った)ファイルには、原紙から足す

    ' 日付のシートを作る(平日と、データがある休みの日。あるシートはそのまま)
    MakeDaySheets wb, ym, dataDays

    ' 前に書いた日(隠したシートに覚えてある)と、今回データのある日を、書き直す
    Set days = CreateObject("Scripting.Dictionary")
    Set ds = SheetOf(wb, DATA_SHEET)
    last = ds.Cells(ds.Rows.Count, 1).End(-4162).Row        ' -4162 = xlUp
    For r = 2 To last
        dt = YmdText(ds.Cells(r, 2).Value)
        If Left$(dt, 7) = ym Then days(dt) = True
    Next r
    For Each k In visits.Keys
        days(k) = True
    Next k
    For Each k In days.Keys
        If visits.Exists(k) Then WriteDay wb, CStr(k), visits(k), todos Else WriteDay wb, CStr(k), Nothing, todos
    Next k

    ' 覚えておく(次に作り直すとき、消えた訪問の日も書き直せるように)
    ds.Range("A2:H" & IIf(last < 2, 2, last)).ClearContents
    r = 2
    For Each k In visits.Keys
        For Each v In visits(k)
            ds.Range("A" & r & ":H" & r).Value = Array(v(7), v(0), v(1), v(2), v(3), v(4), v(5), v(6))
            r = r + 1
        Next v
    Next k

    ' 上長の承認を、確認印欄(BG列)に書く
    WriteApprovals wb, who, ym, visits

    ' 車両(出発・帰着・給油)と、「車両・天気」の一覧
    For Each v In cars
        WriteVehicle wb, CStr(v(0)), v(4), v(5), v(6)
    Next v
    WriteCarSheet wb, cars

    WriteTodoSheet wb, todos
    WriteCtSheet wb, ctList                                ' 容器ログ(v15)

    ' 土日・祝日・会社の休みは、データか手書きがある日だけ見せる。月に無い日(11月31日など)は隠す
    ShowDaySheets wb, ym, visits, cars

    ' 運転管理表:日付のシートから、出発・帰着・行先・給油を集めて書く
    Dim carNo As String
    carNo = Nz(DLookup("車両ナンバー", "T_担当者", "名前=" & Q(who)), "")
    If carNo = "" Then gLog = gLog & "・" & who & ":車両ナンバーが未登録です(メニューの「担当者の設定」で入れられます)" & vbLf
    FillKanri wb, ym, who, carNo

    ' 原紙が見ていた別のファイルへのつながりを切る(開くたびの「リンクの更新」を出さない)
    BreakLinks wb

    wb.Save
    wb.Close False
    Set wb = Nothing
    xl.Quit
    Set xl = Nothing
    outPath = path
    MakeNisshi = "・" & Mid$(path, InStrRev(path, "\") + 1) & " を作りました" & IIf(isNew, "", "(書き直し)") & vbLf & gLog
    Exit Function

FAIL:
    Dim em As String
    em = Err.Description
    On Error Resume Next
    If Not wb Is Nothing Then wb.Close False
    If Not xl Is Nothing Then xl.Quit
    MakeNisshi = "・" & who & " " & ym & ":途中で止まりました(" & em & ")" & vbLf & "  営業日誌のファイルを開いたままにしていないか確かめて、もう一度押してください。"
End Function

Private Function IsPrepared(wb As Object) As Boolean
    IsPrepared = Not (SheetOf(wb, TPL_SHEET) Is Nothing Or SheetOf(wb, DATA_SHEET) Is Nothing Or SheetOf(wb, TODO_SHEET) Is Nothing)
End Function

' 新しい原紙の形(1項目=1列)か。見出しの「行先」が F6、「確認印」が K6 にある
Private Function IsNewLayout(t As Object) As Boolean
    If t Is Nothing Then Exit Function
    IsNewLayout = (CStr(t.Range("F6").Value) = "行先" And CStr(t.Range("K6").Value) = "確認印")
End Function

' 新しい月のファイルの準備:1日分のひな形(担当者名・ToDo列)、ToDoリスト・データのシート
Private Sub PrepareBook(wb As Object, ByVal ym As String, ByVal nm As String)
    Dim ws As Object, t As Object

    ' 日誌原紙の1日分のシートを、隠したひな形「_ひな形」にする
    Set t = TemplateSheet(wb)
    If Not t Is Nothing Then
        If t.Name <> TPL_SHEET Then
            CleanTemplate t
            t.Name = TPL_SHEET
        End If
        t.Range(CELL_NAME).Value = nm                      ' 担当者氏名(コピーした日付のシートにも入る)
        t.Visible = 0                                      ' 0 = 隠す
    End If

    ' ToDoリスト(見えるシート)
    Set t = SheetOf(wb, TODO_SHEET)
    If t Is Nothing Then
        Set t = wb.Worksheets.Add(, wb.Worksheets(wb.Worksheets.Count))
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

    ' 書いた訪問のデータ(隠す)
    Set t = SheetOf(wb, DATA_SHEET)
    If t Is Nothing Then
        Set t = wb.Worksheets.Add(, wb.Worksheets(wb.Worksheets.Count))
        t.Name = DATA_SHEET
        t.Cells.NumberFormat = "@"
        t.Range("A1:H1").Value = Array("ID", "日付", "開始", "終了", "訪問先", "面談者", "内容", "特記事項")
        t.Visible = 0                                     ' 0 = 隠す
    End If
End Sub

' 1日分:表(7～24行)を消して、訪問を時間の順に書く(list が Nothing なら消すだけ)
Private Sub WriteDay(wb As Object, ByVal d As String, list As Collection, todos As Object)
    Dim ws As Object, i As Long, r As Long, v As Variant, n As Long
    Set ws = DaySheet(wb, CLng(Right$(d, 2)))
    If ws Is Nothing Then
        If list Is Nothing Then Exit Sub                   ' 訪問がなくなった休みの日(シートを作っていない)
        gLog = gLog & "・" & d & ":日付のシートが見つかりません" & vbLf: Exit Sub
    End If

    ' 表の中身を消す(No・「～」・確認印は残す)
    ws.Range(C_CODE & ROW_FIRST & ":" & C_START & ROW_LAST).ClearContents
    ws.Range(C_END & ROW_FIRST & ":" & C_NOTE & ROW_LAST).ClearContents
    If list Is Nothing Then Exit Sub

    n = list.Count
    For i = 1 To n
        If i > ROW_LAST - ROW_FIRST + 1 Then
            gLog = gLog & "・" & d & ":訪問が" & n & "件あり、" & (ROW_LAST - ROW_FIRST + 1) & "件を超えた分は書けませんでした" & vbLf
            Exit For
        End If
        v = list(i)
        r = ROW_FIRST + i - 1
        If v(8) <> "" Then ws.Range(C_CODE & r).Value = CStr(v(8))   ' 顧客コード(文字のまま。無い客先は空)
        PutTime ws.Range(C_START & r), v(1)
        PutTime ws.Range(C_END & r), v(2)
        ws.Range(C_PLACE & r).Value = v(3)
        ws.Range(C_PERSON & r).Value = v(4)
        ws.Range(C_YOUKEN & r).Value = v(5)
        ws.Range(C_TODO & r).Value = TodoText(todos, v(3), d, v(8))
        ws.Range(C_NOTE & r).Value = v(6)
    Next i
End Sub

' 容器ログのシート(v15):その月の容器ログを、日付・時刻の順に全部書き直す。容器ログが無い月は、シートを作らない
Private Sub WriteCtSheet(wb As Object, list As Collection)
    Dim t As Object, r As Long, last As Long, v As Variant
    Set t = SheetOf(wb, CT_SHEET)
    If t Is Nothing Then
        If list.Count = 0 Then Exit Sub
        Set t = wb.Worksheets.Add(After:=wb.Worksheets(wb.Worksheets.Count))
        t.Name = CT_SHEET
        t.Range("A1:J1").Value = Array("日付", "時刻", "区分", "記号", "番号", "顧客コード", "顧客名", "ガス種", "容量", "単位")
        t.Range("A1:J1").Font.Bold = True
        t.Columns("A").ColumnWidth = 11
        t.Columns("B").ColumnWidth = 6
        t.Columns("C").ColumnWidth = 8
        t.Columns("D").ColumnWidth = 6
        t.Columns("E").ColumnWidth = 9
        t.Columns("F").ColumnWidth = 10
        t.Columns("G").ColumnWidth = 26
        t.Columns("H").ColumnWidth = 14
        t.Columns("I").ColumnWidth = 6
        t.Columns("J").ColumnWidth = 5
    End If
    last = t.Cells(t.Rows.Count, 1).End(-4162).Row         ' -4162 = xlUp
    t.Range("A2:J" & IIf(last < 2, 2, last)).ClearContents
    t.Range("A:F").NumberFormat = "@"                      ' 日付・時刻・番号・顧客コードを、文字のまま残す
    r = 2
    For Each v In list
        t.Range("A" & r & ":J" & r).Value = v
        r = r + 1
    Next v
End Sub

' その日・その客先のToDo(登録した日 か 済ませた日)。済みも出す
'  客先は、顧客コードが同じ か 名前が同じ(ToDoの名前は短くしてあるので、コードでつなぐ)
Private Function TodoText(todos As Object, ByVal target As String, ByVal d As String, Optional ByVal code As String = "") As String
    Dim k As Variant, v As Variant, s As String, same As Boolean
    If target = "" And code = "" Then Exit Function
    For Each k In todos.Keys
        v = todos(k)
        same = (target <> "" And NoSpace(v(2)) = NoSpace(target))
        If Not same And code <> "" And UBound(v) >= 6 Then same = (CStr(v(6)) = code)
        If same And (v(1) = d Or v(4) = d) Then
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

Private Sub WriteVehicle(wb As Object, ByVal d As String, ByVal dep As Variant, ByVal ret As Variant, ByVal fuel As Variant)
    Dim ws As Object
    Set ws = DaySheet(wb, CLng(Right$(d, 2)))
    If ws Is Nothing Then Exit Sub
    If Not IsNull(dep) Then ws.Range(CELL_DEP).Value = dep
    If Not IsNull(ret) Then ws.Range(CELL_RET).Value = ret
    If Not IsNull(fuel) Then ws.Range(CELL_FUEL).Value = fuel
End Sub

' 日々のシートの表示・非表示
'  平日 … いつも見せる
'  土日・祝日・会社の休み … 訪問か車両のデータがある日、または手で書いてある日だけ見せる
'  その月に無い日(11月31日など) … 隠す
Private Sub ShowDaySheets(wb As Object, ByVal ym As String, visits As Object, cars As Collection)
    Dim y As Long, m As Long, nDays As Long, has As Object, k As Variant, ws As Object, d As Long, dt As Date, vis As Boolean
    y = CLng(Left$(ym, 4)): m = CLng(Mid$(ym, 6, 2))
    nDays = Day(DateSerial(y, m + 1, 0))
    Set has = CreateObject("Scripting.Dictionary")
    For Each k In visits.Keys
        has(k) = True
    Next k
    For Each k In cars
        has(k(0)) = True
    Next k
    For Each ws In wb.Worksheets
        d = DayOf(ws.Name)
        If d >= 1 And d <= 31 Then
            If d > nDays Then
                vis = False
            Else
                dt = DateSerial(y, m, d)
                If Not IsOffDay(dt) Then
                    vis = True
                Else
                    vis = has.Exists(Format(dt, "yyyy-mm-dd")) Or SheetHasContent(ws)
                End If
            End If
            ws.Visible = IIf(vis, -1, 0)                  ' -1 = 見せる、0 = 隠す
        End If
    Next ws
End Sub

' 日々のシートに、何か書いてあるか(表の7～24行と、出発・帰着・給油)
Private Function SheetHasContent(ws As Object) As Boolean
    Dim r As Long, c As Variant
    For r = ROW_FIRST To ROW_LAST
        For Each c In Array(C_START, C_END, C_PLACE, C_PERSON, C_YOUKEN, C_TODO, C_NOTE)
            If Trim$(CStr(ws.Range(c & r).MergeArea.Cells(1, 1).Value)) <> "" Then SheetHasContent = True: Exit Function
        Next c
    Next r
    For Each c In Array(CELL_DEP, CELL_RET, CELL_FUEL)
        If Trim$(CStr(ws.Range(c).MergeArea.Cells(1, 1).Value)) <> "" Then SheetHasContent = True: Exit Function
    Next c
End Function

' =====================================================================
'  日付のシートを、ひな形から作る
' =====================================================================
' 1日分のひな形のシート(「_ひな形」。まだなら、日誌原紙の1日分のシート)
Private Function TemplateSheet(wb As Object) As Object
    Dim ws As Object
    Set TemplateSheet = SheetOf(wb, TPL_SHEET)
    If Not TemplateSheet Is Nothing Then Exit Function
    For Each ws In wb.Worksheets
        If DayOf(ws.Name) = 0 And CStr(ws.Range("C6").Value) = "時間" And IsNewLayout(ws) Then
            Set TemplateSheet = ws: Exit Function
        End If
    Next ws
    ' 前の原紙の形(見出しの位置が違う)も、見つけるだけはする(IsNewLayout で断るため)
    For Each ws In wb.Worksheets
        If DayOf(ws.Name) = 0 And CStr(ws.Range("C6").Value) = "時間" Then
            Set TemplateSheet = ws: Exit Function
        End If
    Next ws
End Function

' ひな形の年月日を消す(日付のシートを作るときに書く)
Private Sub CleanTemplate(t As Object)
    t.Range(CELL_DATE).MergeArea.ClearContents
End Sub

' その月の日付のシートを作る:平日は全部。土日・祝日・会社の休みは、データがある日だけ
Private Sub MakeDaySheets(wb As Object, ByVal ym As String, dataDays As Object)
    Dim y As Long, m As Long, d As Long, dt As Date
    If SheetOf(wb, TPL_SHEET) Is Nothing Then Exit Sub    ' 前の形(1～31のシートがある)のときは作らない
    y = CLng(Left$(ym, 4)): m = CLng(Mid$(ym, 6, 2))
    For d = 1 To Day(DateSerial(y, m + 1, 0))
        dt = DateSerial(y, m, d)
        If Not IsOffDay(dt) Or dataDays.Exists(Format(dt, "yyyy-mm-dd")) Then EnsureDaySheet wb, y, m, d
    Next d
End Sub

' 日付のシートが無ければ、ひな形をコピーして作る(名前は「18(水)」。日付の順に並べる)
Private Function EnsureDaySheet(wb As Object, ByVal y As Long, ByVal m As Long, ByVal d As Long) As Object
    Dim t As Object, ws As Object, nx As Object, pv As Object, n As Object, wk As String, x As Long
    Set EnsureDaySheet = DaySheet(wb, d)
    If Not EnsureDaySheet Is Nothing Then Exit Function
    Set t = SheetOf(wb, TPL_SHEET)
    If t Is Nothing Then Exit Function
    ' 前後の日付のシートを探す
    For Each ws In wb.Worksheets
        x = DayOf(ws.Name)
        If x > d Then
            If nx Is Nothing Then
                Set nx = ws
            ElseIf x < DayOf(nx.Name) Then
                Set nx = ws
            End If
        ElseIf x > 0 Then
            If pv Is Nothing Then
                Set pv = ws
            ElseIf x > DayOf(pv.Name) Then
                Set pv = ws
            End If
        End If
    Next ws
    t.Visible = -1                                         ' 隠したままではコピーできないので、少しの間だけ見せる
    If Not nx Is Nothing Then
        t.Copy nx                                          ' 次の日のシートの前に入れる
        Set n = wb.Sheets(nx.Index - 1)
    Else
        If pv Is Nothing Then Set pv = t                   ' 最初の1枚は、ひな形のすぐ後ろ
        t.Copy , pv
        Set n = wb.Sheets(pv.Index + 1)
    End If
    t.Visible = 0
    wk = Mid$("日月火水木金土", Weekday(DateSerial(y, m, d)), 1)
    n.Name = d & "(" & wk & ")"
    n.Visible = -1
    n.Range(CELL_DATE).Value = y & "年" & m & "月" & d & "日(" & wk & ")"   ' 年月日(曜日)
    Set EnsureDaySheet = n
End Function

' =====================================================================
'  運転管理表:日付のシートの出発・帰着・行先・給油を、1日1行で書く
'  (新しい原紙の形「11行目＝1日」のときだけ。前の形の運転管理表は触らない)
' =====================================================================
Private Sub FillKanri(wb As Object, ByVal ym As String, ByVal who As String, ByVal carNo As String)
    Dim t As Object, ws As Object, y As Long, m As Long, nDays As Long, d As Long, r As Long, i As Long
    Dim dep As String, ret As String, fuel As String, s As String, nm As String
    Set t = SheetOf(wb, KANRI_SHEET)
    If t Is Nothing Then Exit Sub
    If CStr(t.Range("A10").Value) <> "日" Or CStr(t.Range("B10").Value) <> "始業時メーター" Then Exit Sub
    y = CLng(Left$(ym, 4)): m = CLng(Mid$(ym, 6, 2))
    nDays = Day(DateSerial(y, m + 1, 0))

    t.Range("A6").Value = "車両ナンバー（　" & carNo & "　）"
    t.Range("E8").Value = who                              ' 運転者
    t.Range("A11").Value = DateSerial(y, m, 1)             ' 1日(2日からは「前の行+1」の数式。「○月分」も A11 を見ている)
    For d = 1 To 31
        r = 10 + d
        t.Range("B" & r & ":F" & r).ClearContents
        If d > nDays Then
            t.Range("A" & r).ClearContents                 ' 月に無い日(11月31日など)
        Else
            If d > 1 Then t.Range("A" & r).Formula = "=A" & (r - 1) & "+1"
            Set ws = DaySheet(wb, d)
            If Not ws Is Nothing Then
                dep = CellText(ws, CELL_DEP): ret = CellText(ws, CELL_RET): fuel = CellText(ws, CELL_FUEL)
                s = ""                                     ' 主な行先:訪問先の頭5文字を「,」でつなぐ
                For i = ROW_FIRST To ROW_LAST
                    nm = CellText(ws, C_PLACE & i)
                    If nm <> "" Then s = s & IIf(s = "", "", ",") & Left$(nm, 5)
                Next i
                If dep <> "" Then t.Range("B" & r).Value = NumOrText(dep)
                If ret <> "" Then t.Range("C" & r).Value = NumOrText(ret)
                If s <> "" Then t.Range("D" & r).Value = s
                If IsNumeric(dep) And IsNumeric(ret) Then t.Range("E" & r).Value = CDbl(ret) - CDbl(dep)
                If fuel <> "" Then t.Range("F" & r).Value = NumOrText(fuel)
            End If
        End If
    Next d
    ' 合計距離 = 最後の終業 - 最初の始業。1リットル当たりは、給油がなければ空
    t.Range("C42").Formula = "=IF(COUNT(B11:C41)=0,"""",MAX(C11:C41)-MIN(B11:B41))"
    t.Range("E42").Formula = "=IF(N(F42)=0,"""",C42/F42)"
    t.Range("F42").Formula = "=SUM(F11:F41)"               ' 給油の合計(31日まで)
End Sub

' 月のファイルに運転管理表が無ければ、日誌原紙からコピーして足す(ToDoリストの前)
Private Sub EnsureKanri(xl As Object, wb As Object, ByVal tpl As String)
    Dim src As Object, ws As Object, bf As Object
    If Not SheetOf(wb, KANRI_SHEET) Is Nothing Then Exit Sub
    Set src = xl.Workbooks.Open(tpl, 0, True)              ' 読むだけで開く
    Set ws = SheetOf(src, KANRI_SHEET)
    If Not ws Is Nothing Then
        Set bf = SheetOf(wb, TODO_SHEET)
        If bf Is Nothing Then ws.Copy , wb.Worksheets(wb.Worksheets.Count) Else ws.Copy bf
        gLog = gLog & "・運転管理表が無かったので、日誌原紙から足しました" & vbLf
    End If
    src.Close False
End Sub

' セルの文字(結合したセルは左上。エラーや空は "")
Private Function CellText(ws As Object, ByVal addr As String) As String
    Dim v As Variant
    v = ws.Range(addr).MergeArea.Cells(1, 1).Value
    If IsError(v) Or IsEmpty(v) Or IsNull(v) Then Exit Function
    CellText = Trim$(CStr(v))
End Function

Private Function NumOrText(ByVal s As String) As Variant
    If IsNumeric(s) Then NumOrText = CDbl(s) Else NumOrText = s
End Function

' 別のファイルへのつながり(リンク)を切る(数式は、その時の値になる)
Private Sub BreakLinks(wb As Object)
    Dim v As Variant, i As Long
    On Error Resume Next
    v = wb.LinkSources(1)                                  ' 1 = Excel のリンク
    If IsArray(v) Then
        For i = LBound(v) To UBound(v)
            wb.BreakLink v(i), 1
        Next i
    End If
    On Error GoTo 0
End Sub

' 「車両・天気」のシート:その月の毎日の天気・出発/帰社の時刻・走った時間・距離・給油の一覧
Private Sub WriteCarSheet(wb As Object, cars As Collection)
    Const SN As String = "車両・天気"
    Dim t As Object, last As Long, r As Long, v As Variant, mins As Variant, km As Variant
    Dim sumMin As Long, sumKm As Double, sumFuel As Double
    Set t = SheetOf(wb, SN)
    If t Is Nothing Then
        Set t = wb.Worksheets.Add(, SheetOf(wb, TODO_SHEET))
        t.Name = SN
        t.Range("A1:J1").Value = Array("日付", "曜日", "天気", "出発時刻", "帰社時刻", "走った時間", "出発距離", "帰社距離", "走行距離", "給油")
        t.Range("A1:J1").Font.Bold = True
        t.Columns("A").ColumnWidth = 11
        t.Columns("B").ColumnWidth = 8
        t.Columns("C").ColumnWidth = 10
        t.Columns("D:F").ColumnWidth = 9
        t.Columns("G:J").ColumnWidth = 9
    End If
    last = t.Cells(t.Rows.Count, 1).End(-4162).Row
    t.Range("A2:J" & IIf(last < 2, 2, last)).Clear
    t.Range("A:F").NumberFormat = "@"
    r = 2
    For Each v In cars
        mins = RunMin(v(2), v(3))
        km = Null
        If Not IsNull(v(4)) And Not IsNull(v(5)) Then km = v(5) - v(4)
        t.Range("A" & r & ":J" & r).Value = Array(v(0), WeekLabel(Ymd(v(0))), v(1), v(2), v(3), Nz(HM(mins), ""), _
            Nz(v(4), ""), Nz(v(5), ""), Nz(km, ""), Nz(v(6), ""))
        If Not IsNull(mins) Then sumMin = sumMin + mins
        If Not IsNull(km) Then sumKm = sumKm + km
        If Not IsNull(v(6)) Then sumFuel = sumFuel + v(6)
        r = r + 1
    Next v
    t.Range("A" & r).Value = "合計"
    t.Range("F" & r).Value = HM(sumMin)
    t.Range("I" & r).Value = sumKm
    t.Range("J" & r).Value = sumFuel
    t.Range("A" & r & ":J" & r).Font.Bold = True
    t.Range("A" & r & ":J" & r).Borders(8).LineStyle = 1   ' 8 = 上の線
End Sub

' =====================================================================
'  休みの日(土日・祝日・会社の休み)
' =====================================================================
Public Function IsOffDay(ByVal d As Date) As Boolean
    If Weekday(d) = vbSaturday Or Weekday(d) = vbSunday Then IsOffDay = True: Exit Function
    If HolidayName(d) <> "" Then IsOffDay = True: Exit Function
    IsOffDay = IsCompanyOff(d)
End Function

' 会社の休み(T_会社休日 に入れた日)
Public Function IsCompanyOff(ByVal d As Date) As Boolean
    IsCompanyOff = (DCount("*", "T_会社休日", "日付=#" & Format(d, "yyyy/mm/dd") & "#") > 0)
End Function

' 曜日(「月」。祝日なら「月(祝)」、会社の休みなら「月(休)」)
Public Function WeekLabel(ByVal d As Variant) As String
    If IsNull(d) Or IsEmpty(d) Then Exit Function
    WeekLabel = Mid$("日月火水木金土", Weekday(d), 1)
    If HolidayName(d) <> "" Then
        WeekLabel = WeekLabel & "(祝)"
    ElseIf IsCompanyOff(d) Then
        WeekLabel = WeekLabel & "(休)"
    End If
End Function

' 祝日の名前(祝日でなければ "")。振替休日・国民の休日も含む
Public Function HolidayName(ByVal d As Date) As String
    Dim p As Date
    HolidayName = BaseHoliday(d)
    If HolidayName <> "" Then Exit Function
    ' 振替休日:日曜の祝日の後の、最初の祝日でない日
    p = d - 1
    Do While BaseHoliday(p) <> ""
        If Weekday(p) = vbSunday Then HolidayName = "振替休日": Exit Function
        p = p - 1
    Loop
    ' 国民の休日:祝日にはさまれた日
    If Weekday(d) <> vbSunday And BaseHoliday(d - 1) <> "" And BaseHoliday(d + 1) <> "" Then HolidayName = "国民の休日"
End Function

' 法律で決まった祝日(振替を除く)
Private Function BaseHoliday(ByVal d As Date) As String
    Dim y As Long, m As Long, dd As Long, nthMon As Long
    y = Year(d): m = Month(d): dd = Day(d)
    If Weekday(d) = vbMonday Then nthMon = (dd - 1) \ 7 + 1
    Select Case m
    Case 1
        If dd = 1 Then BaseHoliday = "元日"
        If nthMon = 2 Then BaseHoliday = "成人の日"
    Case 2
        If dd = 11 Then BaseHoliday = "建国記念の日"
        If dd = 23 Then BaseHoliday = "天皇誕生日"
    Case 3
        If dd = Int(20.8431 + 0.242194 * (y - 1980) - Int((y - 1980) / 4)) Then BaseHoliday = "春分の日"
    Case 4
        If dd = 29 Then BaseHoliday = "昭和の日"
    Case 5
        If dd = 3 Then BaseHoliday = "憲法記念日"
        If dd = 4 Then BaseHoliday = "みどりの日"
        If dd = 5 Then BaseHoliday = "こどもの日"
    Case 7
        If nthMon = 3 Then BaseHoliday = "海の日"
    Case 8
        If dd = 11 Then BaseHoliday = "山の日"
    Case 9
        If nthMon = 3 Then BaseHoliday = "敬老の日"
        If dd = Int(23.2488 + 0.242194 * (y - 1980) - Int((y - 1980) / 4)) Then BaseHoliday = "秋分の日"
    Case 10
        If nthMon = 2 Then BaseHoliday = "スポーツの日"
    Case 11
        If dd = 3 Then BaseHoliday = "文化の日"
        If dd = 23 Then BaseHoliday = "勤労感謝の日"
    End Select
End Function

' =====================================================================
'  走った時間(帰社時刻 - 出発時刻)。分で返す。分からなければ Null
' =====================================================================
Public Function RunMin(ByVal dep As Variant, ByVal ret As Variant) As Variant
    Dim a As Long, b As Long
    RunMin = Null
    If Not IsHm(Nz(dep, "")) Or Not IsHm(Nz(ret, "")) Then Exit Function
    a = Hour(TimeValue(dep)) * 60 + Minute(TimeValue(dep))
    b = Hour(TimeValue(ret)) * 60 + Minute(TimeValue(ret))
    If b >= a Then RunMin = b - a
End Function

' 分 → 「8:30」
Public Function HM(ByVal mins As Variant) As Variant
    HM = Null
    If IsNull(mins) Or IsEmpty(mins) Then Exit Function
    HM = (mins \ 60) & ":" & Format(mins Mod 60, "00")
End Function

Private Function IsHm(ByVal s As String) As Boolean
    IsHm = (s Like "#:##" Or s Like "##:##")
End Function

' ToDoリストのシートを、この月に登録・完了したToDoで書き直す(登録日の順)
Private Sub WriteTodoSheet(wb As Object, todos As Object)
    Dim t As Object, last As Long, k As Variant, v As Variant, r As Long
    Set t = SheetOf(wb, TODO_SHEET)
    last = t.Cells(t.Rows.Count, 6).End(-4162).Row
    t.Range("A2:F" & IIf(last < 2, 2, last)).ClearContents
    t.Range("B:B,E:E").NumberFormat = "@"
    r = 2
    For Each k In todos.Keys
        v = todos(k)
        t.Range("A" & r & ":F" & r).Value = Array(v(0), v(1), v(2), v(3), v(4), v(5))
        r = r + 1
    Next k
End Sub

' =====================================================================
'  客先の今の名前(2026-11-18)
'  顧客コードが同じ訪問のうち、いちばん新しい訪問の名前を「今の名前」にする
'  (客先の名前が変わっても、過去の日誌・分析が今の名前でそろう)
'  顧客コードが無いときや、見つからないときは、入力した名前のまま
' =====================================================================
Public Function NowName(ByVal code As Variant, ByVal nm As Variant) As Variant
    Dim c As String
    NowName = nm
    If IsNull(code) Then Exit Function
    c = Trim$(CStr(code))
    If c = "" Then Exit Function
    If gNames Is Nothing Then LoadNames
    If gNames.Exists(c) Then NowName = gNames(c)
End Function

' 全員の訪問を古い順に読み、新しい名前で上書きしていく
Private Sub LoadNames()
    Dim rs As DAO.Recordset
    Set gNames = CreateObject("Scripting.Dictionary")
    Set rs = CurrentDb.OpenRecordset("SELECT 顧客コード, 訪問先 FROM T_訪問 WHERE Nz(顧客コード,'')<>'' AND Nz(訪問先,'')<>'' " & _
                                     "ORDER BY 日付, 開始, 取込日時", dbOpenSnapshot)
    Do Until rs.EOF
        gNames(Trim$(CStr(rs!顧客コード))) = CStr(rs!訪問先)
        rs.MoveNext
    Loop
    rs.Close
End Sub

' 次に使うとき、読み直す(取り込んだ後など)
Private Sub ResetNames()
    Set gNames = Nothing
End Sub

' =====================================================================
'  上長の承認(2026-11-18)
'  ・担当者+日付で1件だけ(T_承認 のキー)。同じ日をもう一度承認したら置き換える=重複しない
'  ・承認した日は「まだ承認していない日」に出なくなる
'  ・営業日誌を作るとき、その日のシートの確認印欄(BG列)に「名字 月/日」を書く
'  ・取り消し・差し戻しは無し
' =====================================================================
Public Function BtnOpenApprove()
    If DCount("*", "T_上長") = 0 Then
        MsgBox "先に「上長の登録」で、承認する人の名前を入れてください。", vbExclamation, "営業日報"
        BtnBosses
        Exit Function
    End If
    DoCmd.OpenForm APPROVE_FORM
End Function

Public Function BtnBosses()
    DoCmd.OpenForm "F_上長", acFormDS
End Function

Public Function BtnCloseApprove()
    DoCmd.Close acForm, APPROVE_FORM
End Function

' 「承認する人」を押したとき、上長の一覧を読み直す(登録したばかりの人も選べるように)
Public Function BossListRefresh()
    On Error Resume Next
    Forms(APPROVE_FORM)!cbo上長.Requery
End Function

Public Function ApproveLoad()
    ApproveRefresh
End Function

' まだ承認していない日の一覧と、その日数を出し直す
Private Sub ApproveRefresh()
    Dim f As Form, n As Long
    Set f = Forms(APPROVE_FORM)
    f!lst待ち.Requery
    n = f!lst待ち.ListCount - 1                            ' 1行目は見出し
    If n < 0 Then n = 0
    f!lbl件数.Caption = "まだ承認していない日:" & n & " 日"
End Sub

Public Function BtnApproveAll()
    Dim lst As Control, i As Long
    Set lst = Forms(APPROVE_FORM)!lst待ち
    For i = 1 To lst.ListCount - 1                         ' 0 は見出し
        lst.Selected(i) = True
    Next i
End Function

Public Function BtnApprove()
    Dim f As Form, lst As Control, boss As Variant, i As Variant, key As String, who As String, d As Date
    Dim pos As Long, n As Long, months As Object, k As Variant, msg As String, db As DAO.Database
    Set f = Forms(APPROVE_FORM)
    boss = f!cbo上長
    If IsNull(boss) Then MsgBox "「承認する人」を選んでください。", vbExclamation, "営業日報": Exit Function
    Set lst = f!lst待ち
    If lst.ItemsSelected.Count = 0 Then MsgBox "承認する日を、押して選んでください。", vbExclamation, "営業日報": Exit Function
    If MsgBox(lst.ItemsSelected.Count & " 日分を、「" & boss & "」の名前で承認します。よろしいですか?", vbOKCancel + vbQuestion, "営業日報") <> vbOK Then Exit Function

    Set months = CreateObject("Scripting.Dictionary")     ' 書き直す営業日誌(担当者|年月)
    Set db = CurrentDb
    For Each i In lst.ItemsSelected
        key = CStr(lst.ItemData(i))                       ' 担当者|yyyy-mm-dd
        pos = InStrRev(key, "|")
        If pos > 1 Then
            who = Left$(key, pos - 1)
            d = DateSerial(CLng(Mid$(key, pos + 1, 4)), CLng(Mid$(key, pos + 6, 2)), CLng(Mid$(key, pos + 9, 2)))
            ' 同じ担当者・日付は1件だけ(あれば置き換える)
            db.Execute "DELETE FROM T_承認 WHERE 担当者=" & Q(who) & " AND 日付=" & SqlDate(d), dbFailOnError
            db.Execute "INSERT INTO T_承認 (担当者, 日付, 承認者, 承認日時) VALUES (" & Q(who) & ", " & SqlDate(d) & ", " & Q(CStr(boss)) & ", Now())", dbFailOnError
            months(who & "|" & Format(d, "yyyy-mm")) = True
            n = n + 1
        End If
    Next i
    ApproveRefresh
    If CurrentProject.AllForms("F_承認の一覧").IsLoaded Then Forms("F_承認の一覧").Requery

    msg = n & " 日分を承認しました。"
    If MsgBox(msg & vbLf & vbLf & "営業日誌(Excel)の確認印欄にも、今書きますか?" & vbLf & _
              "(「いいえ」でも、あとでメニューの「営業日誌を作る」を押せば書かれます)", vbYesNo + vbQuestion, "営業日報") <> vbYes Then Exit Function
    DoCmd.Hourglass True
    msg = ""
    For Each k In months.Keys
        pos = InStrRev(k, "|")
        msg = msg & MakeNisshi(Left$(k, pos - 1), Mid$(k, pos + 1)) & vbLf
    Next k
    DoCmd.Hourglass False
    If CurrentProject.AllForms(MENU).IsLoaded Then Forms(MENU)!txt結果 = Format(Now, "yyyy/mm/dd hh:nn") & vbCrLf & Replace(msg, vbLf, vbCrLf)
    MsgBox msg, vbInformation, "営業日報"
End Function

' 確認印欄に出す名字(T_上長 の「名字」。空なら、名前の空白の前。空白も無ければ名前のまま)
Private Function BossShort(ByVal nm As String) As String
    Dim s As String
    s = Trim$(Nz(DLookup("名字", "T_上長", "名前=" & Q(nm)), ""))
    If s = "" Then
        s = Trim$(Replace(nm, "　", " "))
        If InStr(s, " ") > 0 Then s = Left$(s, InStr(s, " ") - 1)
    End If
    BossShort = s
End Function

' その月の承認を、日付のシートの確認印欄(BG列)に書く
'  訪問がある行ぜんぶに「名字 月/日」。訪問が無い日(車両だけ)は、1行目だけ(確認印は C_STAMP の列)
'  承認した日の確認印欄は、書く前に消す(訪問の数が変わっても、ずれないように)。承認していない日は触らない
Private Sub WriteApprovals(wb As Object, ByVal who As String, ByVal ym As String, visits As Object)
    Dim rs As DAO.Recordset, ws As Object, d As String, txt As String, n As Long, r As Long, okAt As Date
    Set rs = CurrentDb.OpenRecordset("SELECT 日付, 承認者, 承認日時 FROM T_承認 WHERE 担当者=" & Q(who) & " AND Format(日付,'yyyy-mm')='" & ym & "'", dbOpenSnapshot)
    Do Until rs.EOF
        d = Format(rs!日付, "yyyy-mm-dd")
        Set ws = DaySheet(wb, Day(rs!日付))
        If Not ws Is Nothing Then
            If IsNull(rs!承認日時) Then okAt = rs!日付 Else okAt = rs!承認日時
            txt = BossShort(Nz(rs!承認者, "")) & " " & Month(okAt) & "/" & Day(okAt)
            n = 0
            If visits.Exists(d) Then n = visits(d).Count
            If n > ROW_LAST - ROW_FIRST + 1 Then n = ROW_LAST - ROW_FIRST + 1
            If n < 1 Then n = 1
            For r = ROW_FIRST To ROW_LAST
                ws.Range(C_STAMP & r).MergeArea.ClearContents
            Next r
            For r = ROW_FIRST To ROW_FIRST + n - 1
                ws.Range(C_STAMP & r).Value = txt
                With ws.Range(C_STAMP & r).MergeArea
                    .WrapText = False
                    .ShrinkToFit = True                      ' 欄が狭いので、文字を縮めて入れる
                    .HorizontalAlignment = -4108             ' 中央
                    .VerticalAlignment = -4108
                End With
            Next r
        End If
        rs.MoveNext
    Loop
    rs.Close
End Sub

' =====================================================================
'  小さな道具
' =====================================================================
' 日付をSQLの形にする(#2026/11/18#)
Private Function SqlDate(ByVal d As Date) As String
    SqlDate = "#" & Format(d, "yyyy\/mm\/dd") & "#"
End Function

Private Function Q(ByVal s As String) As String
    Q = "'" & Replace(s, "'", "''") & "'"
End Function

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

' 「2026-11-10」→ 日付。違う形なら Null
Private Function Ymd(ByVal s As String) As Variant
    Ymd = Null
    If IsYmd(s) Then Ymd = DateSerial(CLng(Left$(s, 4)), CLng(Mid$(s, 6, 2)), CLng(Right$(s, 2)))
End Function

Private Function YmdText(v As Variant) As String
    If IsNull(v) Or IsEmpty(v) Then Exit Function
    If VarType(v) = vbDate Then YmdText = Format(v, "yyyy-mm-dd") Else YmdText = CStr(v)
End Function

Private Function Num(ByVal s As String) As Variant
    If s <> "" And IsNumeric(s) Then Num = CDbl(s) Else Num = Null
End Function

Private Sub PutTime(rg As Object, ByVal s As String)
    If s = "" Then Exit Sub
    If s Like "#:##" Or s Like "##:##" Then
        rg.NumberFormat = "h:mm"
        rg.Value = TimeValue(s)
    Else
        rg.Value = s
    End If
End Sub

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

Private Function FileExists(ByVal p As String) As Boolean
    FileExists = CreateObject("Scripting.FileSystemObject").FileExists(p)
End Function

Private Function FolderExists(ByVal p As String) As Boolean
    FolderExists = CreateObject("Scripting.FileSystemObject").FolderExists(p)
End Function

' シート名の頭の数字(「10出勤簿」→10)。数字で始まらなければ 0
Private Function DayOf(ByVal sn As String) As Long
    Dim i As Long, num_ As String
    For i = 1 To Len(sn)
        If Mid$(sn, i, 1) Like "#" Then num_ = num_ & Mid$(sn, i, 1) Else Exit For
    Next i
    If num_ <> "" Then DayOf = CLng(num_)
End Function

Private Function DaySheet(wb As Object, ByVal d As Long) As Object
    Dim ws As Object
    For Each ws In wb.Worksheets
        If DayOf(ws.Name) = d Then Set DaySheet = ws: Exit Function
    Next ws
End Function

Private Function SheetOf(wb As Object, ByVal name As String) As Object
    On Error Resume Next
    Set SheetOf = wb.Worksheets(name)
    On Error GoTo 0
End Function

' 取り込んだCSVを「取り込み済み」へ移す(消さない。同じ名前があれば、時刻を付ける)
Private Sub MoveDone(ByVal dir_ As String, used As Collection)
    Dim doneDir As String, i As Long, src As String, dst As String
    doneDir = AddSep(dir_) & "取り込み済み"
    If Not FolderExists(doneDir) Then MkDir doneDir
    For i = 1 To used.Count
        src = AddSep(dir_) & used(i)
        dst = AddSep(doneDir) & used(i)
        If FileExists(dst) Then dst = AddSep(doneDir) & Format(Now, "yyyymmdd_hhnnss_") & used(i)
        Name src As dst
    Next i
End Sub
