Option Compare Database
Option Explicit
' =====================================================================
'  営業日報.accdb を組み立てる / 新しい版にする
'  ・表は、無いものだけ作る(ためたデータは消さない)。足りない列は足す
'  ・分析のクエリと画面(メニュー・分析)は、作り直す(データは入っていない)
' =====================================================================

Public Function BuildAll() As String
    Dim stepName As String
    On Error GoTo FAIL
    stepName = "画面を閉じる": CloseAllForms
    stepName = "表": MakeTables
    stepName = "古いクエリ・画面を外す": DropObjects
    stepName = "クエリ": MakeQueries
    stepName = "画面"
    MakeViewForm "F_訪問回数", "Q_訪問回数", "訪問回数(客先×月)", "合計 DESC", False
    MakeViewForm "F_訪問の一覧", "Q_訪問の一覧", "訪問の一覧", "", False
    MakeViewForm "F_走行距離", "Q_走行距離", "走行距離・走った時間(月別)", "", False
    MakeViewForm "F_車両の一覧", "Q_車両の一覧", "車両・天気の一覧(毎日)", "", False
    MakeViewForm "F_ToDo未対応", "Q_ToDo未対応", "ToDo 未対応", "", False
    MakeViewForm "F_ToDo日数", "Q_ToDo日数", "ToDo 済ませるまでの日数(月別)", "", False
    MakeViewForm "F_ToDo客先別", "Q_ToDo客先別", "ToDo 客先別の件数", "件数 DESC", False
    MakeViewForm "F_容器ログ", "Q_容器ログ", "容器ログの一覧", "", False
    MakeViewForm "F_会社休日", "Q_会社休日", "会社の休み(年末年始・お盆など)", "", True
    MakeViewForm "F_担当者", "Q_担当者", "担当者の設定(車両ナンバー。運転管理表に出ます)", "", True
    MakeViewForm "F_上長", "Q_上長", "上長の登録(名字は確認印欄に出ます。空なら名前の空白の前)", "", True
    MakeViewForm "F_承認の一覧", "Q_承認の一覧", "承認済みの日の一覧", "", False
    MakeApproveForm
    MakeMenu
    SetStartup
    BuildAll = "OK"
    Exit Function
FAIL:
    BuildAll = "止まりました(" & stepName & "):" & Err.Number & " " & Err.Description
End Function

Private Sub CloseAllForms()
    Do While Forms.Count > 0
        DoCmd.Close acForm, Forms(0).Name, acSaveNo
    Loop
End Sub

' 作り直すもの(クエリ Q_ と画面 F_)を、いったん外す
Private Sub DropObjects()
    Dim i As Long, nm As String, db As DAO.Database
    Set db = CurrentDb
    For i = db.QueryDefs.Count - 1 To 0 Step -1
        nm = db.QueryDefs(i).Name
        If Left$(nm, 2) = "Q_" Then DoCmd.DeleteObject acQuery, nm
    Next i
    For i = CurrentProject.AllForms.Count - 1 To 0 Step -1
        nm = CurrentProject.AllForms(i).Name
        If Left$(nm, 2) = "F_" Then DoCmd.DeleteObject acForm, nm
    Next i
End Sub

