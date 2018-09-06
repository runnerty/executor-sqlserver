# Microsoft SQL Server executor for [Runnerty]:

### Configuration sample:
```json
{
  "id": "sqlserver_default",
  "type": "@runnerty-executor-sqlserver",
  "user": "sqlserverusr",
  "password": "sqlserverpass",
  "database": "tempdb",
  "host": "myhost.com"
}
```

### Plan sample:
```json
{
  "id":"sqlserver_default",
  "command_file": "/etc/runnerty/sql/test.sql"
}
```

```json
{
  "id":"sqlserver_default",
  "command": "SELECT getdate()"
}
```

```json
{
  "id":"sqlserver_sample",
  "command": "SELECT [id], [Name] FROM [tempdb].[dbo].[users]",
  "csvFileExport": "@GV(WORK_DIR)/users.csv"
}
```

### Generation of files:
The saved can be indicated in the file of the results obtained from a query in csv, xlsx and json format.
You only have to indicate the corresponding property in the parameters:
* `xlsxFileExport`: XLSX Formart file path
* `csvFileExport`: CSV Formart file path
* `fileExport`: JSON Formart file path

```json
{
  "id":"sqlserver_sample",
  "command": "SELECT [id], [Name] FROM [tempdb].[dbo].[users]",
  "xlsxFileExport": "@GV(WORK_DIR)/users.xlsx"
}
```

### Output (Process values):
#### Standard
* `PROCESS_EXEC_MSG_OUTPUT`: sqlserver output message.
* `PROCESS_EXEC_ERR_OUTPUT`: Error output message.
#### Query output
* `PROCESS_EXEC_DATA_OUTPUT`: sqlserver query output data.
* `PROCESS_EXEC_DB_COUNTROWS`: sqlserver query count rows.
* `PROCESS_EXEC_DB_FIRSTROW`: sqlserver query first row data.
* `PROCESS_EXEC_DB_FIRSTROW_[FILED_NAME]`: sqlserver first row field data.
#### Operation output
* `PROCESS_EXEC_DB_FIELDCOUNT`: sqlserver field count.
* `PROCESS_EXEC_DB_AFFECTEDROWS`: sqlserver affected rows count.
* `PROCESS_EXEC_DB_MESSAGE`: sqlserver message.

### Other considerations
If the result of your query is very large, you should consider using the "noReturnDataOutput" (boolean) property to prevent a large amount of data from entering memory and being interpreted by Runnerty, which could cause performance problems.

```json
{
  "id":"sqlserver_sample",
  "command": "SELECT * FROM LARGE_TABLE",
  "csvFileExport": "@GV(WORK_DIR)/LARGE_DATA.csv",
  "noReturnDataOutput": "true"
}
```

Set "encrypt" param to true if you're on Windows Azure:
```json
{
  "id":"sqlserver_sample",
  "command": "SELECT * FROM USERS",
  "encrypt": "true"
}
```


[Runnerty]: http://www.runnerty.io