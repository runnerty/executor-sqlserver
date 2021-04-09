"use strict";

const sql = require("mssql");
const JSONStream = require("JSONStream");
const Excel = require("exceljs");
const csv = require("fast-csv");
const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");

const Executor = require("@runnerty/module-core").Executor;

class sqlServerExecutor extends Executor {
  constructor(process) {
    super(process);
    this.ended = false;
    this.endOptions = {
      end: "end",
    };
  }

  async exec(params) {
    // MAIN:
    try {
      if (!params.command) {
        if (params.command_file) {
          // Load SQL file:
          try {
            await fsp.access(
              params.command_file,
              fs.constants.F_OK | fs.constants.W_OK
            );
            params.command = await fsp.readFile(params.command_file, "utf8");
          } catch (err) {
            throw new Error(`Load SQLFile: ${err}`);
          }
        } else {
          this.endOptions.end = "error";
          this.endOptions.messageLog =
            "execute-postgres dont have command or command_file";
          this.endOptions.err_output =
            "execute-postgres dont have command or command_file";
          this._end(this.endOptions);
        }
      }
      const query = await this.prepareQuery(params);
      this.endOptions.command_executed = query;

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
          idleTimeoutMillis: params?.pool?.idleTimeoutMillis || 60000,
        },
        arrayRowMode: true,
        stream: true,
        parseJSON: true,
        options: {
          encrypt: true,
          enableArithAbort: true,
        },
      };

      const pool = await sql.connect(connectionConfig);

      pool.on("error", (err) => {
        this.endOptions.end = "error";
        this.endOptions.messageLog = `execute-postgres: ${err}`;
        this.endOptions.err_output = `execute-postgres: ${err}`;
        this._end(this.endOptions);
      });

      const request = await pool.request();
      request.stream = true;