' ---------------------------------------------------------------------
'  表(無いものだけ作る)
' ---------------------------------------------------------------------
Private Sub MakeTables()
    Dim db As DAO.Database
    Set db = CurrentDb
    If Not HasTable("T_担当者") Then db.Execute "CREATE TABLE T_担当者 (名前 TEXT(50) CONSTRAINT pk_who PRIMARY KEY, 登録日時 DATETIME)"
    If Not HasField("T_担当者", "車両ナンバー") Then db.Execute "ALTER TABLE T_担当者 ADD COLUMN 車両ナンバー TEXT(50)"
    If Not HasTable("T_訪問") Then
        db.Execute "CREATE TABLE T_訪問 (担当者 TEXT(50) NOT NULL, 訪問ID TEXT(100) NOT NULL, 日付 DATETIME, 開始 TEXT(10), 終了 TEXT(10), " & _
                   "顧客コード TEXT(50), 訪問先 TEXT(255), 面談者 TEXT(255), 内容 MEMO, 特記事項 MEMO, 取込日時 DATETIME, " & _
                   "CONSTRAINT pk_visit PRIMARY KEY (担当者, 訪問ID))"
        db.Execute "CREATE INDEX ix_visit_day ON T_訪問 (担当者, 日付)"
    End If
    If Not HasTable("T_車両") Then
        db.Execute "CREATE TABLE T_車両 (担当者 TEXT(50) NOT NULL, 日付 DATETIME NOT NULL, 出発時刻 TEXT(10), 出発距離 DOUBLE, " & _
                   "帰社時刻 TEXT(10), 帰社距離 DOUBLE, 給油量 DOUBLE, 天気 TEXT(50), 取込日時 DATETIME, CONSTRAINT pk_car PRIMARY KEY (担当者, 日付))"
    End If
    If Not HasField("T_車両", "天気") Then db.Execute "ALTER TABLE T_車両 ADD COLUMN 天気 TEXT(50)"
    If Not HasTable("T_ToDo") Then
        db.Execute "CREATE TABLE T_ToDo (担当者 TEXT(50) NOT NULL, ToDoID TEXT(100) NOT NULL, 状態 TEXT(20), 登録日 DATETIME, " & _
                   "顧客名 TEXT(255), 内容 MEMO, 完了日 DATETIME, 取込日時 DATETIME, CONSTRAINT pk_todo PRIMARY KEY (担当者, ToDoID))"
    End If
    If Not HasField("T_ToDo", "顧客コード") Then db.Execute "ALTER TABLE T_ToDo ADD COLUMN 顧客コード TEXT(50)"
    If Not HasTable("T_取込履歴") Then db.Execute "CREATE TABLE T_取込履歴 (番号 COUNTER CONSTRAINT pk_log PRIMARY KEY, 日時 DATETIME, ファイル TEXT(255), 担当者 TEXT(50), 件数 LONG)"
    If Not HasTable("T_会社休日") Then db.Execute "CREATE TABLE T_会社休日 (日付 DATETIME CONSTRAINT pk_off PRIMARY KEY, メモ TEXT(100))"
    ' 容器ログ(アプリ v15 から)。IDが無いので、キー = 日付|時刻|区分コード|記号|番号 で同じ記録を見分ける
    If Not HasTable("T_容器ログ") Then
        db.Execute "CREATE TABLE T_容器ログ (担当者 TEXT(50) NOT NULL, キー TEXT(200) NOT NULL, 日付 DATETIME, 時刻 TEXT(10), " & _
                   "区分コード TEXT(10), 区分 TEXT(30), 記号 TEXT(30), 番号 TEXT(50), 顧客コード TEXT(50), 顧客名 TEXT(255), " & _
                   "ガス種コード TEXT(20), ガス種 TEXT(50), 容量 DOUBLE, 単位 TEXT(10), 取込日時 DATETIME, " & _
                   "CONSTRAINT pk_ct PRIMARY KEY (担当者, キー))"
        db.Execute "CREATE INDEX ix_ct_day ON T_容器ログ (担当者, 日付)"
    End If
    ' 上長の承認(2026-11-18)。担当者+日付で1件だけ(重複しない)
    If Not HasTable("T_上長") Then db.Execute "CREATE TABLE T_上長 (名前 TEXT(50) CONSTRAINT pk_boss PRIMARY KEY, 名字 TEXT(20))"
    If Not HasTable("T_承認") Then
        db.Execute "CREATE TABLE T_承認 (担当者 TEXT(50) NOT NULL, 日付 DATETIME NOT NULL, 承認者 TEXT(50), 承認日時 DATETIME, " & _
                   "CONSTRAINT pk_ok PRIMARY KEY (担当者, 日付))"
    End If
    db.TableDefs.Refresh
End Sub

Private Function HasTable(ByVal nm As String) As Boolean
    Dim db As DAO.Database, t As DAO.TableDef
    Set db = CurrentDb                    ' 変数に入れてから回す(CurrentDb のまま回すと止まる)
    For Each t In db.TableDefs
        If t.Name = nm Then HasTable = True: Exit Function
    Next t
End Function

Private Function HasField(ByVal tbl As String, ByVal fld As String) As Boolean
    Dim db As DAO.Database, f As DAO.Field
    Set db = CurrentDb
    For Each f In db.TableDefs(tbl).Fields
        If f.Name = fld Then HasField = True: Exit Function
    Next f
