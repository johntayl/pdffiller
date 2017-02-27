/*
*   File:       index.js (pdffiller)
*   Project:    PDF Filler
*   Date:       May 2015.
*
*   Description: This PDF filler module takes a data set and creates a filled out
*                PDF file with the form fields populated.
*/
(function(opt){
    var child_process = require('child_process'),
        execFile = require('child_process').execFile,
        fdf = require('utf8-fdf-generator'),
        _ = require('lodash'),
        fs = require('fs');
    
    var defaultOpts = {
        keepExistingValues: false
    };

    opt = opt || {};

    var pdffiller = {
        currOpts: {},
        setOptions: function(opts){
            this.currOpts = opts;
        },

        mapForm2PDF: function( formFields, convMap ){
            var tmpFDFData = this.convFieldJson2FDF(formFields);
            tmpFDFData = _.mapKeys(tmpFDFData, function(value, key){
                try {
                    convMap[key];
                } catch(err){

                    return key;
                }
                return convMap[key];
            });

            return tmpFDFData;
        },

        convFieldJson2FDF: function(fieldJson){
            var _keys = _.pluck(fieldJson, 'title'),
                _values = _.pluck(fieldJson, 'fieldValue');

            _values = _.map(_values, function(val){
                if(val === true){
                    return 'Yes';
                }else if(val === false) {
                    return 'Off';
                }
                return val;
            });

            var jsonObj = _.zipObject(_keys, _values);

            return jsonObj;
        },

        generateFieldJson: function( sourceFile, nameRegex, callback){
            var regName = /FieldName: ([^\n]*)/,
                regType = /FieldType: ([A-Za-z\t .]+)/,
                regFlags = /FieldFlags: ([0-9\t .]+)/,
                regValue = /FieldValue: ([^\n]*)/,
                fieldArray = [],
                currField = {},
                that = this;

            if(nameRegex !== null && (typeof nameRegex) == 'object' ) regName = nameRegex;

            execFile( "pdftk", [sourceFile, "dump_data_fields_utf8"], function (error, stdout, stderr) {
                if (error) {
                    console.log('exec error: ' + error);
                    return callback(error, null);
                }

                fields = stdout.toString().split("---").slice(1);
                fields.forEach(function(field){
                    currField = {};

                    currField['title'] = field.match(regName)[1].trim() || '';

                    if(that.currOpts.keepExistingValues && field.match(regType)){
                        currField['fieldType'] = field.match(regType)[1].trim() || '';
                    }else {
                        currField['fieldType'] = '';
                    }
                     
                    if(field.match(regFlags)){
                        currField['fieldFlags'] = field.match(regFlags)[1].trim() || '';
                    }else{
                        currField['fieldFlags'] = '';
                    }
                    
                    if (opt.keep) {
                        if(field.match(regValue)){
                            currField['fieldValue'] = field.match(regValue)[1].trim() || '';
                        }else{
                            currField['fieldValue'] = '';
                        }
                    }else{
                        currField['fieldValue'] = '';
                    }
                    

                    fieldArray.push(currField);
                });

                return callback(null, fieldArray);
            });
        },

        generateFDFTemplate: function( sourceFile, nameRegex, callback ){
            this.generateFieldJson(sourceFile, nameRegex, function(err, _form_fields){
                if (err) {
                  console.log('exec error: ' + err);
                  return callback(err, null);
                }

                return callback(null, this.convFieldJson2FDF(_form_fields));

            }.bind(this));
        },

        fillFormWithOptions: function( sourceFile, destinationFile, fieldValues, shouldFlatten, tempFDFPath, callback ) {
            //Generate the data from the field values.
            var randomSequence = Math.random().toString(36).substring(7);
            var currentTime = new Date().getTime();
            var tempFDFFile =  "temp_data" + currentTime + randomSequence + ".fdf",
                tempFDF = (typeof tempFDFPath !== "undefined"? tempFDFPath + '/' + tempFDFFile: tempFDFFile),
                formData = fdf.generator( fieldValues, tempFDF );

            var args = [sourceFile, "fill_form", tempFDF, "output", destinationFile];
            if (shouldFlatten) {
                args.push("flatten");
            }
            debugger;
            execFile( "pdftk", args, function (error, stdout, stderr) {

                debugger;
                if ( error ) {
                    console.log('exec error: ' + error);
                    return callback(error);
                }
                //Delete the temporary fdf file.
                fs.unlink( tempFDF, function( err ) {

                    if ( err ) {
                        return callback(err);
                    }
                    return callback();
                });
            } );
        },

        fillFormWithFlatten: function( sourceFile, destinationFile, fieldValues, shouldFlatten, callback ) {
            this.fillFormWithOptions( sourceFile, destinationFile, fieldValues, shouldFlatten, undefined, callback);
        },

        fillForm: function( sourceFile, destinationFile, fieldValues, callback) {
            this.fillFormWithFlatten( sourceFile, destinationFile, fieldValues, true, callback);
        }

    };

    pdffiller.setOptions(defaultOpts);
        
    module.exports = pdffiller;

}())
