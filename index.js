"use strict";

const mssql = require("mssql");
const Excel = require("exceljs");
const fs = require("fs");

const loadSQLFile = global.libUtils.loadSQLFile;
const Execution = global.ExecutionClass;

class sqlServerExecutor extends Execution {
  constructor(process) {
    super(process);
  }

  exec(params) {
    let _this = this;
    let endOptions = {end: "end"};

    function executeQuery(values) {

      return new Promise(async (resolve, reject) =>{
        const options = {
          useExtraValue: values.args || false,
          useProcessValues: true,
          useGlobalValues: true,
          altValueReplace: "null"
        };

        let _query = await _this.paramsReplace(values.command, options);
        endOptions.command_executed = _query;

        const config = {
          user: values.user,
          password: values.password,
          server: values.host,
          database: values.database,
          options: {
              encrypt: !values.encrypt?false:true // Use this if you're on Windows Azure
          }
      }

       mssql.connect(config)
       .then(pool => {
         pool.request().query(_query)
         .then(results => {
          console.log(">>>",results);
          resolve(results);
         })
         .catch(err =>{
          reject(`SqlServer execution, query ${_query}: ${err}`);
         });
        });

        mssql.on('error', err => {
          reject(`Error connecting SqlServer: ${err}`);
        })
      });
    }

    function prepareEndOptions(results){
      let endOptions = {end: "end"};
      //STANDARD OUPUT:
      endOptions.data_output = !params.noReturnDataOutput?results.recordset:"";
      endOptions.msg_output  = results.output || "";
      //EXTRA DATA OUTPUT:
      endOptions.extra_output = {};
      endOptions.extra_output.db_countRows = results.recordset.length;
      endOptions.extra_output.db_firstRow  = JSON.stringify(results.recordset[0]);
      if (results.recordset[0] instanceof Object) {
        let keys = Object.keys(results.recordset[0]);
        let keysLength = keys.length;
        while (keysLength--) {
          let key = keys[keysLength];
          endOptions.extra_output["db_firstRow_"+key] = results.recordset[0][key];
        }
      }
      return endOptions;
    }

    function evaluateResults(results) {
      if (results.recordset instanceof Array) {

        if (params.xlsxFileExport || params.csvFileExport || params.fileExport){
          let author = "Runnerty";
          let sheetName = "Sheet";

          if (params.xlsxAuthorName){
            author = params.xlsxAuthorName;
          }

          if (params.xlsxSheetName){
            sheetName = params.xlsxSheetName;
          }

          let workbook = new Excel.Workbook();
          let sheet = workbook.addWorksheet(sheetName);
          workbook.creator = author;
          workbook.lastPrinted = new Date();

          let columns = [];
          if (results.recordset.length){
            for (let i = 0; i < Object.keys(results.recordset[0]).length; i++){
              columns.push({
                header: Object.keys(results.recordset[0])[i],
                key: Object.keys(results.recordset[0])[i],
                width: 30
              });
            }
            sheet.columns = columns;
            sheet.addRows(results.recordset);
          }

          if (params.xlsxFileExport){
            workbook.xlsx.writeFile(params.xlsxFileExport).then((err, data) =>{
              if (err){
                _this.logger.log("error", `Generating xlsx: ${err}. Results: ${results.recordset}`);
              }
              _this.end(prepareEndOptions(results));
            });
          }

          if (params.csvFileExport){
            workbook.csv.writeFile(params.csvFileExport, params.csvOptions).then((err, data) =>{
              if (err){
                _this.logger.log("error", `Generating csv: ${err}. Results: ${results.recordset}`);
              }
              _this.end(prepareEndOptions(results));
            });
          }

          if (params.fileExport){
            fs.writeFile(params.fileExport, JSON.stringify(results.recordset), "utf8", (err) => {
              if (err) {
                _this.logger.log("error", `Generating file: ${err}. Results: ${results.recordset}`);
              }
              _this.end(prepareEndOptions(results));
            });
          }
        }else{
          _this.end(prepareEndOptions(results));
        }

      } else {

        if (results instanceof Object) {
          endOptions.data_output = "";
          endOptions.msg_output = results.output || "";
          //EXTRA DATA OUTPUT:
          endOptions.extra_output = {};
          endOptions.extra_output.db_fieldCount = results.fieldCount;
          endOptions.extra_output.db_affectedRows = results.rowsAffected[0];
          endOptions.extra_output.db_insertId = results.insertId;
          endOptions.extra_output.db_warningCount = results.warningCount;
          endOptions.extra_output.db_message = results.message;
        }
        _this.end(endOptions);
      }
    }

    // MAIN:

    if (params.command) {
      executeQuery(params)
        .then((results) => {
          evaluateResults(results);
        })
        .catch((err) =>{
          endOptions.end = "error";
          endOptions.messageLog = `SqlServer execution query: ${err}`;
          endOptions.err_output = `SqlServer execution query: ${err}`;
          _this.end(endOptions);
        });
    } else {
      if (params.command_file) {
        loadSQLFile(params.command_file)
          .then((fileContent) => {
            params.command = fileContent;
            executeQuery(params)
              .then((results) => {
                evaluateResults(results);
              })
              .catch((err) => {
                endOptions.end = "error";
                endOptions.messageLog = `SqlServer execution query from file: ${err}`;
                endOptions.err_output = `SqlServer execution query from file: ${err}`;
                _this.end(endOptions);
              });
          })
          .catch((err) => {
            endOptions.end = "error";
            endOptions.messageLog = `SqlServer execution loadSQLFile: ${err}`;
            endOptions.err_output = `SqlServer execution loadSQLFile: ${err}`;
            _this.end(endOptions);
          });
      } else {
        endOptions.end = "error";
        endOptions.messageLog = "SqlServer execution dont have command or command_file";
        endOptions.err_output = "SqlServer execution dont have command or command_file";
        _this.end(endOptions);
      }
    }
  }
}

module.exports = sqlServerExecutor;