End Function

' ---------------------------------------------------------------------
'  分析のクエリ(メニューで選んだ担当者・年で絞る)
' ---------------------------------------------------------------------
Private Sub MakeQueries()
    Dim m As String, i As Long
    For i = 1 To 12
        m = m & IIf(i > 1, ",", "") & """" & i & "月"""
    Next i
    ' 客先の名前は、顧客コードから今の名前(いちばん新しい訪問の名前)を引く(NowName)。
    '  別名と同じ列名を式の中で使うと循環参照(3103)になるので、列は「表名.列名」で書く
    AddQuery "Q_訪問回数", _
        "TRANSFORM Count(*) AS 回数 SELECT T_訪問.顧客コード, NowName(T_訪問.顧客コード,T_訪問.訪問先) AS 訪問先, Count(*) AS 合計 FROM T_訪問 " & _
        "WHERE WhoOk([担当者]) AND Year([日付])=SelYear() GROUP BY T_訪問.顧客コード, NowName(T_訪問.顧客コード,T_訪問.訪問先) " & _
        "PIVOT Month([日付]) & ""月"" IN (" & m & ")"
    AddQuery "Q_訪問の一覧", _
        "SELECT 担当者, 日付, 開始, 終了, T_訪問.顧客コード, NowName(T_訪問.顧客コード,T_訪問.訪問先) AS 訪問先, 面談者, 内容, 特記事項 FROM T_訪問 " & _
        "WHERE WhoOk([担当者]) AND Year([日付])=SelYear() ORDER BY 日付 DESC, 開始, 担当者"
    AddQuery "Q_走行距離", _
        "SELECT 担当者, Format([日付],'yyyy/mm') AS 月, Count(*) AS 走った日数, Sum([帰社距離]-[出発距離]) AS 走行距離km, " & _
        "HM(Sum(RunMin([出発時刻],[帰社時刻]))) AS 走った時間, HM(Round(Avg(RunMin([出発時刻],[帰社時刻])),0)) AS 一日の平均時間, " & _
        "Sum(給油量) AS 給油L FROM T_車両 WHERE WhoOk([担当者]) AND Year([日付])=SelYear() " & _
        "GROUP BY 担当者, Format([日付],'yyyy/mm') ORDER BY 担当者, Format([日付],'yyyy/mm')"
    AddQuery "Q_車両の一覧", _
        "SELECT 担当者, 日付, WeekLabel([日付]) AS 曜日, 天気, 出発時刻, 帰社時刻, HM(RunMin([出発時刻],[帰社時刻])) AS 走った時間, " & _
        "出発距離, 帰社距離, [帰社距離]-[出発距離] AS 走行距離, 給油量 FROM T_車両 " & _
        "WHERE WhoOk([担当者]) AND Year([日付])=SelYear() ORDER BY 日付 DESC, 担当者"
    AddQuery "Q_ToDo未対応", _
        "SELECT 担当者, 登録日, T_ToDo.顧客コード, NowName(T_ToDo.顧客コード,T_ToDo.顧客名) AS 顧客名, 内容, Date()-[登録日] AS 経過日数 FROM T_ToDo " & _
        "WHERE Nz([状態],'')<>'済' AND WhoOk([担当者]) ORDER BY 登録日, 担当者"
    AddQuery "Q_ToDo日数", _
        "SELECT 担当者, Format([完了日],'yyyy/mm') AS 完了月, Count(*) AS 済ませた件数, " & _
        "Round(Avg([完了日]-[登録日]),1) AS 平均日数, Max([完了日]-[登録日]) AS 一番長い日数 FROM T_ToDo " & _
        "WHERE 状態='済' AND 完了日 Is Not Null AND 登録日 Is Not Null AND WhoOk([担当者]) AND Year([完了日])=SelYear() " & _
        "GROUP BY 担当者, Format([完了日],'yyyy/mm') ORDER BY 担当者, Format([完了日],'yyyy/mm')"
    AddQuery "Q_ToDo客先別", _
        "SELECT IIf(Nz(NowName(T_ToDo.顧客コード,T_ToDo.顧客名),'')='','(客先なし)',NowName(T_ToDo.顧客コード,T_ToDo.顧客名)) AS 客先, Max(T_ToDo.顧客コード) AS 顧客コード, Count(*) AS 件数, Sum(IIf(Nz([状態],'')<>'済',1,0)) AS 未対応, Sum(IIf([状態]='済',1,0)) AS 済 " & _
        "FROM T_ToDo WHERE WhoOk([担当者]) AND Year([登録日])=SelYear() GROUP BY IIf(Nz(NowName(T_ToDo.顧客コード,T_ToDo.顧客名),'')='','(客先なし)',NowName(T_ToDo.顧客コード,T_ToDo.顧客名))"
    AddQuery "Q_容器ログ", _
        "SELECT 担当者, 日付, 時刻, 区分, 記号, 番号, T_容器ログ.顧客コード, NowName(T_容器ログ.顧客コード,T_容器ログ.顧客名) AS 顧客名, ガス種, 容量, 単位 FROM T_容器ログ " & _
        "WHERE WhoOk([担当者]) AND Year([日付])=SelYear() ORDER BY 日付 DESC, 時刻 DESC, 担当者"
    AddQuery "Q_会社休日", "SELECT 日付, メモ FROM T_会社休日 ORDER BY 日付"
    AddQuery "Q_担当者", "SELECT 名前, 車両ナンバー FROM T_担当者 ORDER BY 名前"
    ' 上長の承認(2026-11-18)
    AddQuery "Q_上長", "SELECT 名前, 名字 FROM T_上長 ORDER BY 名前"
    ' まだ承認していない日:訪問か車両のデータがある日で、T_承認 に無い日(メニューで選んだ担当者だけ)
    '  1列目(隠す)= 担当者|yyyy-mm-dd(承認するときに使う)
    AddQuery "Q_承認待ち", _
        "SELECT u.担当者 & '|' & Format(u.日付,'yyyy-mm-dd') AS キー, u.担当者, " & _
        "Format(u.日付,'yyyy/mm/dd') & ' (' & WeekLabel(u.日付) & ')' AS 日付と曜日, Nz(c.件数,0) AS 訪問件数 " & _
        "FROM ((SELECT 担当者, 日付 FROM T_訪問 UNION SELECT 担当者, 日付 FROM T_車両) AS u " & _
        "LEFT JOIN (SELECT 担当者, 日付, Count(*) AS 件数 FROM T_訪問 GROUP BY 担当者, 日付) AS c ON (u.担当者=c.担当者 AND u.日付=c.日付)) " & _
        "LEFT JOIN T_承認 AS a ON (u.担当者=a.担当者 AND u.日付=a.日付) " & _
        "WHERE a.担当者 Is Null AND u.日付 Is Not Null AND WhoOk(u.担当者) ORDER BY u.日付, u.担当者"
    AddQuery "Q_承認の一覧", _
        "SELECT 担当者, 日付, WeekLabel([日付]) AS 曜日, 承認者, 承認日時 FROM T_承認 " & _
        "WHERE WhoOk([担当者]) AND Year([日付])=SelYear() ORDER BY 日付 DESC, 担当者"
