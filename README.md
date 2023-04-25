<p align="center">
  <a href="http://runnerty.io">
    <img height="257" src="https://runnerty.io/assets/header/logo-stroked.png">
  </a>
  <p align="center">Smart Processes Management</p>
</p>

[![NPM version][npm-image]][npm-url] [![Downloads][downloads-image]][npm-url] [![Dependency Status][david-badge]][david-badge-url]
<a href="#badge">
<img alt="code style: prettier" src="https://img.shields.io/badge/code_style-prettier-ff69b4.svg">
</a>

# Microsoft SQL Server executor for [Runnerty]:

### Installation:

Through NPM

```bash
npm i @runnerty/executor-sqlserver
```

You can also add modules to your project with [runnerty]

```bash
npx runnerty add @runnerty/executor-sqlserver
```

This command installs the module in your project, adds example configuration in your [config.json] and creates an example plan of use.

If you have installed [runnerty] globally you can include the module with this command:

```bash
runnerty add @runnerty/executor-sqlserver
```

### Configuration:

Add in [config.json]:

```json
{
  "id": "sqlserver_default",
  "type": "@runnerty-executor-sqlserver",
  "user": "sa",
  "password": "yourStrong(!)Password",
  "database": "master",
  "server": "localhost",
  "port": 1433
}
```

```json
{
  "id": "sqlserver_default",
  "type": "@runnerty-executor-sqlserver",
  "user": "sa",
  "password": "yourStrong(!)Password",
  "database": "master",
  "server": "localhost",
  "port": 1433,
  "options": {
    "useUTC": true
  }
}
```

#### Configuration params:

| Parameter              | Description                                                                                                                              |
| :--------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| user                   | The sqlserver user to authenticate as.                                                                                                   |
| password               | The password of that sqlserver user.                                                                                                     |
| database               | Name of the database to use for this connection. (Optional)                                                                              |
| server                 | The hostname of the database you are connecting to.                                                                                      |
| port                   | The port number to connect to. (Default: 3306)                                                                                           |
| domain                 | Once you set domain, driver will connect to SQL Server using domain login.                                                               |
| connectionTimeout      | Connection timeout in ms (default: 15000).                                                                                               |
| requestTimeout         | Request timeout in ms (default: 15000).                                                                                                  |
| pool.max               | The maximum number of connections there can be in the pool (default: 10).                                                                |
| pool.min               | The minimum of connections there can be in the pool (default: 0).                                                                        |
| pool.idleTimeoutMillis | The Number of milliseconds before closing an unused connection default: 30000).                                                          |
| options                | get more information about the options in the module documentation [node-mssql](https://tediousjs.github.io/tedious/api-connection.html) |

### Plan sample:

Add in [plan.json]:

```json
{
  "id": "sqlserver_default",
  "command_file": "/etc/runnerty/sql/test.sql"
}
```

```json
{
  "id": "sqlserver_default",
  "command": "SELECT NOW()"
}
```

### Generation of files:

The saved can be indicated in the file of the results obtained from a query in csv, xlsx and json format. These files will be generated with streams.
You only have to indicate the corresponding property in the parameters:

#### XLSX

XLSX Format

| Parameter      | Description                   |
| :------------- | :---------------------------- |
| xlsxFileExport | Path of xlsx file export.     |
| xlsxAuthorName | Author file name. (Optional)  |
| xlsxSheetName  | Name of the sheet. (Optional) |

Sample:

```json
{
  "id": "sqlserver_default",
  "command": "SELECT * FROM USERS",
  "xlsxFileExport": "./my_output.xlsx",
  "xlsxAuthorName": "Runnerty",
  "xlsxSheetName": "MySheetSample"
}
```

#### CSV

CSV Format

| Parameter                         | Description                                                                                                                                                                             |
| :-------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| csvFileExport                     | Path of csv file export.                                                                                                                                                                |
| csvOptions/headers                | Type: boolean/string[]. The headers will be auto detected from the first row or you can to provide headers array: ['h1name','h2name',...].                                              |
| csvOptions/delimiter              | Alternate delimiter. (Default: ',')                                                                                                                                                     |
| csvOptions/quote                  | Alternate quote. (Default: '"')                                                                                                                                                         |
| csvOptions/alwaysWriteHeaders     | Set to true if you always want headers written, even if no rows are written. (Default: false)                                                                                           |
| csvOptions/rowDelimiter           | Specify an alternate row delimiter (i.e \r\n). (Default: '\n')                                                                                                                          |
| csvOptions/quoteHeaders           | If true then all headers will be quoted. (Default: quoteColumns value)                                                                                                                  |
| csvOptions/quoteColumns           | If true then columns and headers will be quoted (unless quoteHeaders is specified). (Default: false). More info [here.](https://c2fo.io/fast-csv/docs/formatting/options/#quotecolumns) |
| csvOptions/escape                 | Alternate escaping value. (Default: '"')                                                                                                                                                |
| csvOptions/includeEndRowDelimiter | Set to true to include a row delimiter at the end of the csv. (Default: false)                                                                                                          |
| csvOptions/writeBOM               | Set to true if you want the first character written to the stream to be a utf-8 BOM character. (Default: false)                                                                         |

Sample:

```json
{
  "id": "sqlserver_default",
  "command": "SELECT * FROM USERS",
  "csvFileExport": "@GV(WORK_DIR)/users.csv",
  "csvOptions": {
    "delimiter": ";",
    "quote": "\""
  }
}
```

#### JSON

JSON Format

Sample:

```json
{
  "id": "sqlserver_sample",
  "command": "SELECT * FROM USERS",
  "fileExport": "@GV(WORK_DIR)/users.json"
}
```

### Loading files:

For file upload you must indicate the path of the csv file to be loaded in the `localInFile` parameter and the name of the table to load the data into in the `tableName` parameter. For example:

```json
{
  "id": "sqlserver_default",
  "localInFile": "/sample.csv"
  "tableName": "dbo.TABLE_NAME"
}
```

### Output (Process values):

#### Standard

- `PROCESS_EXEC_MSG_OUTPUT`: sqlserver output message.
- `PROCESS_EXEC_ERR_OUTPUT`: Error output message.

#### Query output

- `PROCESS_EXEC_DATA_OUTPUT`: sqlserver query output data.
- `PROCESS_EXEC_DB_COUNTROWS`: sqlserver query count rows.
- `PROCESS_EXEC_DB_FIRSTROW`: sqlserver query first row data.
- `PROCESS_EXEC_DB_FIRSTROW_[FILED_NAME]`: sqlserver first row field data.

If the process executes more than one query, it will be able to access its first row indicating its number in order, starting at zero. The first query corresponds to `PROCESS_EXEC_DB_FIRSTROW`, the next to `PROCESS_EXEC_DB_FIRSTROW_1` and so on.
The same is true for the rest of the values.

#### Operation output

- `PROCESS_EXEC_DB_AFFECTEDROWS`: sqlserver affected rows count.

If the process executes more than one operation, it will be able to access its first row indicating its number in order, starting at zero. The first operation corresponds to `PROCESS_EXEC_DB_AFFECTEDROWS`, the next to `PROCESS_EXEC_DB_AFFECTEDROWS_1` and so on.

[runnerty]: http://www.runnerty.io
[downloads-image]: https://img.shields.io/npm/dm/@runnerty/executor-sqlserver.svg
[npm-url]: https://www.npmjs.com/package/@runnerty/executor-sqlserver
[npm-image]: https://img.shields.io/npm/v/@runnerty/executor-sqlserver.svg
[david-badge]: https://david-dm.org/runnerty/executor-sqlserver.svg
[david-badge-url]: https://david-dm.org/runnerty/executor-sqlserver
[config.json]: https://docs.runnerty.io/config/
[plan.json]: https://docs.runnerty.io/plan/
