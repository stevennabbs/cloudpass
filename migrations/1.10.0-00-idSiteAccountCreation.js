"use strict";
module.exports = {
    up: function(migration, DataTypes, models) {
        return migration.addColumn(
            'idSite',
            'accountCreation',
            {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true
            }
        );
    }
};