End Sub

Private Sub AddQuery(ByVal nm As String, ByVal sql As String)
    CurrentDb.CreateQueryDef nm, sql
End Sub

' ---------------------------------------------------------------------
'  分析の画面(表の形)。canEdit=False なら見るだけ
' ---------------------------------------------------------------------
Private Sub MakeViewForm(ByVal nm As String, ByVal qry As String, ByVal cap As String, ByVal ord As String, ByVal canEdit As Boolean)
    Dim f As Form, c As Control, fld As DAO.Field, tmp As String, x As Long, w As Long, db As DAO.Database
    Set db = CurrentDb
    Set f = CreateForm()
    f.RecordSource = qry
    f.Caption = cap
    f.DefaultView = 2                     ' 2 = データシート
    f.ViewsAllowed = 2
    f.AllowEdits = canEdit
    f.AllowAdditions = canEdit
    f.AllowDeletions = canEdit
    f.DatasheetFontName = "Meiryo UI"
    f.DatasheetFontHeight = 10
    If ord <> "" Then f.OrderBy = ord: f.OrderByOn = True
    x = 100
    For Each fld In db.QueryDefs(qry).Fields
        Select Case fld.Name
        Case "内容", "特記事項": w = 5000
        Case "訪問先", "顧客名", "面談者", "客先", "メモ": w = 2600
        Case "日付", "登録日", "担当者", "名前", "車両ナンバー", "顧客コード", "承認者", "名字": w = 1800
        Case "承認日時": w = 2400
        Case Else: w = 1100
        End Select
        Set c = CreateControl(f.Name, acTextBox, acDetail, , fld.Name, x, 100, w, 300)
        c.Name = fld.Name
        c.ColumnWidth = w
        If fld.Name = "日付" Or fld.Name = "登録日" Then c.Format = "yyyy/mm/dd"
        If fld.Name = "承認日時" Then c.Format = "yyyy/mm/dd hh:nn"
        x = x + w + 50
    Next fld
    tmp = f.Name
    DoCmd.Close acForm, tmp, acSaveYes
    DoCmd.Rename nm, acForm, tmp
