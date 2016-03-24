"use strict";

exports.arrayField = function(DataTypes, name){
    return {
        type: DataTypes.STRING(1022),
        defaultValue: [],
        get: function() {
            return JSON.parse(this.getDataValue(name));
        }, 
        set: function(val) {
            return this.setDataValue(name, JSON.stringify(val));
        }
    };
};