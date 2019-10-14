"use strict";
module.exports = {
    up: function(migration, DataTypes, models) {
        return migration.addColumn(
            'idSites',
            'accountCreation',
            {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true
            }
        );
    }
};