End Sub

' ---------------------------------------------------------------------
'  メニュー
' ---------------------------------------------------------------------
Private Sub MakeMenu()
    Dim f As Form, tmp As String, c As Control
    Const CM As Long = 567                ' 1cm(この単位で位置を決める)
    Set f = CreateForm()
    f.Caption = "営業日報"
    f.RecordSelectors = False
    f.NavigationButtons = False
    f.DividingLines = False
    f.ScrollBars = 0
    f.AutoCenter = True
    f.OnLoad = "=MenuLoad()"
    f.Width = 17 * CM
    f.Section(acDetail).Height = 19.5 * CM
    f.Section(acDetail).BackColor = RGB(255, 255, 255)
    tmp = f.Name

    Lbl tmp, "営業日報(取り込み・営業日誌・分析)", 0.5, 0.3, 14, 0.8, 14, True

    Lbl tmp, "担当者", 0.5, 1.4, 2, 0.6, 11, True
    Set c = CreateControl(tmp, acComboBox, acDetail, , , 2.6 * CM, 1.4 * CM, 5 * CM, 0.6 * CM)
    c.Name = "cbo担当者": c.RowSourceType = "Value List": c.LimitToList = True: c.FontSize = 11
    c.AfterUpdate = "=AfterSel()"
    Btn tmp, "担当者を追加", "=BtnAddWho()", 7.9, 1.4, 3, 0.6
    Btn tmp, "担当者の設定(車両No.)", "=BtnWhoSettings()", 11.1, 1.4, 4.4, 0.6
    Lbl tmp, "(全員)を選ぶと全員分。名前を選ぶと、その人の分だけになります", 0.5, 2.05, 15, 0.5, 9, False

    Lbl tmp, "1. 取り込み(CSVフォルダのCSVを入れる)", 0.5, 2.9, 15, 0.6, 11, True
    Btn tmp, "自分の分を取り込む", "=BtnImportMine()", 0.8, 3.6, 4.6, 0.8
    Btn tmp, "まとめて取り込む(全員)", "=BtnImportAll()", 5.6, 3.6, 4.6, 0.8
    Btn tmp, "CSVフォルダを開く", "=BtnOpenCsv()", 10.4, 3.6, 4.6, 0.8

    Lbl tmp, "2. 営業日誌(今までと同じ書式のExcel。印刷はExcelで)", 0.5, 4.8, 15, 0.6, 11, True
    Lbl tmp, "年月", 0.8, 5.55, 1.2, 0.6, 11, False
    Set c = CreateControl(tmp, acComboBox, acDetail, , , 2 * CM, 5.5 * CM, 3.4 * CM, 0.6 * CM)
    c.Name = "cbo年月": c.RowSourceType = "Value List": c.ColumnCount = 2: c.BoundColumn = 1
    c.ColumnWidths = "0;3cm": c.LimitToList = True: c.FontSize = 11
    Btn tmp, "営業日誌を作る", "=BtnMake()", 5.6, 5.45, 4.6, 0.8
    Btn tmp, "日誌フォルダを開く", "=BtnOpenOut()", 10.4, 5.45, 4.6, 0.8
    Btn tmp, "会社の休みを入れる(年末年始など)", "=BtnHolidays()", 5.6, 6.4, 9.4, 0.7
    Lbl tmp, "土日・祝日・会社の休みのシートは、データがある日だけ出します", 0.8, 7.15, 15, 0.5, 9, False

    Lbl tmp, "3. 分析(上の担当者で分かれます)", 0.5, 7.9, 9, 0.6, 11, True
    Lbl tmp, "年", 9.6, 7.9, 0.8, 0.6, 11, False
    Set c = CreateControl(tmp, acComboBox, acDetail, , , 10.4 * CM, 7.9 * CM, 2.2 * CM, 0.6 * CM)
    c.Name = "cbo年": c.RowSourceType = "Value List": c.LimitToList = True: c.FontSize = 11
    c.AfterUpdate = "=AfterSel()"
    Btn tmp, "訪問回数(客先×月)", "=BtnView(""F_訪問回数"")", 0.8, 8.7, 4.6, 0.8
    Btn tmp, "訪問の一覧", "=BtnView(""F_訪問の一覧"")", 5.6, 8.7, 4.6, 0.8
    Btn tmp, "走行距離・時間(月別)", "=BtnView(""F_走行距離"")", 10.4, 8.7, 4.6, 0.8
    Btn tmp, "車両・天気の一覧(毎日)", "=BtnView(""F_車両の一覧"")", 0.8, 9.7, 4.6, 0.8
    Btn tmp, "ToDo 未対応", "=BtnView(""F_ToDo未対応"")", 5.6, 9.7, 4.6, 0.8
    Btn tmp, "ToDo 済ませるまでの日数", "=BtnView(""F_ToDo日数"")", 10.4, 9.7, 4.6, 0.8
    Btn tmp, "ToDo 客先別の件数", "=BtnView(""F_ToDo客先別"")", 0.8, 10.7, 4.6, 0.8
    Btn tmp, "容器ログの一覧", "=BtnView(""F_容器ログ"")", 5.6, 10.7, 4.6, 0.8
    ' 今開いている分析をExcelで見るボタン(2行・Excelの緑)
    Set c = Btn(tmp, "今開いた「分析」を" & vbCrLf & "Excelで表示する", "=BtnExport()", 10.4, 10.7, 4.6, 0.95)
    ExcelColor c

    ' 4. 上長の承認(2026-11-18)
    Lbl tmp, "4. 上長の承認(1日ごと。承認は営業日誌の確認印欄に出ます)", 0.5, 11.9, 15, 0.6, 11, True
    Btn tmp, "日報を承認する(上長)", "=BtnOpenApprove()", 0.8, 12.6, 4.6, 0.8
    Btn tmp, "承認済みの一覧", "=BtnView(""F_承認の一覧"")", 5.6, 12.6, 4.6, 0.8
    Btn tmp, "上長の登録", "=BtnBosses()", 10.4, 12.6, 4.6, 0.8

    Lbl tmp, "前回の結果", 0.5, 13.8, 4, 0.6, 11, True
    Set c = CreateControl(tmp, acTextBox, acDetail, , , 0.5 * CM, 14.5 * CM, 15.5 * CM, 4.4 * CM)
    c.Name = "txt結果": c.Locked = True: c.ScrollBars = 2: c.FontSize = 10: c.BackColor = RGB(245, 245, 245)

    DoCmd.Close acForm, tmp, acSaveYes
    DoCmd.Rename "F_メニュー", acForm, tmp
