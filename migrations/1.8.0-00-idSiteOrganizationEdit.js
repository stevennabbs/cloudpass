"use strict";
module.exports = {
    up: function(migration, DataTypes, models) {
        return migration.addColumn(
            'idSites',
            'organizationEdit',
            {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true
            }
        );
    }
};