      // if (params.localInFile) await this.executeCopyFrom(pool, request, query, params); TODO: LOAD
      if (params.fileExport)
        await this.executeCopyTo(pool, request, query, params);
      if (params.jsonFileExport)
        await this.queryToJSON(pool, request, query, params);
      if (params.xlsxFileExport)
        await this.queryToXLSX(pool, request, query, params);
      if (params.csvFileExport)
        await this.queryToCSV(pool, request, query, params);
      if (
        !params.localInFile &&
        !params.fileExport &&
        !params.jsonFileExport &&
        !params.xlsxFileExport &&
        !params.csvFileExport
      ) {
        request.stream = false;
        await this.executeQuery(pool, request, query);
      }
    } catch (error) {
      this.error(error);
    }
  }

  // Query to DATA_OUTPUT:
  async executeQuery(pool, request, query) {
    try {
      const results = await request.query(query);
      this.prepareEndOptions(results.rows[0], results.rowCount, results.rows);
      this._end(this.endOptions);
      pool.close();
    } catch (err) {
      this.error(err, request);
    }
  }
  // COPY to plane file:
  async executeCopyTo(pool, request, query, params) {
    try {
      const resStream = request.query(query);
      await fsp.access(path.dirname(params.fileExport));
      const fileStreamWriter = fs.createWriteStream(params.fileExport);
      fileStreamWriter.on("error", (error) => {
        this.error(error, request);
        pool.close();
      });
      fileStreamWriter.on("finish", () => {
        this.prepareEndOptions(firstRow, rowCounter);
        this._end(this.endOptions);
        pool.close();
      });
      resStream.on("error", (error) => {
        this.error(error, request);
        pool.close();
      });

      // STREAMED
      let isFirstRow = true;
      let firstRow = {};
      let rowCounter = 0;
      resStream.on("row", (row) => {
        if (isFirstRow) {
          firstRow = row;
          isFirstRow = false;
        }
        rowCounter++;
      });
      resStream.pipe(fileStreamWriter);
    } catch (error) {
      this.error(error, request);
      pool.close();
    }
  }

  // Query to JSON:
  // COPY to plane file:
  async queryToJSON(pool, request, query, params) {
    try {
      const resStream = request.query(query);
      await fsp.access(path.dirname(params.fileExport));
      const fileStreamWriter = fs.createWriteStream(params.fileExport);
      fileStreamWriter.on("error", (error) => {
        this.error(error, request);
        pool.close();
      });
      fileStreamWriter.on("finish", () => {
        this.prepareEndOptions(firstRow, rowCounter);
        this._end(this.endOptions);
        pool.close();
      });
      resStream.on("error", (error) => {
        this.error(error, request);
        pool.close();
      });

      // STREAMED
      let isFirstRow = true;
      let firstRow = {};
      let rowCounter = 0;
      resStream.on("row", (row) => {
        if (isFirstRow) {
          firstRow = row;
          isFirstRow = false;
        }
        rowCounter++;
      });
      resStream.pipe(JSONStream.stringify()).pipe(fileStreamWriter);
    } catch (error) {
      this.error(error, request);
      pool.close();
    }
  }
  /*
  // Query to XLSX:
  async queryToXLSX(request, query, params) {
    try {
      await fsp.access(path.dirname(params.xlsxFileExport));
      const queryStream = new QueryStream(query);
      const resStream = request.query(queryStream);
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
        this.error(error, request);
      });
      resStream.on('error', error => {
        this.error(error, request);
      });

      // STREAMED
      let isFirstRow = true;
      let firstRow = {};
      let rowCounter = 0;
      resStream.on('data', row => {
        if (isFirstRow) {
          firstRow = row;
          sheet.columns = this.generateHeader(row);
          isFirstRow = false;
        }
        sheet.addRow(row).commit();
        rowCounter++;
      });

      resStream.on('end', async () => {
        await workbook.commit();
        this.prepareEndOptions(firstRow, rowCounter);
        this._end(this.endOptions);
        request.release();
      });
    } catch (err) {
      this.error(err, request);
    }
  }

  // Query to CSV:
  async queryToCSV(request, query, params) {
    try {
      await fsp.access(path.dirname(params.csvFileExport));
      const queryStream = new QueryStream(query);
      const resStream = request.query(queryStream);
      const fileStreamWriter = fs.createWriteStream(params.csvFileExport);

      const paramsCSV = params.csvOptions || {};
      if (!paramsCSV.hasOwnProperty('headers')) paramsCSV.headers = true;
      const csvStream = csv.format(paramsCSV).on('error', err => {
        this.error(err, request);
      });

      fileStreamWriter.on('error', error => {
        this.error(error, request);
      });
      resStream.on('error', error => {
        this.error(error, request);
      });

      // STREAMED
      let isFirstRow = true;
      let firstRow = {};
      let rowCounter = 0;
      resStream.on('data', row => {
        if (isFirstRow) {
          firstRow = row;
          isFirstRow = false;
        }
        rowCounter++;
      });

      resStream.on('end', async data => {
        this.prepareEndOptions(firstRow, rowCounter);
        this._end(this.endOptions);
        request.release();
      });

      resStream.pipe(csvStream).pipe(fileStreamWriter);
    } catch (err) {
      this.error(err, request);
    }
  }

  // COPY FROM - LOAD DATA:
  async executeCopyFrom(request, query, params) {
    try {
      await fsp.access(params.localInFile);
      const resStream = await request.query(pgCopy.from(query));
      const fileStreamReader = fs.createReadStream(params.localInFile);
      fileStreamReader.on('error', error => {
        this.error(error, request);
      });
      resStream.on('error', error => {
        this.error(error, request);
      });
      resStream.on('finish', () => {
        fileStreamReader.end();
        this._end(this.endOptions);
        request.release();
      });
      fileStreamReader.pipe(resStream);
    } catch (error) {
      this.error(error, request);
    }
  }
  */

  error(err, request) {
    if (request) request.release();
    this.endOptions.end = "error";
    this.endOptions.messageLog = `execute-postgres: ${err}`;
    this.endOptions.err_output = `execute-postgres: ${err}`;
    this._end(this.endOptions);
  }

  _end(endOptions) {
    if (!this.ended) this.end(endOptions);
    this.ended = true;
  }

  async prepareQuery(values) {
    const options = {
      useExtraValue: values.args || false,
      useProcessValues: true,
      useGlobalValues: true,
      altValueReplace: "null",
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
        width: 30,
      });
    }
    return columns;
  }

  prepareEndOptions(firstRow, rowCounter, results) {
    //STANDARD OUPUT:
    this.endOptions.data_output = results || "";

    //EXTRA DATA OUTPUT:
    this.endOptions.extra_output = {};
    this.endOptions.extra_output.db_countrows = rowCounter || "0";

    this.endOptions.extra_output.db_firstRow = JSON.stringify(firstRow);
    if (firstRow instanceof Object) {
      const keys = Object.keys(firstRow);
      let keysLength = keys.length;
      while (keysLength--) {
        const key = keys[keysLength];
        this.endOptions.extra_output["db_firstRow_" + key] = firstRow[key];
      }
    }
  }
}

module.exports = sqlServerExecutor;