End Sub

' ---------------------------------------------------------------------
'  承認の画面(上長が使う)
'   承認する人を選ぶ → まだ承認していない日を押して選ぶ → 「選んだ日を承認する」
' ---------------------------------------------------------------------
Private Sub MakeApproveForm()
    Dim f As Form, tmp As String, c As Control
    Const CM As Long = 567
    Set f = CreateForm()
    f.Caption = "日報の承認"
    f.RecordSelectors = False
    f.NavigationButtons = False
    f.DividingLines = False
    f.ScrollBars = 0
    f.AutoCenter = True
    f.OnLoad = "=ApproveLoad()"
    f.Width = 14 * CM
    f.Section(acDetail).Height = 15.5 * CM
    f.Section(acDetail).BackColor = RGB(255, 255, 255)
    tmp = f.Name

    Lbl tmp, "日報の承認(上長)", 0.5, 0.3, 10, 0.8, 14, True

    Lbl tmp, "承認する人", 0.5, 1.4, 2.4, 0.6, 11, True
    Set c = CreateControl(tmp, acComboBox, acDetail, , , 3 * CM, 1.4 * CM, 5 * CM, 0.6 * CM)
    c.Name = "cbo上長": c.RowSourceType = "Table/Query": c.RowSource = "SELECT 名前 FROM T_上長 ORDER BY 名前"
    c.LimitToList = True: c.FontSize = 11
    c.OnGotFocus = "=BossListRefresh()"                  ' 上長を登録した後でも、すぐ選べるように
    Btn tmp, "上長の登録", "=BtnBosses()", 8.3, 1.4, 3, 0.6

    Lbl tmp, "まだ承認していない日(押すと選ぶ。もう一度押すと外す)" & vbCrLf & "担当者は、メニューで選んだ人だけ出ます", 0.5, 2.3, 13, 1, 9, False
    Set c = CreateControl(tmp, acListBox, acDetail, , , 0.5 * CM, 3.4 * CM, 13 * CM, 9 * CM)
    c.Name = "lst待ち"
    c.RowSourceType = "Table/Query": c.RowSource = "Q_承認待ち"
    c.ColumnCount = 4: c.BoundColumn = 1: c.ColumnWidths = "0cm;3.5cm;4.5cm;2.5cm"
    c.ColumnHeads = True
    c.MultiSelect = 1                                    ' 1 = 押すたびに選ぶ/外す
    c.FontSize = 11

    Set c = CreateControl(tmp, acLabel, acDetail, , , 0.5 * CM, 12.5 * CM, 6 * CM, 0.6 * CM)
    c.Name = "lbl件数": c.Caption = "": c.FontName = "Meiryo UI": c.FontSize = 10

    Btn tmp, "すべて選ぶ", "=BtnApproveAll()", 0.5, 13.3, 3.2, 0.9
    Set c = Btn(tmp, "選んだ日を承認する", "=BtnApprove()", 3.9, 13.3, 5.4, 0.9)
    c.FontBold = True: c.FontSize = 11
    Btn tmp, "閉じる", "=BtnCloseApprove()", 10.3, 13.3, 3.2, 0.9

    DoCmd.Close acForm, tmp, acSaveYes
    DoCmd.Rename "F_承認", acForm, tmp
