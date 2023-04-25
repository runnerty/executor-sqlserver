'use strict';

const sql = require('mssql');
const JSONStream = require('JSONStream');
const Excel = require('exceljs');
const csv = require('fast-csv');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');

const Executor = require('@runnerty/module-core').Executor;

class sqlServerExecutor extends Executor {
  constructor(process) {
    super(process);
    this.ended = false;
    this.endOptions = {
      end: 'end'
    };
  }

  async exec(params) {
    // MAIN:
    try {
      if (!params.command && !params.command_file && !params.localInFile) {
        this.endOptions.end = 'error';
        this.endOptions.messageLog = 'execute-sqlserver dont have command or command_file or localInFile';
        this.endOptions.err_output = 'execute-sqlserver dont have command or command_file or localInFile';
        await this._end(this.endOptions);
      }

      if (params.command_file) {
        // Load SQL file:
        try {
          await fsp.access(params.command_file, fs.constants.F_OK | fs.constants.W_OK);
          params.command = await fsp.readFile(params.command_file, 'utf8');
        } catch (err) {
          throw new Error(`Load SQLFile: ${err}`);
        }
      }

      const query = await this.prepareQuery(params);
      this.endOptions.command_executed = query;

      params.csvOptions = params.csvOptions ?? {};
      if (!params.csvOptions.hasOwnProperty('headers')) params.csvOptions.headers = true;

      const defaultOptions = {
        encrypt: false,
        enableArithAbort: true,
        appName: 'Runnerty'
      };

      params.options = Object.assign(defaultOptions, params.options);

      /**
       * @type sql.config
       */
      const connectionConfig = {
        user: params.user,
        password: params.password,
        server: params.server,
        port: params.port,
        domain: params.domain,
        database: params.database,
        connectionTimeout: params.connectionTimeout,
        requestTimeout: params.requestTimeout,
        pool: {
          max: params?.pool?.max || 10,
          min: params?.pool?.min || 0,
          idleTimeoutMillis: params?.pool?.idleTimeoutMillis || 60000
        },
        arrayRowMode: false,
        stream: true,
        parseJSON: true,
        options: params.options
      };

      this.pool = await sql.connect(connectionConfig);

      this.pool.on('error', async err => {
        this.endOptions.end = 'error';
        this.endOptions.messageLog = `execute-sqlserver: ${err}`;
        this.endOptions.err_output = `execute-sqlserver: ${err}`;
        await this._end(this.endOptions);
      });

      const request = await this.pool.request();
      request.stream = true;

      if (params.localInFile) {
        if (fs.existsSync(params.localInFile)) {
          await this.csvToBulkInsert(request, params);
        } else {
          throw new Error(`execute-sqlserver - localInFile not exists: ${params.localInFile}`);
        }
      } else if (params.fileExport) {
        await this.executeJSONFileExport(request, query, params);
      } else if (params.xlsxFileExport) {
        await this.queryToXLSX(request, query, params);
      } else if (params.csvFileExport) {
        await this.queryToCSV(request, query, params);
      } else if (!params.fileExport && !params.xlsxFileExport && !params.csvFileExport) {
        await this.executeQuery(request, query);
      }
    } catch (error) {
      this.error(error);
    }
  }

  // Query to DATA_OUTPUT:
  async executeQuery(request, query) {
    try {
      request.stream = false;
      const results = await request.query(query);
      const firstRecordSet = results.recordset ? results.recordset[0] : undefined;
      this.prepareEndOptions(firstRecordSet, undefined, results.rowsAffected, results.recordsets);
      await this._end(this.endOptions);
    } catch (err) {
      this.error(err);
    }
  }
  // Query to JSON file:
  async executeJSONFileExport(request, query, params) {
    try {
      request.query(query);
      await fsp.access(path.dirname(params.fileExport));
      const fileStreamWriter = fs.createWriteStream(params.fileExport);
      fileStreamWriter.on('error', error => {
        this.error(error);
      });

      request.on('done', async () => {
        this.prepareEndOptions(firstRow, rowCounter);
        await this._end(this.endOptions);
      });

      request.on('error', error => {
        this.error(error);
      });

      // STREAMED
      let isFirstRow = true;
      let firstRow = {};
      let rowCounter = 0;

      request.on('row', row => {
        if (isFirstRow) {
          firstRow = row;
          isFirstRow = false;
        }
        rowCounter++;
      });

      request.pipe(JSONStream.stringify()).pipe(fileStreamWriter);
    } catch (error) {
      this.error(error);
    }
  }

