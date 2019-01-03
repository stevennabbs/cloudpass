"use strict";

const winston = require('winston');
const _ = require('lodash');

const {format} = winston;
const {combine, label, timestamp, colorize, printf} = format;

exports.fromConfig = function (winstonConf, callback) {
    const transports = {};
    for (const transportName in winstonConf.transports) {
        if (Object.prototype.hasOwnProperty.call(winstonConf.transports, transportName)) {
            const transportConf = winstonConf.transports[transportName];
            const className = transportConf.class || transportName;
            try {
                transports[transportName] = new (require(className))(transportConf);
            } catch (e) {
                if (e instanceof Error) {
                    transports[transportName] = new winston.transports[_.upperFirst(className)](transportConf);
                } else {
                    throw e;
                }
            }
        }
    }
    for (const loggerName in winstonConf.loggers) {
        if (Object.prototype.hasOwnProperty.call(winstonConf.loggers, loggerName)) {
            winston.loggers.add(loggerName, {
                format: combine(
                    label({label: loggerName}),
                    timestamp(),
                    colorize(),
                    printf(info => {
                        return `${info.timestamp} [${info.label}] ${info.level}: ${info.message}`;
                    })
                ),
                transports: winstonConf.loggers[loggerName].transports.map(t => transports[t])
            });
        }
    }
    callback();
};