End Sub

Private Sub Lbl(ByVal fn As String, ByVal cap As String, ByVal l As Double, ByVal t As Double, ByVal w As Double, ByVal h As Double, ByVal sz As Long, ByVal bold As Boolean)
    Dim c As Control
    Set c = CreateControl(fn, acLabel, acDetail, , , l * 567, t * 567, w * 567, h * 567)
    c.Caption = cap
    c.FontName = "Meiryo UI"
    c.FontSize = sz
    c.FontBold = bold
End Sub

' ボタンを作る(作ったボタンを返すので、あとから色などを変えられる)
Private Function Btn(ByVal fn As String, ByVal cap As String, ByVal act As String, ByVal l As Double, ByVal t As Double, ByVal w As Double, ByVal h As Double) As Control
    Dim c As Control
    Set c = CreateControl(fn, acCommandButton, acDetail, , , l * 567, t * 567, w * 567, h * 567)
    c.Caption = cap
    c.OnClick = act
    c.FontName = "Meiryo UI"
    c.FontSize = 10
    Set Btn = c
End Function

' Excelの緑(濃い緑に白い文字)。2行の文字が入るよう 9pt にする
Private Sub ExcelColor(c As Control)
    c.BackColor = RGB(33, 115, 70)
    c.HoverColor = RGB(24, 92, 55)
    c.PressedColor = RGB(16, 70, 40)
    c.ForeColor = RGB(255, 255, 255)
    c.HoverForeColor = RGB(255, 255, 255)
    c.PressedForeColor = RGB(255, 255, 255)
    c.FontBold = True
    c.FontSize = 9
End Sub

' 開いたときにメニューを出す
Private Sub SetStartup()
    Dim db As DAO.Database
    Set db = CurrentDb
    SetProp db, "StartupForm", dbText, "F_メニュー"
    SetProp db, "AppTitle", dbText, "営業日報"
    Application.RefreshTitleBar
End Sub

Private Sub SetProp(db As DAO.Database, ByVal nm As String, ByVal tp As Integer, ByVal v As Variant)
    On Error Resume Next
    db.Properties(nm) = v
    If Err.Number <> 0 Then
        Err.Clear
        db.Properties.Append db.CreateProperty(nm, tp, v)
    End If
End Sub