  // Query to XLSX:
  async queryToXLSX(request, query, params) {
    try {
      request.query(query);
      await fsp.access(path.dirname(params.xlsxFileExport));
      const fileStreamWriter = fs.createWriteStream(params.xlsxFileExport);

      const options = {
        stream: fileStreamWriter,
        useStyles: true,
        useSharedStrings: true
      };
      const workbook = new Excel.stream.xlsx.WorkbookWriter(options);
      const author = 'Runnerty';
      const sheetName = 'Sheet';
      const sheet = workbook.addWorksheet(params.xlsxSheetName ? params.xlsxSheetName : sheetName);
      workbook.creator = params.xlsxAuthorName ? params.xlsxAuthorName : author;
      workbook.lastPrinted = new Date();

      fileStreamWriter.on('error', error => {
        this.error(error);
      });

      request.on('error', error => {
        this.error(error);
      });

      // STREAMED
      let isFirstRow = true;
      let firstRow = {};
      let rowCounter = 0;

      request.on('row', row => {
        if (isFirstRow) {
          firstRow = row;
          sheet.columns = this.generateHeader(row);
          isFirstRow = false;
        }
        sheet.addRow(row).commit();
        rowCounter++;
      });

      request.on('done', async () => {
        this.prepareEndOptions(firstRow, rowCounter);
        await this._end(this.endOptions);
        await workbook.commit();
      });
    } catch (err) {
      this.error(err);
    }
  }
  // Query to CSV:
  async queryToCSV(request, query, params) {
    try {
      request.query(query);
      await fsp.access(path.dirname(params.csvFileExport));
      const fileStreamWriter = fs.createWriteStream(params.csvFileExport);

      const csvStream = csv.format(params.csvOptions).on('error', err => {
        this.error(err);
      });

      fileStreamWriter.on('error', error => {
        this.error(error);
      });

      request.on('done', async () => {
        this.prepareEndOptions(firstRow, rowCounter);
        await this._end(this.endOptions);
      });

      request.on('error', error => {
        this.error(error);
      });

      // STREAMED
      let isFirstRow = true;
      let firstRow = {};
      let rowCounter = 0;

      request.on('row', row => {
        if (isFirstRow) {
          firstRow = row;
          isFirstRow = false;
        }
        rowCounter++;
      });

      request.pipe(csvStream).pipe(fileStreamWriter);
    } catch (err) {
      this.error(err);
    }
  }

  // CSV to BULK INSERT:
  async csvToBulkInsert(request, params) {
    try {
      request.stream = false;

      const query = await this.prepareQuery({
        command: `SELECT TOP(0) * FROM @GV('TABLE_NAME')`,
        args: { TABLE_NAME: params.tableName }
      });

      const table = (await request.query(query)).recordset.toTable(params.tableName);

      await new Promise((resolve, reject) => {
        csv
          .parseFile(params.localInFile, params.csvOptions)
          .on('error', err => {
            reject(err);
          })
          .on('data', row => {
            table.rows.add(
              ...Object.values(row).map(value => {
                return value.toLowerCase() === 'null' ? null : value;
              })
            );
          })
          .on('end', () => {
            resolve();
          });
      });

      const bulkResult = await request.bulk(table);

      this.endOptions.command_executed = 'BULK INSERT';
      this.prepareEndOptions(null, null, bulkResult.rowsAffected);
      await this._end(this.endOptions);
    } catch (err) {
      this.error(err);
    }
  }

  async error(err) {
    this.endOptions.end = 'error';
    this.endOptions.messageLog = `execute-sqlserver: ${err}`;
    this.endOptions.err_output = `execute-sqlserver: ${err}`;
    await this._end(this.endOptions);
  }

  async _end(endOptions) {
    if (!this.ended) await this.end(endOptions);
    this.pool?.close();
    this.ended = true;
  }

  async prepareQuery(values) {
    const options = {
      useExtraValue: values.args || false,
      useProcessValues: true,
      useGlobalValues: true,
      altValueReplace: 'null'
    };

    try {
      const query = await this.paramsReplace(values.command, options);
      return query;
    } catch (err) {
      throw err;
    }
  }

  generateHeader(row) {
    const columns = [];
    for (let i = 0; i < Object.keys(row).length; i++) {
      columns.push({
        header: Object.keys(row)[i],
        key: Object.keys(row)[i],
        width: 30
      });
    }
    return columns;
  }

  prepareEndOptions(firstRow, rowCounter, rowsAffected, results) {
    //STANDARD OUPUT:
    if (Array.isArray(results)) {
      if (results[0]) {
        this.endOptions.data_output = results[0] || '';
      }
    } else {
      this.endOptions.data_output = results || '';
    }

    //EXTRA DATA OUTPUT:
    // COUNTROWS:
    this.endOptions.extra_output = {};
    if (Array.isArray(rowCounter)) {
      for (let i = 0; i < rowCounter.length; i++) {
        this.endOptions.extra_output[`db_countRows${i ? `_${i}` : ''}`] = rowCounter[i] || '0';
      }
    } else {
      this.endOptions.extra_output.db_countRows = rowCounter || '0';
    }
    // AFFECTEDROWS:
    if (Array.isArray(rowsAffected)) {
      for (let i = 0; i < rowsAffected.length; i++) {
        this.endOptions.extra_output[`db_affectedRows${i ? `_${i}` : ''}`] = rowsAffected[i] || '0';
      }
    } else {
      this.endOptions.extra_output.db_affectedRows = rowsAffected || '0';
    }

    // EXTRA RESULTS TO DATA_OUTPUT:
    if (Array.isArray(results)) {
      for (let i = 1; i < results.length; i++) {
        this.endOptions.extra_output[`data_output_${i}`] = JSON.stringify(results[i]) || '';
      }
    }

    //FIRST ROW:
    this.endOptions.extra_output.db_firstRow = JSON.stringify(firstRow);
    if (firstRow instanceof Object) {
      const keys = Object.keys(firstRow);
      let keysLength = keys.length;
      while (keysLength--) {
        const key = keys[keysLength];
        this.endOptions.extra_output[`db_firstRow_${key}`] = firstRow[key];
      }
    }

    // EXTRA RESULTS TO FIRST ROW:
    if (Array.isArray(results)) {
      for (let i = 1; i < results.length; i++) {
        if (results[i][0]) {
          const _firstRow = results[i][0];
          this.endOptions.extra_output[`db_firstRow_${i}`] = JSON.stringify(_firstRow);
          if (_firstRow instanceof Object) {
            const keys = Object.keys(_firstRow);
            let keysLength = keys.length;
            while (keysLength--) {
              const key = keys[keysLength];
              this.endOptions.extra_output[`db_firstRow_${i}_${key}`] = _firstRow[key];
            }
          }
        }
      }
    }
  }
}

module.exports = sqlServerExecutor;
